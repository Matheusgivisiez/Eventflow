import { Injectable, BadRequestException, NotFoundException, ConflictException } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { PromoterStatus, UserRole } from "@prisma/client";
import * as bcrypt from "bcryptjs";
import { randomBytes } from "crypto";

@Injectable()
export class PromotersService {
  constructor(private readonly prisma: PrismaService) {}

  async list(tenantId: string) {
    return this.prisma.promoter.findMany({
      where: { tenantId },
      include: {
        user: { select: { name: true, email: true, phone: true } },
        _count: { select: { eventLinks: true } }
      },
      orderBy: { createdAt: "desc" }
    });
  }

  async create(tenantId: string, data: { name: string; email: string; phone?: string; document?: string; pixKey?: string; password?: string }) {
    const existingUser = await this.prisma.user.findUnique({ where: { email: data.email } });

    let userId = existingUser?.id;

    if (!existingUser) {
      if (!data.password) throw new BadRequestException("Senha obrigatória para novos usuários.");
      const passwordHash = await bcrypt.hash(data.password, 10);
      const newUser = await this.prisma.user.create({
        data: {
          name: data.name,
          email: data.email,
          phone: data.phone,
          passwordHash,
          role: UserRole.PROMOTER,
        }
      });
      userId = newUser.id;
    } else {
      // Upgrade role only if user is a basic customer
      if (existingUser.role === UserRole.CUSTOMER) {
        await this.prisma.user.update({ where: { id: existingUser.id }, data: { role: UserRole.PROMOTER } });
      }
    }

    const existingPromoter = await this.prisma.promoter.findUnique({ where: { userId } });
    if (existingPromoter) {
      // If the promoter already exists, associate it with this tenant if not already
      if (existingPromoter.tenantId !== tenantId) {
        throw new BadRequestException("Este usuário já é promoter em outra plataforma.");
      }
      throw new ConflictException("Este usuário já é promoter nesta plataforma.");
    }

    return this.prisma.promoter.create({
      data: {
        userId: userId!,
        tenantId,
        document: data.document,
        pixKey: data.pixKey,
        status: PromoterStatus.PENDING // Requires organizer approval before going ACTIVE
      },
      include: { user: { select: { name: true, email: true } } }
    });
  }

  async updateStatus(tenantId: string, promoterId: string, status: PromoterStatus) {
    const promoter = await this.prisma.promoter.findFirst({ where: { id: promoterId, tenantId } });
    if (!promoter) throw new NotFoundException("Promoter não encontrado.");

    return this.prisma.promoter.update({
      where: { id: promoterId },
      data: { status }
    });
  }

  async getPerformance(tenantId: string, promoterId: string) {
    const promoter = await this.prisma.promoter.findFirst({
      where: { id: promoterId, tenantId },
      include: { user: { select: { name: true, email: true } } }
    });
    if (!promoter) throw new NotFoundException("Promoter não encontrado.");

    const links = await this.prisma.promoterLink.findMany({
      where: { promoterId },
      include: { event: { select: { id: true, title: true, slug: true, startsAt: true } } }
    });

    const paidOrders = await this.prisma.order.findMany({
      where: {
        promoterLinkId: { in: links.map(l => l.id) },
        status: "PAID"
      },
      select: {
        id: true,
        promoterLinkId: true,
        promoterCommissionCents: true,
        totalCents: true,
        createdAt: true,
        event: { select: { title: true } }
      }
    });

    const linksWithStats = links.map(link => {
      const orders = paidOrders.filter(o => o.promoterLinkId === link.id);
      return {
        ...link,
        paidConversions: orders.length,
        paidRevenueCents: orders.reduce((s, o) => s + o.totalCents, 0),
        paidCommissionCents: orders.reduce((s, o) => s + o.promoterCommissionCents, 0),
      };
    });

    return {
      promoter,
      links: linksWithStats,
      totals: {
        totalPaidConversions: linksWithStats.reduce((s, l) => s + l.paidConversions, 0),
        totalPaidRevenueCents: linksWithStats.reduce((s, l) => s + l.paidRevenueCents, 0),
        totalPaidCommissionCents: linksWithStats.reduce((s, l) => s + l.paidCommissionCents, 0),
        totalClicks: linksWithStats.reduce((s, l) => s + l.clicks, 0),
      }
    };
  }

  async listEventLinks(tenantId: string, eventId: string) {
    // Verify the event belongs to this tenant
    const event = await this.prisma.event.findFirst({ where: { id: eventId, tenantId } });
    if (!event) throw new NotFoundException("Evento não encontrado.");

    return this.prisma.promoterLink.findMany({
      where: { eventId },
      include: { promoter: { include: { user: { select: { name: true, email: true } } } } }
    });
  }

