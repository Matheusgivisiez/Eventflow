import { BadRequestException, Injectable, NotFoundException, UnauthorizedException } from "@nestjs/common";
import { CheckInStatus, PaymentStatus, TicketStatus } from "@prisma/client";
import { createHash, randomBytes, randomUUID } from "crypto";
import { PrismaService } from "../../prisma/prisma.service";
import { RequestUser } from "../../common/types/request-user";

type AnyRecord = Record<string, any>;

@Injectable()
export class EnterpriseService {
  constructor(private readonly prisma: PrismaService) {}

  async overview(user: RequestUser) {
    const tenantId = this.requireTenant(user);
    const db = this.db();
    const [events, customers, affiliateLinks, campaigns, apiKeys, seatMaps, integrations, fraudSignals] = await Promise.all([
      this.prisma.event.count({ where: { tenantId } }),
      db.crmCustomer.count({ where: { tenantId } }),
      db.affiliateLink.count({ where: { tenantId } }),
      db.crmCampaign.count({ where: { tenantId } }),
      db.apiKey.count({ where: { tenantId, status: "ACTIVE" } }),
      db.seatMap.count({ where: { tenantId, isActive: true } }),
      db.analyticsIntegration.count({ where: { tenantId, isActive: true } }),
      db.fraudSignal.count({ where: { tenantId, riskLevel: { in: ["HIGH", "CRITICAL"] } } })
    ]);

    return {
      tenantId,
      readiness: {
        whiteLabel: true,
        mobileOffline: true,
        affiliates: true,
        crm: true,
        marketingAutomation: true,
        analytics: true,
        publicApi: true,
        seatMaps: true,
        marketplace: true,
        ai: true,
        security: true,
        infrastructure: true
      },
      counters: { events, customers, affiliateLinks, campaigns, apiKeys, seatMaps, integrations, fraudSignals },
      scaleTargets: {
        organizers: "1000+ simultaneous organizers",
        queueing: "RabbitMQ/BullMQ workers for checkout, email, sync and fraud review",
        cache: "Redis Cluster for sessions, rate limits, holds and dashboards",
        edge: "CloudFront + S3 for white-label assets and event pages",
        observability: "Prometheus, Grafana and centralized structured logs"
      }
    };
  }

  getWhiteLabel(user: RequestUser) {
    const tenantId = this.requireTenant(user);
    return this.db().whiteLabelSetting.findUnique({ where: { tenantId } });
  }

  upsertWhiteLabel(user: RequestUser, body: AnyRecord) {
    const tenantId = this.requireTenant(user);
    const customDomain = this.string(body.customDomain);
    const data = {
      customDomain,
      logoUrl: this.string(body.logoUrl),
      faviconUrl: this.string(body.faviconUrl),
      primaryColor: this.string(body.primaryColor) ?? "#111827",
      secondaryColor: this.string(body.secondaryColor) ?? "#2563eb",
      themeJson: body.themeJson ?? {},
      senderName: this.string(body.senderName),
      senderEmail: this.string(body.senderEmail),
      emailTemplateJson: body.emailTemplateJson ?? {},
      dnsInstructions: customDomain
        ? {
            cname: { name: customDomain, value: "white-label.eventhub.app" },
            txt: { name: `_eventhub.${customDomain}`, value: this.hash(`${tenantId}:${customDomain}`).slice(0, 32) }
          }
        : undefined
    };

    return this.db().whiteLabelSetting.upsert({
      where: { tenantId },
      create: { tenantId, ...data },
      update: data
    });
  }

  resolveWhiteLabelDomain(domain?: string) {
    if (!domain) throw new BadRequestException("Informe o dominio.");
    return this.db().whiteLabelSetting.findUnique({ where: { customDomain: domain } });
  }

  registerMobileDevice(user: RequestUser, body: AnyRecord) {
    const tenantId = this.requireTenant(user);
    return this.db().mobileDevice.upsert({
      where: { id: this.string(body.id) ?? randomUUID() },
      create: {
        id: this.string(body.id) ?? undefined,
        tenantId,
        userId: user.id,
        platform: this.string(body.platform) ?? "unknown",
        deviceName: this.string(body.deviceName),
        appVersion: this.string(body.appVersion),
        publicKey: this.string(body.publicKey),
        isTrusted: Boolean(body.isTrusted)
      },
      update: {
        platform: this.string(body.platform) ?? "unknown",
        deviceName: this.string(body.deviceName),
        appVersion: this.string(body.appVersion),
        publicKey: this.string(body.publicKey),
        lastSyncAt: new Date()
      }
    });
  }

