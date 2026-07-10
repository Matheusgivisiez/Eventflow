import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { CheckInStatus, TicketStatus } from "@prisma/client";
import { createHmac } from "crypto";
import { PrismaService } from "../../../prisma/prisma.service";

@Injectable()
export class ValidateTicketUseCase {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService
  ) {}

  async execute(eventId: string, tenantId: string, userId: string, code: string) {
    const parsed = this.parseCode(code);

    if (parsed.uuid && parsed.orderId && parsed.signature) {
      this.validateSignature(parsed as { uuid: string; orderId: string; signature: string });
    }

    const ticket = await this.prisma.ticket.findFirst({
      where: {
        eventId,
        event: { tenantId },
        uuid: parsed.uuid ?? code
      },
      include: { event: true, ticketType: true }
    });

    if (!ticket) {
      throw new NotFoundException("Ingresso nao encontrado.");
    }

    if (ticket.status === TicketStatus.USED) {
      await this.logCheckIn(ticket.id, userId, CheckInStatus.DUPLICATED, "Ingresso ja utilizado.");
      return { status: CheckInStatus.DUPLICATED, message: "Entrada duplicada.", ticket };
    }

    if (ticket.status !== TicketStatus.AVAILABLE) {
      await this.logCheckIn(ticket.id, userId, CheckInStatus.REFUSED, "Ingresso cancelado ou indisponivel.");
      return { status: CheckInStatus.REFUSED, message: "Entrada recusada.", ticket };
    }

    const updated = await this.prisma.ticket.update({
      where: { id: ticket.id },
      data: {
        status: TicketStatus.USED,
        usedAt: new Date(),
        checkIns: { create: { userId, status: CheckInStatus.ENTERED } }
      },
      include: { event: true, ticketType: true }
    });

    return { status: CheckInStatus.ENTERED, message: "Entrada liberada.", ticket: updated };
  }

  private validateSignature(parsed: { uuid: string; orderId: string; signature: string }) {
    const secret = this.config.get<string>("QR_CODE_SECRET") ?? "change-me-qrcode-secret";
    const expectedSignature = createHmac("sha256", secret)
      .update(`${parsed.uuid}:${parsed.orderId}`)
      .digest("hex");
    if (expectedSignature !== parsed.signature) {
      throw new BadRequestException("Assinatura do ingresso invalida. QR Code forjado ou adulterado.");
    }
  }

  private async logCheckIn(ticketId: string, userId: string, status: CheckInStatus, reason: string) {
    await this.prisma.checkInLog.create({
      data: { ticketId, userId, status, reason }
    });
  }

  private parseCode(code: string): { uuid?: string; orderId?: string; signature?: string } {
    try {
      return JSON.parse(code);
    } catch {
      return {};
    }
  }
}
