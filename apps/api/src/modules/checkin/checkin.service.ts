import { Injectable } from "@nestjs/common";
import { ValidateTicketUseCase } from "./use-cases/validate-ticket.use-case";
import { PrismaService } from "../../prisma/prisma.service";

@Injectable()
export class CheckInService {
  constructor(
    private readonly validateTicket: ValidateTicketUseCase,
    private readonly prisma: PrismaService
  ) {}

  async validate(eventId: string, tenantId: string | undefined, userId: string, code: string) {
    let resolvedTenantId = tenantId;
    if (!resolvedTenantId) {
      const event = await this.prisma.event.findUnique({
        where: { id: eventId },
        select: { tenantId: true }
      });
      if (event) {
        resolvedTenantId = event.tenantId;
      }
    }
    return this.validateTicket.execute(eventId, resolvedTenantId ?? "", userId, code);
  }

  async list(eventId: string, tenantId: string | undefined) {
    let resolvedTenantId = tenantId;
    if (!resolvedTenantId) {
      const event = await this.prisma.event.findUnique({
        where: { id: eventId },
        select: { tenantId: true }
      });
      if (event) {
        resolvedTenantId = event.tenantId;
      }
    }

    return this.prisma.checkInLog.findMany({
      where: {
        ticket: {
          eventId,
          ...(resolvedTenantId ? { event: { tenantId: resolvedTenantId } } : {})
        }
      },
      include: {
        ticket: {
          include: { ticketType: true }
        },
        user: true
      },
      orderBy: { createdAt: "desc" },
      take: 100
    });
  }
}