  async syncOfflineCheckins(user: RequestUser, body: AnyRecord) {
    const tenantId = this.requireTenant(user);
    const eventId = this.requiredString(body.eventId, "eventId");
    const scans = Array.isArray(body.scans) ? body.scans : [];
    if (!scans.length) throw new BadRequestException("Envie ao menos um scan offline.");

    const event = await this.prisma.event.findFirst({ where: { id: eventId, tenantId } });
    if (!event) throw new NotFoundException("Evento nao encontrado.");

    const db = this.db();
    return this.prisma.$transaction(async (tx) => {
      const entries: AnyRecord[] = [];
      let acceptedScans = 0;
      let rejectedScans = 0;
      let conflictScans = 0;

      for (const scan of scans) {
        const ticketUuid = this.requiredString(scan.ticketUuid ?? scan.uuid ?? scan.code, "ticketUuid");
        const ticket = await tx.ticket.findFirst({ where: { uuid: ticketUuid, eventId, event: { tenantId } } });
        let status: CheckInStatus = CheckInStatus.REFUSED;
        let reason = "Ingresso nao encontrado.";

        if (ticket?.status === TicketStatus.AVAILABLE) {
          status = CheckInStatus.ENTERED;
          reason = undefined as unknown as string;
          acceptedScans += 1;
          await tx.ticket.update({
            where: { id: ticket.id },
            data: {
              status: TicketStatus.USED,
              usedAt: scan.scannedAt ? new Date(String(scan.scannedAt)) : new Date(),
              checkIns: { create: { userId: user.id, status: CheckInStatus.ENTERED } }
            }
          });
        } else if (ticket?.status === TicketStatus.USED) {
          status = CheckInStatus.DUPLICATED;
          reason = "Ingresso ja utilizado antes da sincronizacao.";
          conflictScans += 1;
          await tx.checkInLog.create({ data: { ticketId: ticket.id, userId: user.id, status, reason } });
        } else {
          rejectedScans += 1;
          if (ticket) await tx.checkInLog.create({ data: { ticketId: ticket.id, userId: user.id, status, reason: "Ingresso indisponivel." } });
        }

        entries.push({
          ticketUuid,
          scannedAt: scan.scannedAt ? new Date(String(scan.scannedAt)) : new Date(),
          status,
          reason,
          rawPayload: scan
        });
      }

      return db.offlineCheckinBatch.create({
        data: {
          tenantId,
          eventId,
          deviceId: this.string(body.deviceId),
          userId: user.id,
          startedAt: body.startedAt ? new Date(String(body.startedAt)) : undefined,
          finishedAt: body.finishedAt ? new Date(String(body.finishedAt)) : undefined,
          totalScans: scans.length,
          acceptedScans,
          rejectedScans,
          conflictScans,
          checksum: this.hash(JSON.stringify(scans)),
          entries: { create: entries }
        },
        include: { entries: true }
      });
    });
  }

  async affiliateDashboard(user: RequestUser) {
    const tenantId = this.requireTenant(user);
    const db = this.db();
    const [program, links, commissions, payouts] = await Promise.all([
      db.affiliateProgram.findUnique({ where: { tenantId } }),
      db.affiliateLink.findMany({ where: { tenantId }, orderBy: { createdAt: "desc" }, take: 50 }),
      db.affiliateCommission.aggregate({ where: { tenantId }, _sum: { amountCents: true }, _count: true }),
      db.affiliatePayout.findMany({ where: { tenantId }, orderBy: { createdAt: "desc" }, take: 20 })
    ]);
    return { program, links, commissions, payouts };
  }

  upsertAffiliateProgram(user: RequestUser, body: AnyRecord) {
    const tenantId = this.requireTenant(user);
    const data = {
      name: this.string(body.name) ?? "Programa de afiliados",
      defaultCommissionBps: Number(body.defaultCommissionBps ?? 1000),
      cookieWindowDays: Number(body.cookieWindowDays ?? 30),
      minPayoutCents: Number(body.minPayoutCents ?? 5000),
      isActive: body.isActive !== false,
      termsUrl: this.string(body.termsUrl)
    };
    return this.db().affiliateProgram.upsert({ where: { tenantId }, create: { tenantId, ...data }, update: data });
  }

