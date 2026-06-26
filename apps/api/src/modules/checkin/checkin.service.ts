import { Injectable } from "@nestjs/common";
import { ValidateTicketUseCase } from "./use-cases/validate-ticket.use-case";
import { PrismaService } from "../../prisma/prisma.service";

@Injectable()
export class CheckInService {
  constructor(
    private readonly validateTicket: ValidateTicketUseCase,
    private readonly prisma: PrismaService
  ) {}

  validate(eventId: string, tenantId: string, userId: string, code: string) {
    return this.validateTicket.execute(eventId, tenantId, userId, code);
  }

  list(eventId: string, tenantId: string) {
    return this.prisma.checkInLog.findMany({
      where: { ticket: { eventId, event: { tenantId } } },
      include: { ticket: true, user: true },
      orderBy: { createdAt: "desc" },
      take: 100
    });
  }
}