  async addPromoterToEvent(tenantId: string, eventId: string, data: { promoterId: string; commissionType: string; commissionValue: number; code?: string }) {
    const event = await this.prisma.event.findFirst({ where: { id: eventId, tenantId } });
    if (!event) throw new NotFoundException("Evento não encontrado.");

    const promoter = await this.prisma.promoter.findFirst({ where: { id: data.promoterId, tenantId } });
    if (!promoter) throw new NotFoundException("Promoter não encontrado.");

    if (promoter.status !== PromoterStatus.ACTIVE) {
      throw new BadRequestException("Promoter deve estar ativo para ser vinculado a um evento.");
    }

    // Check for existing link — unique constraint (promoterId, eventId)
    const existingLink = await this.prisma.promoterLink.findFirst({
      where: { promoterId: data.promoterId, eventId }
    });
    if (existingLink) {
      throw new ConflictException("Este promoter já está vinculado a este evento.");
    }

    const code = data.code || (await this.generateUniqueCode(event.slug));

    return this.prisma.promoterLink.create({
      data: {
        promoterId: data.promoterId,
        eventId,
        code,
        commissionType: data.commissionType,
        commissionValue: data.commissionValue,
      },
      include: { promoter: { include: { user: { select: { name: true, email: true } } } } }
    });
  }

  async updatePromoterLink(tenantId: string, eventId: string, linkId: string, data: { commissionType?: string; commissionValue?: number; isActive?: boolean }) {
    // Verify ownership
    const link = await this.prisma.promoterLink.findFirst({
      where: { id: linkId, eventId, event: { tenantId } }
    });
    if (!link) throw new NotFoundException("Link de promoter não encontrado.");

    return this.prisma.promoterLink.update({
      where: { id: linkId },
      data: {
        commissionType: data.commissionType,
        commissionValue: data.commissionValue,
        isActive: data.isActive,
      },
      include: { promoter: { include: { user: { select: { name: true, email: true } } } } }
    });
  }

  async removePromoterFromEvent(tenantId: string, eventId: string, linkId: string) {
    // Verify ownership
    const link = await this.prisma.promoterLink.findFirst({
      where: { id: linkId, eventId, event: { tenantId } }
    });
    if (!link) throw new NotFoundException("Link de promoter não encontrado.");

    await this.prisma.promoterLink.delete({ where: { id: linkId } });
    return { success: true };
  }

  async getEventRanking(tenantId: string, eventId: string) {
    const event = await this.prisma.event.findFirst({ where: { id: eventId, tenantId } });
    if (!event) throw new NotFoundException("Evento não encontrado.");

    const links = await this.prisma.promoterLink.findMany({
      where: { eventId },
      include: { promoter: { include: { user: { select: { name: true, email: true } } } } },
      orderBy: { commissionAcumCents: "desc" }
    });

    return links.map((link, index) => ({
      rank: index + 1,
      promoter: link.promoter.user,
      code: link.code,
      clicks: link.clicks,
      conversions: link.conversions,
      revenueCents: link.revenueCents,
      commissionAcumCents: link.commissionAcumCents,
    }));
  }

  async trackClick(code: string): Promise<{ eventSlug: string }> {
    const link = await this.prisma.promoterLink.findFirst({
      where: { code, isActive: true },
      include: { event: { select: { slug: true } } }
    });
    if (!link) throw new NotFoundException("Link inválido ou desativado.");

    // Increment click counter asynchronously — do not block the redirect
    void this.prisma.promoterLink.update({
      where: { id: link.id },
      data: { clicks: { increment: 1 } }
    }).catch(() => undefined); // Non-critical — ignore errors

    return { eventSlug: link.event.slug };
  }

  async withdrawals(tenantId: string) {
    return this.prisma.promoterWithdrawal.findMany({
      where: { promoter: { tenantId } },
      include: { promoter: { include: { user: { select: { name: true, email: true } } } } },
      orderBy: { requestedAt: "desc" }
    });
  }

  private async generateUniqueCode(eventSlug: string, attempt = 0): Promise<string> {
    if (attempt > 5) throw new BadRequestException("Não foi possível gerar um código único. Tente informar um código manualmente.");
    const suffix = randomBytes(4).toString("hex"); // 8 hex chars — 4 billion combinations
    const code = `${eventSlug.substring(0, 8)}-${suffix}`.toLowerCase().replace(/[^a-z0-9-]/g, "");
    const existing = await this.prisma.promoterLink.findFirst({ where: { code } });
    if (existing) return this.generateUniqueCode(eventSlug, attempt + 1);
    return code;
  }
}