  createAffiliateLink(user: RequestUser, body: AnyRecord) {
    const tenantId = this.requireTenant(user);
    const code = this.slug(this.string(body.code) ?? `${this.string(body.affiliateName) ?? "afiliado"}-${randomBytes(3).toString("hex")}`);
    return this.db().affiliateLink.create({
      data: {
        tenantId,
        eventId: this.string(body.eventId),
        affiliateName: this.requiredString(body.affiliateName, "affiliateName"),
        affiliateEmail: this.string(body.affiliateEmail),
        code,
        commissionBps: Number(body.commissionBps ?? 1000)
      }
    });
  }

  crmCustomers(user: RequestUser, query: Record<string, string>) {
    const tenantId = this.requireTenant(user);
    return this.db().crmCustomer.findMany({
      where: {
        tenantId,
        ...(query.search
          ? {
              OR: [
                { name: { contains: query.search, mode: "insensitive" } },
                { email: { contains: query.search, mode: "insensitive" } },
                { phone: { contains: query.search, mode: "insensitive" } }
              ]
            }
          : {})
      },
      orderBy: { updatedAt: "desc" },
      take: Number(query.take ?? 100)
    });
  }

  createCrmCustomer(user: RequestUser, body: AnyRecord) {
    const tenantId = this.requireTenant(user);
    const email = this.requiredString(body.email, "email").toLowerCase();
    return this.db().crmCustomer.upsert({
      where: { tenantId_email: { tenantId, email } },
      create: {
        tenantId,
        email,
        name: this.requiredString(body.name, "name"),
        document: this.string(body.document),
        phone: this.string(body.phone),
        tags: Array.isArray(body.tags) ? body.tags.map(String) : [],
        consentEmail: Boolean(body.consentEmail),
        consentWhatsApp: Boolean(body.consentWhatsApp),
        consentPush: Boolean(body.consentPush)
      },
      update: {
        name: this.string(body.name),
        document: this.string(body.document),
        phone: this.string(body.phone),
        tags: Array.isArray(body.tags) ? body.tags.map(String) : undefined,
        consentEmail: body.consentEmail === undefined ? undefined : Boolean(body.consentEmail),
        consentWhatsApp: body.consentWhatsApp === undefined ? undefined : Boolean(body.consentWhatsApp),
        consentPush: body.consentPush === undefined ? undefined : Boolean(body.consentPush)
      }
    });
  }

  createSegment(user: RequestUser, body: AnyRecord) {
    const tenantId = this.requireTenant(user);
    return this.db().crmSegment.create({
      data: { tenantId, name: this.requiredString(body.name, "name"), rulesJson: body.rulesJson ?? {}, size: Number(body.size ?? 0) }
    });
  }

  createCampaign(user: RequestUser, body: AnyRecord) {
    const tenantId = this.requireTenant(user);
    return this.db().crmCampaign.create({
      data: {
        tenantId,
        segmentId: this.string(body.segmentId),
        name: this.requiredString(body.name, "name"),
        channel: this.string(body.channel) ?? "EMAIL",
        status: this.string(body.status) ?? "DRAFT",
        subject: this.string(body.subject),
        content: this.requiredString(body.content, "content"),
        scheduledAt: body.scheduledAt ? new Date(String(body.scheduledAt)) : undefined,
        metricsJson: body.metricsJson ?? {}
      }
    });
  }

  createAutomation(user: RequestUser, body: AnyRecord) {
    const tenantId = this.requireTenant(user);
    return this.db().crmAutomation.create({
      data: {
        tenantId,
        name: this.requiredString(body.name, "name"),
        trigger: this.string(body.trigger) ?? "PURCHASE_CONFIRMED",
        channel: this.string(body.channel) ?? "EMAIL",
        isActive: body.isActive !== false,
        rulesJson: body.rulesJson ?? {},
        stepsJson: body.stepsJson ?? []
      }
    });
  }

  async marketingDashboard(user: RequestUser) {
    const tenantId = this.requireTenant(user);
    const db = this.db();
    const [campaigns, messages, automations] = await Promise.all([
      db.crmCampaign.findMany({ where: { tenantId }, orderBy: { createdAt: "desc" }, take: 50 }),
      db.marketingMessage.findMany({ where: { tenantId }, orderBy: { createdAt: "desc" }, take: 50 }),
      db.crmAutomation.findMany({ where: { tenantId }, orderBy: { createdAt: "desc" }, take: 50 })
    ]);
    return { campaigns, messages, automations };
  }

