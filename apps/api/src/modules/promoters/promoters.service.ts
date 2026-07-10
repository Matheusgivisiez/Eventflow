import { Injectable, BadRequestException, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { PromoterStatus, UserRole } from "@prisma/client";
import * as bcrypt from "bcryptjs";

@Injectable()
export class PromotersService {
  constructor(private readonly prisma: PrismaService) {}

  async list(tenantId: string) {
    return this.prisma.promoter.findMany({
      where: { tenantId },
      include: { user: { select: { name: true, email: true, phone: true } }, _count: { select: { eventLinks: true } } },
      orderBy: { createdAt: "desc" }
    });
  }

  async create(tenantId: string, data: { name: string; email: string; phone?: string; document?: string; pixKey?: string; password?: string }) {
    const existingUser = await this.prisma.user.findUnique({ where: { email: data.email } });
    
    let userId = existingUser?.id;

    if (!existingUser) {
      if (!data.password) throw new BadRequestException("Password required for new users.");
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
      // Upgrade role if necessary
      if (existingUser.role === UserRole.CUSTOMER) {
        await this.prisma.user.update({ where: { id: existingUser.id }, data: { role: UserRole.PROMOTER } });
      }
    }

    const existingPromoter = await this.prisma.promoter.findUnique({ where: { userId } });
    if (existingPromoter) throw new BadRequestException("User is already a promoter.");

    return this.prisma.promoter.create({
      data: {
        userId: userId!,
        tenantId,
        document: data.document,
        pixKey: data.pixKey,
        status: PromoterStatus.ACTIVE
      }
    });
  }

  async updateStatus(tenantId: string, promoterId: string, status: PromoterStatus) {
    const promoter = await this.prisma.promoter.findFirst({ where: { id: promoterId, tenantId } });
    if (!promoter) throw new NotFoundException("Promoter not found.");

    return this.prisma.promoter.update({
      where: { id: promoterId },
      data: { status }
    });
  }

  async listEventLinks(tenantId: string, eventId: string) {
    return this.prisma.promoterLink.findMany({
      where: { eventId, event: { tenantId } },
      include: { promoter: { include: { user: { select: { name: true, email: true } } } } }
    });
  }

  async addPromoterToEvent(tenantId: string, eventId: string, data: { promoterId: string; commissionType: string; commissionValue: number; code?: string }) {
    const event = await this.prisma.event.findFirst({ where: { id: eventId, tenantId } });
    if (!event) throw new NotFoundException("Event not found.");

    const promoter = await this.prisma.promoter.findFirst({ where: { id: data.promoterId, tenantId } });
    if (!promoter) throw new NotFoundException("Promoter not found.");

    const code = data.code || `${event.slug}-${Math.random().toString(36).substring(2, 8)}`;

    return this.prisma.promoterLink.create({
      data: {
        promoterId: data.promoterId,
        eventId,
        code,
        commissionType: data.commissionType,
        commissionValue: data.commissionValue,
      }
    });
  }

  async withdrawals(tenantId: string) {
    return this.prisma.promoterWithdrawal.findMany({
      where: { promoter: { tenantId } },
      include: { promoter: { include: { user: { select: { name: true, email: true } } } } },
      orderBy: { requestedAt: "desc" }
    });
  }
}
