import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../../prisma/prisma.service";
import { RequestUser } from "../../../common/types/request-user";
import { EnterpriseDomainService } from "./enterprise-domain.service";

type ReadinessStatus = "not_started" | "prototype" | "partial" | "production_ready";

type ReadinessEntry = {
  status: ReadinessStatus;
  label: string;
  evidence: string;
};

@Injectable()
export class EnterpriseOverviewService extends EnterpriseDomainService {
  constructor(prisma: PrismaService) {
    super(prisma);
  }

  async overview(user: RequestUser) {
    const tenantId = this.requireTenant(user);
    const db = this.db();
    const [
      events,
      customers,
      crmSegments,
      affiliateProgram,
      affiliateLinks,
      campaigns,
      automations,
      marketingMessages,
      apiClients,
      apiKeys,
      seatMaps,
      inactiveSeatMaps,
      integrations,
      analyticsEvents,
      fraudSignals,
      whiteLabel,
      mobileDevices,
      offlineBatches,
      marketplaceProfile,
      forecasts,
      insights,
      policies,
      backups,
      encryptionKeys
    ] = await Promise.all([
      this.prisma.event.count({ where: { tenantId } }),
      db.crmCustomer.count({ where: { tenantId } }),
      db.crmSegment.count({ where: { tenantId } }),
      db.affiliateProgram.findUnique({ where: { tenantId } }),
      db.affiliateLink.count({ where: { tenantId } }),
      db.crmCampaign.count({ where: { tenantId } }),
      db.crmAutomation.count({ where: { tenantId } }),
      db.marketingMessage.count({ where: { tenantId } }),
      db.publicApiClient.count({ where: { tenantId, status: "ACTIVE" } }),
      db.apiKey.count({ where: { tenantId, status: "ACTIVE" } }),
      db.seatMap.count({ where: { tenantId, isActive: true } }),
      db.seatMap.count({ where: { tenantId, isActive: false } }),
      db.analyticsIntegration.count({ where: { tenantId, isActive: true } }),
      db.analyticsEvent.count({ where: { tenantId } }),
      db.fraudSignal.count({ where: { tenantId, riskLevel: { in: ["HIGH", "CRITICAL"] } } }),
      db.whiteLabelSetting.findUnique({ where: { tenantId } }),
      db.mobileDevice.count({ where: { tenantId } }),
      db.offlineCheckinBatch.count({ where: { tenantId } }),
      db.marketplaceProfile.findUnique({ where: { tenantId } }),
      db.aiForecast.count({ where: { tenantId } }),
      db.aiInsight.count({ where: { tenantId } }),
      db.permissionPolicy.count({ where: { tenantId } }),
      db.backupJob.count({ where: { tenantId } }),
      db.encryptionKeyRecord.count({ where: { tenantId } })
    ]);

    const readiness = {
      whiteLabel: this.status(Boolean(whiteLabel?.customDomain && whiteLabel?.senderEmail), Boolean(whiteLabel), {
        production: "Dominio e remetente configurados.",
        partial: "Configuracao de marca iniciada.",
        empty: "Sem configuracao white-label para este tenant."
      }),
      mobileOffline: this.status(mobileDevices > 0 && offlineBatches > 0, mobileDevices > 0, {
        production: "Dispositivos e batches offline ja sincronizaram.",
        partial: "Dispositivos moveis registrados, sem batch offline sincronizado.",
        empty: "Nenhum dispositivo mobile registrado."
      }),
      affiliates: this.status(Boolean(affiliateProgram?.isActive && affiliateLinks > 0), Boolean(affiliateProgram || affiliateLinks > 0), {
        production: "Programa ativo com links de afiliado.",
        partial: "Programa ou links criados parcialmente.",
        empty: "Afiliados sem configuracao para este tenant."
      }),
      crm: this.status(customers > 0 && crmSegments > 0, customers > 0 || crmSegments > 0, {
        production: "Clientes e segmentos cadastrados.",
        partial: "Base CRM iniciada sem segmentacao completa.",
        empty: "CRM sem clientes ou segmentos."
      }),
      marketingAutomation: this.status(campaigns > 0 && automations > 0, campaigns > 0 || automations > 0 || marketingMessages > 0, {
        production: "Campanhas e automacoes configuradas.",
        partial: "Marketing iniciado sem automacao completa.",
        empty: "Marketing automation sem campanhas."
      }),
      analytics: this.status(integrations > 0 && analyticsEvents > 0, integrations > 0 || analyticsEvents > 0, {
        production: "Integracao ativa com eventos coletados.",
        partial: "Analytics iniciado sem integracao/eventos completos.",
        empty: "Analytics sem dados reais para este tenant."
      }),
      publicApi: this.status(apiClients > 0 && apiKeys > 0, apiClients > 0 || apiKeys > 0, {
        production: "Cliente OAuth e API key ativos.",
        partial: "API publica parcialmente configurada.",
        empty: "API publica sem credenciais emitidas."
      }),
      seatMaps: this.status(seatMaps > 0, inactiveSeatMaps > 0, {
        production: "Mapa de assentos ativo em uso.",
        partial: "Mapa criado, mas ainda inativo.",
        empty: "Assentos numerados sem mapa configurado."
      }),
      marketplace: this.status(marketplaceProfile?.verification === "APPROVED", Boolean(marketplaceProfile), {
        production: "Perfil de marketplace aprovado.",
        partial: "Perfil de marketplace criado e pendente.",
        empty: "Marketplace sem perfil do organizador."
      }),
      ai: this.status(forecasts > 0 && insights > 0, forecasts > 0 || insights > 0 || fraudSignals > 0, {
        production: "Previsoes e insights gerados.",
        partial: "IA com sinais ou previsoes parciais.",
        empty: "IA sem historico suficiente para este tenant.",
        emptyStatus: "prototype"
      }),
      security: this.status(policies > 0 && backups > 0 && encryptionKeys > 0, policies > 0 || backups > 0 || encryptionKeys > 0, {
        production: "Politicas, backups e chaves registrados.",
        partial: "Seguranca operacional parcialmente configurada.",
        empty: "Seguranca enterprise sem politicas/backups reais."
      }),
      infrastructure: this.status(false, events > 0, {
        production: "Checks reais de infraestrutura ativos.",
        partial: "Tenant em operacao, mas sem health checks enterprise.",
        empty: "Blueprint documentado, sem telemetria real conectada.",
        emptyStatus: "prototype"
      })
    };

    return {
      tenantId,
      readiness,
      counters: {
        events,
        customers,
        crmSegments,
        affiliateLinks,
        campaigns,
        automations,
        marketingMessages,
        apiClients,
        apiKeys,
        seatMaps,
        integrations,
        analyticsEvents,
        fraudSignals,
        mobileDevices,
        offlineBatches,
        forecasts,
        insights,
        policies,
        backups,
        encryptionKeys
      },
      scaleTargets: {
        organizers: "1000+ simultaneous organizers",
        queueing: "RabbitMQ/BullMQ workers for checkout, email, sync and fraud review",
        cache: "Redis Cluster for sessions, rate limits, holds and dashboards",
        edge: "CloudFront + S3 for white-label assets and event pages",
        observability: "Prometheus, Grafana and centralized structured logs"
      }
    };
  }

  private status(
    productionReady: boolean,
    partial: boolean,
    labels: { production: string; partial: string; empty: string; emptyStatus?: Extract<ReadinessStatus, "not_started" | "prototype"> }
  ): ReadinessEntry {
    if (productionReady) {
      return { status: "production_ready", label: "Production ready", evidence: labels.production };
    }

    if (partial) {
      return { status: "partial", label: "Partial", evidence: labels.partial };
    }

    const emptyStatus = labels.emptyStatus ?? "not_started";
    return { status: emptyStatus, label: emptyStatus === "prototype" ? "Prototype" : "Not started", evidence: labels.empty };
  }
}