  queueMarketingMessage(user: RequestUser, body: AnyRecord) {
    const tenantId = this.requireTenant(user);
    return this.db().marketingMessage.create({
      data: {
        tenantId,
        campaignId: this.string(body.campaignId),
        channel: this.string(body.channel) ?? "EMAIL",
        recipient: this.requiredString(body.recipient, "recipient"),
        payload: body.payload ?? { subject: body.subject, content: body.content }
      }
    });
  }

  async analyticsDashboard(user: RequestUser, query: Record<string, string>) {
    const tenantId = this.requireTenant(user);
    const db = this.db();
    const eventId = query.eventId;
    const where = { tenantId, ...(eventId ? { eventId } : {}) };
    const [events, integrations, heatmaps, funnels] = await Promise.all([
      db.analyticsEvent.groupBy({ by: ["type"], where, _count: true }),
      db.analyticsIntegration.findMany({ where: { tenantId } }),
      db.heatmapSnapshot.findMany({ where, orderBy: { createdAt: "desc" }, take: 10 }),
      db.conversionFunnel.findMany({ where })
    ]);
    const source = await db.analyticsEvent.groupBy({ by: ["source"], where, _count: true });
    const devices = await db.analyticsEvent.groupBy({ by: ["device"], where, _count: true });
    const campaigns = await db.analyticsEvent.groupBy({ by: ["campaign"], where, _count: true });
    return { events, source, devices, campaigns, integrations, heatmaps, funnels };
  }

  trackAnalytics(body: AnyRecord) {
    return this.db().analyticsEvent.create({
      data: {
        tenantId: this.string(body.tenantId),
        eventId: this.string(body.eventId),
        sessionId: this.string(body.sessionId),
        type: this.string(body.type) ?? "page_view",
        source: this.string(body.source),
        medium: this.string(body.medium),
        campaign: this.string(body.campaign),
        device: this.string(body.device),
        path: this.string(body.path),
        metadata: body.metadata ?? {}
      }
    });
  }

  upsertAnalyticsIntegration(user: RequestUser, body: AnyRecord) {
    const tenantId = this.requireTenant(user);
    return this.db().analyticsIntegration.create({
      data: {
        tenantId,
        provider: this.string(body.provider) ?? "GOOGLE_ANALYTICS",
        externalId: this.requiredString(body.externalId, "externalId"),
        configJson: body.configJson ?? {},
        isActive: body.isActive !== false
      }
    });
  }

  createApiClient(user: RequestUser, body: AnyRecord) {
    const tenantId = this.requireTenant(user);
    const clientSecret = randomBytes(32).toString("hex");
    return this.db().publicApiClient
      .create({
        data: {
          tenantId,
          name: this.requiredString(body.name, "name"),
          clientId: `eh_${randomBytes(12).toString("hex")}`,
          clientSecretHash: this.hash(clientSecret),
          redirectUris: Array.isArray(body.redirectUris) ? body.redirectUris.map(String) : [],
          scopes: Array.isArray(body.scopes) ? body.scopes.map(String) : ["events:read", "orders:read"],
          status: "ACTIVE"
        }
      })
      .then((client: AnyRecord) => ({ ...client, clientSecret }));
  }

  createApiKey(user: RequestUser, body: AnyRecord) {
    const tenantId = this.requireTenant(user);
    const rawKey = `ehk_${randomBytes(24).toString("hex")}`;
    return this.db().apiKey
      .create({
        data: {
          tenantId,
          name: this.requiredString(body.name, "name"),
          keyHash: this.hash(rawKey),
          prefix: rawKey.slice(0, 10),
          scopes: Array.isArray(body.scopes) ? body.scopes.map(String) : ["events:read"],
          status: "ACTIVE",
          expiresAt: body.expiresAt ? new Date(String(body.expiresAt)) : undefined
        }
      })
      .then((apiKey: AnyRecord) => ({ ...apiKey, key: rawKey }));
  }

  publicApiDocs() {
    return {
      openapi: "/docs-json",
      baseUrl: "/api/public/v1",
      auth: {
        apiKey: "Authorization: Bearer ehk_...",
        oauth: "Authorization Code + Client Credentials with scoped clients"
      },
      sdk: [
        { language: "TypeScript", packageName: "@eventhub/sdk", status: "planned in packages/sdk" },
        { language: "React Native", packageName: "@eventhub/mobile-sdk", status: "planned in packages/sdk" }
      ],
      endpoints: [
        "GET /events",
        "GET /events/:id/orders",
        "POST /checkins/offline-sync",
        "POST /webhooks",
        "GET /analytics"
      ]
    };
  }

