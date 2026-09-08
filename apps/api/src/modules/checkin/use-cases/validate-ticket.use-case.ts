import { BadRequestException, Injectable, NotFoundException, Optional } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { CheckInStatus, EventStatus, PaymentStatus, TicketStatus } from "@prisma/client";
import { createHmac } from "crypto";
import { PrismaService } from "../../../prisma/prisma.service";
import { BusinessMetricsService } from "../../observability/business-metrics.service";

@Injectable()
export class ValidateTicketUseCase {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    @Optional() private readonly metrics?: BusinessMetricsService
  ) {}

  async execute(
    eventId: string,
    tenantId: string,
    userId: string,
    rawCode: string,
    options: { requireSignedPayload?: boolean } = {}
  ) {
    const code = rawCode ? rawCode.trim() : "";
    if (!code) {
      this.metrics?.increment("eventflow_checkin_validations_total", { status: "NOT_FOUND" });
      throw new NotFoundException("Ingresso nao encontrado.");
    }

    const parsed = this.parseCode(code);

    if (options.requireSignedPayload && (!parsed.uuid || !parsed.orderId || !parsed.signature)) {
      throw new BadRequestException("QR Code assinado obrigatorio para sincronizacao offline.");
    }

    if (parsed.uuid && parsed.orderId && parsed.signature) {
      this.validateSignature(parsed as { uuid: string; orderId: string; signature: string });
    }

    const searchKey = parsed.uuid ?? code;

    const ticket = await this.prisma.ticket.findFirst({
      where: {
        event: { tenantId },
        OR: [
          { uuid: searchKey },
          { hash: searchKey },
          { id: searchKey }
        ]
      },
      include: { event: true, ticketType: true, order: true }
    });

    if (!ticket) {
      this.metrics?.increment("eventflow_checkin_validations_total", { status: "NOT_FOUND" });
      throw new NotFoundException("Ingresso nao encontrado.");
    }

    if (ticket.eventId !== eventId) {
      await this.logCheckIn(ticket.id, userId, CheckInStatus.REFUSED, "Ingresso pertence a outro evento.");
      this.metrics?.increment("eventflow_checkin_validations_total", { status: CheckInStatus.REFUSED });
      return { status: CheckInStatus.REFUSED, message: "Ingresso pertence a outro evento.", ticket };
    }

    const portariaReason = this.getCheckInWindowRefusal(ticket.event);
    if (portariaReason) {
      await this.logCheckIn(ticket.id, userId, CheckInStatus.REFUSED, portariaReason);
      this.metrics?.increment("eventflow_checkin_validations_total", { status: CheckInStatus.REFUSED });
      return { status: CheckInStatus.REFUSED, message: portariaReason, ticket };
    }

    if (ticket.order && ticket.order.status !== PaymentStatus.PAID) {
      await this.logCheckIn(ticket.id, userId, CheckInStatus.REFUSED, "Ingresso com pagamento pendente ou cancelado.");
      this.metrics?.increment("eventflow_checkin_validations_total", { status: CheckInStatus.REFUSED });
      return { status: CheckInStatus.REFUSED, message: "Ingresso com pagamento pendente ou cancelado.", ticket };
    }

    if (ticket.status === TicketStatus.USED) {
      await this.logCheckIn(ticket.id, userId, CheckInStatus.DUPLICATED, "Ingresso ja utilizado.");
      this.metrics?.increment("eventflow_checkin_validations_total", { status: CheckInStatus.DUPLICATED });
      return { status: CheckInStatus.DUPLICATED, message: "Entrada duplicada.", ticket };
    }

    if (ticket.status !== TicketStatus.AVAILABLE) {
      await this.logCheckIn(ticket.id, userId, CheckInStatus.REFUSED, "Ingresso cancelado ou indisponivel.");
      this.metrics?.increment("eventflow_checkin_validations_total", { status: CheckInStatus.REFUSED });
      return { status: CheckInStatus.REFUSED, message: "Entrada recusada.", ticket };
    }

    const claimed = await this.prisma.ticket.updateMany({
      where: { id: ticket.id, status: TicketStatus.AVAILABLE },
      data: {
        status: TicketStatus.USED,
        usedAt: new Date()
      }
    });

    if (claimed.count !== 1) {
      return this.resolveConcurrentAttempt(ticket.id, userId);
    }

    await this.logCheckIn(ticket.id, userId, CheckInStatus.ENTERED);

    this.metrics?.increment("eventflow_checkin_validations_total", { status: CheckInStatus.ENTERED });

    const updated = {
      ...ticket,
      status: TicketStatus.USED,
      usedAt: new Date()
    };

    return { status: CheckInStatus.ENTERED, message: "Entrada liberada.", ticket: updated };
  }

  private async resolveConcurrentAttempt(ticketId: string, userId: string) {
    const latest = await this.prisma.ticket.findUnique({
      where: { id: ticketId },
      include: { event: true, ticketType: true, order: true }
    });

    if (!latest) {
      throw new NotFoundException("Ingresso nao encontrado.");
    }

    if (latest.status === TicketStatus.USED) {
      await this.logCheckIn(latest.id, userId, CheckInStatus.DUPLICATED, "Ingresso ja utilizado.");
      this.metrics?.increment("eventflow_checkin_validations_total", { status: CheckInStatus.DUPLICATED });
      return { status: CheckInStatus.DUPLICATED, message: "Entrada duplicada.", ticket: latest };
    }

    await this.logCheckIn(latest.id, userId, CheckInStatus.REFUSED, "Ingresso cancelado ou indisponivel.");
    this.metrics?.increment("eventflow_checkin_validations_total", { status: CheckInStatus.REFUSED });
    return { status: CheckInStatus.REFUSED, message: "Entrada recusada.", ticket: latest };
  }

  private validateSignature(parsed: { uuid: string; orderId: string; signature: string }) {
    const secret = this.config.get<string>("QR_CODE_SECRET");
    if (!secret) {
      throw new Error("QR_CODE_SECRET is required.");
    }
    const expectedSignature = createHmac("sha256", secret)
      .update(`${parsed.uuid}:${parsed.orderId}`)
      .digest("hex");
    if (expectedSignature !== parsed.signature) {
      this.metrics?.increment("eventflow_checkin_signature_failures_total", { reason: "invalid_signature" });
      throw new BadRequestException("Assinatura do ingresso invalida. QR Code forjado ou adulterado.");
    }
  }

  private async logCheckIn(ticketId: string, userId: string, status: CheckInStatus, reason?: string) {
    await this.prisma.checkInLog.create({
      data: { ticketId, userId, status, reason }
    });
  }

  private getCheckInWindowRefusal(event: {
    status?: EventStatus;
    startsAt?: Date;
    checkInOpensAt?: Date | null;
    checkInClosesAt?: Date | null;
  }): string | undefined {
    if (event.status && event.status !== EventStatus.PUBLISHED) {
      return "Check-in indisponível para evento não publicado ou encerrado.";
    }

    const now = new Date();
    const opensAt = event.checkInOpensAt ?? event.startsAt;
    if (opensAt && now < new Date(opensAt)) {
      return `A portaria abre em ${new Date(opensAt).toISOString()}.`;
    }

    if (event.checkInClosesAt && now > new Date(event.checkInClosesAt)) {
      return "A portaria deste evento já foi encerrada.";
    }
    return undefined;
  }

  private parseCode(code: string): { uuid?: string; orderId?: string; signature?: string } {
    try {
      return JSON.parse(code);
    } catch {
      return {};
    }
  }
}