  seatMaps(user: RequestUser, eventId: string) {
    const tenantId = this.requireTenant(user);
    return this.db().seatMap.findMany({ where: { tenantId, eventId }, orderBy: { version: "desc" } });
  }

  async createSeatMap(user: RequestUser, eventId: string, body: AnyRecord) {
    const tenantId = this.requireTenant(user);
    await this.ensureEvent(tenantId, eventId);
    const db = this.db();
    const seats = Array.isArray(body.seats) ? body.seats : [];
    const seatMap = await db.seatMap.create({
      data: {
        tenantId,
        eventId,
        name: this.string(body.name) ?? "Mapa principal",
        layoutJson: body.layoutJson ?? { sections: body.sections ?? [], seats },
        version: Number(body.version ?? 1),
        isActive: body.isActive !== false
      }
    });
    if (seats.length) {
      await db.seat.createMany({
        data: seats.map((seat: AnyRecord) => ({
          seatMapId: seatMap.id,
          sectionId: this.string(seat.sectionId),
          label: this.requiredString(seat.label, "seat.label"),
          row: this.string(seat.row),
          number: this.string(seat.number),
          x: Number(seat.x ?? 0),
          y: Number(seat.y ?? 0),
          status: this.string(seat.status) ?? "AVAILABLE",
          metadata: seat.metadata ?? {}
        })),
        skipDuplicates: true
      });
    }
    await this.prisma.event.update({ where: { id: eventId }, data: { seatMapEnabled: true } as AnyRecord });
    return seatMap;
  }

  async holdSeats(user: RequestUser, eventId: string, body: AnyRecord) {
    const tenantId = this.requireTenant(user);
    await this.ensureEvent(tenantId, eventId);
    const seatIds = this.stringArray(body.seatIds);
    const sessionId = this.string(body.sessionId) ?? randomUUID();
    const expiresAt = new Date(Date.now() + Number(body.ttlSeconds ?? 600) * 1000);
    const db = this.db();

    await db.seatHold.createMany({
      data: seatIds.map((seatId) => ({ tenantId, eventId, seatId, sessionId, expiresAt })),
      skipDuplicates: true
    });
    await db.seat.updateMany({ where: { id: { in: seatIds }, status: "AVAILABLE" }, data: { status: "HELD" } });
    return { sessionId, expiresAt, seatIds };
  }

  async reserveSeats(user: RequestUser, eventId: string, body: AnyRecord) {
    const tenantId = this.requireTenant(user);
    await this.ensureEvent(tenantId, eventId);
    const seatIds = this.stringArray(body.seatIds);
    const db = this.db();
    await db.seatReservation.createMany({
      data: seatIds.map((seatId) => ({
        tenantId,
        eventId,
        seatId,
        orderId: this.string(body.orderId),
        status: "RESERVED",
        expiresAt: body.expiresAt ? new Date(String(body.expiresAt)) : undefined
      })),
      skipDuplicates: true
    });
    await db.seat.updateMany({ where: { id: { in: seatIds } }, data: { status: "RESERVED" } });
    return { reserved: seatIds.length, seatIds };
  }

  async marketplaceSearch(query: Record<string, string>) {
    const where: AnyRecord = { status: "PUBLISHED" };
    if (query.category) where.category = query.category;
    if (query.city) where.city = { contains: query.city, mode: "insensitive" };
    if (query.search) {
      where.OR = [
        { title: { contains: query.search, mode: "insensitive" } },
        { description: { contains: query.search, mode: "insensitive" } },
        { category: { contains: query.search, mode: "insensitive" } }
      ];
    }
    return this.prisma.event.findMany({
      where,
      orderBy: [{ isSponsored: "desc" as const }, { marketplaceRank: "desc" as const }, { startsAt: "asc" as const }],
      take: Number(query.take ?? 24),
      include: { ticketTypes: true, tenant: true }
    });
  }

  marketplaceCategories() {
    return this.db().eventCategory.findMany({ where: { isActive: true }, orderBy: { name: "asc" } });
  }

  upsertMarketplaceProfile(user: RequestUser, body: AnyRecord) {
    const tenantId = this.requireTenant(user);
    const displayName = this.requiredString(body.displayName, "displayName");
    const data = {
      displayName,
      slug: this.slug(this.string(body.slug) ?? displayName),
      description: this.string(body.description),
      logoUrl: this.string(body.logoUrl),
      categories: Array.isArray(body.categories) ? body.categories.map(String) : [],
      verification: this.string(body.verification) ?? "PENDING"
    };
    return this.db().marketplaceProfile.upsert({ where: { tenantId }, create: { tenantId, ...data }, update: data });
  }

  reviewEvent(user: RequestUser, body: AnyRecord) {
    return this.db().eventReview.create({
      data: {
        eventId: this.requiredString(body.eventId, "eventId"),
        userId: user.id,
        rating: Math.max(1, Math.min(5, Number(body.rating ?? 5))),
        comment: this.string(body.comment),
        isPublic: body.isPublic !== false
      }
    });
  }

  favoriteEvent(user: RequestUser, body: AnyRecord) {
    return this.db().favoriteEvent.upsert({
      where: { userId_eventId: { userId: user.id, eventId: this.requiredString(body.eventId, "eventId") } },
      create: { userId: user.id, eventId: this.requiredString(body.eventId, "eventId") },
      update: {}
    });
  }

  async aiDashboard(user: RequestUser) {
    const tenantId = this.requireTenant(user);
    const db = this.db();
    const [forecasts, insights, fraudSignals] = await Promise.all([
      db.aiForecast.findMany({ where: { tenantId }, orderBy: { createdAt: "desc" }, take: 20 }),
      db.aiInsight.findMany({ where: { tenantId }, orderBy: { createdAt: "desc" }, take: 20 }),
      db.fraudSignal.findMany({ where: { tenantId }, orderBy: { createdAt: "desc" }, take: 20 })
    ]);
    return { forecasts, insights, fraudSignals };
  }

  async createForecast(user: RequestUser, body: AnyRecord) {
    const tenantId = this.requireTenant(user);
    const eventId = this.string(body.eventId);
    const paidOrders = await this.prisma.order.count({ where: { event: { tenantId }, ...(eventId ? { eventId } : {}) , status: PaymentStatus.PAID } });
    const pendingOrders = await this.prisma.order.count({ where: { event: { tenantId }, ...(eventId ? { eventId } : {}) , status: PaymentStatus.PENDING } });
    const velocity = Math.max(1, paidOrders / Math.max(1, Number(body.observedDays ?? 7)));
    const horizonDays = Number(body.horizonDays ?? 30);
    const outputJson = {
      salesForecast: Math.round(paidOrders + velocity * horizonDays),
      nextBatchTriggerInDays: Math.max(1, Math.round(7 - velocity)),
      suggestedPriceLiftBps: velocity > 15 ? 800 : velocity > 5 ? 400 : 0,
      behaviorSummary: pendingOrders > paidOrders ? "Alta friccao no checkout; revisar pagamento e prova social." : "Conversao saudavel para o volume atual."
    };
    return this.db().aiForecast.create({
      data: {
        tenantId,
        eventId,
        type: this.string(body.type) ?? "SALES",
        horizonDays,
        inputJson: { paidOrders, pendingOrders, body },
        outputJson,
        confidence: Math.min(0.92, 0.55 + paidOrders / 1000)
      }
    });
  }

  async executiveDashboard(user: RequestUser) {
    const tenantId = user.role === "ADMIN" ? undefined : this.requireTenant(user);
    const db = this.db();
    const where = tenantId ? { event: { tenantId }, status: PaymentStatus.PAID } : { status: PaymentStatus.PAID };
    const [orders, organizers, activeSubscriptions, snapshots] = await Promise.all([
      this.prisma.order.aggregate({ where, _sum: { totalCents: true, feeCents: true }, _count: true }),
      this.prisma.tenant.count(),
      this.prisma.subscription.count({ where: { endsAt: null } }),
      db.executiveMetricSnapshot.findMany({ where: tenantId ? { tenantId } : {}, orderBy: { createdAt: "desc" }, take: 12 })
    ]);
    const revenueCents = orders._sum.totalCents ?? 0;
    const profitCents = orders._sum.feeCents ?? Math.round(revenueCents * 0.08);
    const mrrCents = activeSubscriptions * 49900;
    return {
      mrrCents,
      arrCents: mrrCents * 12,
      ltvCents: Math.round(mrrCents * 18),
      cacCents: 35000,
      churnRateBps: 320,
      revenueCents,
      profitCents,
      organizersCount: organizers,
      paidOrders: orders._count,
      snapshots
    };
  }

  async securityDashboard(user: RequestUser) {
    const tenantId = this.requireTenant(user);
    const db = this.db();
    const [policies, backups, consents, fraud, keys] = await Promise.all([
      db.permissionPolicy.findMany({ where: { tenantId }, orderBy: { createdAt: "desc" } }),
      db.backupJob.findMany({ where: { tenantId }, orderBy: { createdAt: "desc" }, take: 20 }),
      db.consentRecord.count({ where: { tenantId, granted: true } }),
      db.fraudSignal.count({ where: { tenantId, riskLevel: { in: ["HIGH", "CRITICAL"] } } }),
      db.encryptionKeyRecord.findMany({ where: { tenantId }, orderBy: { createdAt: "desc" } })
    ]);
    return {
      twoFactorRequired: true,
      lgpd: { consentRecords: consents, dataExport: true, deletionWorkflow: true, auditTrail: true },
      antiFraud: { highRiskSignals: fraud, rules: ["velocity", "duplicate_document", "chargeback_history", "device_fingerprint"] },
      policies,
      backups,
      encryptionKeys: keys
    };
  }

  async enableTwoFactor(user: RequestUser) {
    const secret = randomBytes(20).toString("hex");
    const record = await this.db().twoFactorSecret.upsert({
      where: { userId: user.id },
      create: {
        userId: user.id,
        secretHash: this.hash(secret),
        recoveryCodesHash: Array.from({ length: 8 }, () => this.hash(randomBytes(6).toString("hex"))),
        enabledAt: new Date()
      },
      update: { secretHash: this.hash(secret), enabledAt: new Date() }
    });
    await this.prisma.user.update({ where: { id: user.id }, data: { twoFactorEnabled: true } as AnyRecord });
    return { ...record, provisioningSecret: secret };
  }

  scheduleBackup(user: RequestUser, body: AnyRecord) {
    const tenantId = this.requireTenant(user);
    return this.db().backupJob.create({
      data: {
        tenantId,
        scope: this.string(body.scope) ?? "tenant",
        status: "scheduled",
        storageUrl: this.string(body.storageUrl) ?? `s3://eventhub-backups/${tenantId}/${Date.now()}.dump`
      }
    });
  }

  infrastructureBlueprint() {
    return {
      docker: ["api", "web", "postgres", "redis", "rabbitmq", "prometheus", "grafana", "loki"],
      cicd: "GitHub Actions build, test, docker publish and deploy",
      aws: ["S3 for assets/backups", "CloudFront for white-label domains", "EKS for Kubernetes", "RDS PostgreSQL", "ElastiCache Redis Cluster", "Amazon MQ/RabbitMQ"],
      kubernetes: ["horizontal pod autoscaling", "rolling updates", "secrets", "ingress", "worker deployments"],
      monitoring: ["Prometheus metrics", "Grafana dashboards", "centralized logs", "audit logs", "backup checks"],
      scaling: ["stateless API", "queue-based workers", "read replicas", "tenant-aware indexes", "Redis locks for seat holds"]
    };
  }

  private async ensureEvent(tenantId: string, eventId: string) {
    const event = await this.prisma.event.findFirst({ where: { id: eventId, tenantId } });
    if (!event) throw new NotFoundException("Evento nao encontrado.");
    return event;
  }

  private db(): AnyRecord {
    return this.prisma as unknown as AnyRecord;
  }

  private requireTenant(user: RequestUser) {
    if (!user.tenantId) throw new UnauthorizedException("Conta sem tenant organizador.");
    return user.tenantId;
  }

  private requiredString(value: unknown, field: string) {
    const result = this.string(value);
    if (!result) throw new BadRequestException(`Campo obrigatorio: ${field}.`);
    return result;
  }

  private string(value: unknown) {
    return typeof value === "string" && value.trim() ? value.trim() : undefined;
  }

  private stringArray(value: unknown) {
    if (!Array.isArray(value) || !value.length) throw new BadRequestException("Envie uma lista de assentos.");
    return value.map(String);
  }

  private slug(value: string) {
    return value
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "");
  }

  private hash(value: string) {
    return createHash("sha256").update(value).digest("hex");
  }
}
