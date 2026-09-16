import {
  BadRequestException,
  Injectable,
  NotFoundException,
  Optional,
} from "@nestjs/common";
import { PaymentStatus, TicketStatus } from "@prisma/client";
import * as QRCode from "qrcode";
import sharp = require("sharp");
import type { Sharp } from "sharp";
import { AuditService } from "../audit/audit.service";
import { PaymentsService } from "../payments/payments.service";
import { PrismaService } from "../../prisma/prisma.service";
import { CacheService } from "../cache/cache.service";
import { GoogleWalletService } from "../wallet/google-wallet.service";
import {
  getQrCodeReleaseTime,
  isQrCodeLocked,
} from "../../common/utils/qr-code.utils";
import {
  getRefundBlockReason,
  getRefundDeadline,
} from "../../common/utils/refund-policy.utils";

const TICKET_FONT_FAMILY = "DejaVu Sans, Arial, Helvetica, sans-serif";

@Injectable()
export class BuyerService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly payments: PaymentsService,
    private readonly cache: CacheService,
    @Optional() private readonly googleWallet?: GoogleWalletService,
  ) {}

  /**
   * @param email verified e-mail of the account, or null when unverified.
   *   Passing null is what keeps an unverified account from claiming guest
   *   purchases that merely carry the same buyerEmail.
   */
  async listTickets(userId: string, email: string | null, scope?: "future" | "past") {
    const now = new Date();
    const normalizedEmail = email?.toLowerCase() ?? null;
    await this.reconcileOwnedOrders(userId, normalizedEmail);
    const eventScope =
      scope === "future"
        ? {
            OR: [
              { endsAt: { gte: now } },
              { endsAt: null, startsAt: { gte: now } },
            ],
          }
        : scope === "past"
          ? {
              OR: [
                { endsAt: { lt: now } },
                { endsAt: null, startsAt: { lt: now } },
              ],
            }
          : undefined;

    const tickets = await this.prisma.ticket.findMany({
      where: {
        OR: [
          { ownerId: userId },
          {
            ownerId: null,
            OR: [
              { order: { userId } },
              ...(normalizedEmail
                ? [
                    { attendeeEmail: normalizedEmail },
                    { order: { buyerEmail: normalizedEmail } },
                  ]
                : []),
            ],
          },
        ],
        event: eventScope,
      },
      include: {
        event: true,
        ticketType: true,
        order: { include: { payment: true } },
        transfers: {
          where: {
            senderId: userId,
            status: "PENDING",
            OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
          },
          select: {
            id: true,
            receiverEmail: true,
            receiverCpf: true,
            createdAt: true,
            expiresAt: true,
            receiver: { select: { name: true, email: true } },
          },
          orderBy: { createdAt: "desc" },
          take: 1,
        },
      },
      orderBy: { event: { startsAt: scope === "past" ? "desc" : "asc" } },
    });

    return tickets.map(({ transfers, ...ticket }) => {
      const locked = isQrCodeLocked(ticket.event);
      const releaseTime = getQrCodeReleaseTime(ticket.event);
      const refundBlockedReason =
        ticket.status === TicketStatus.AVAILABLE
          ? getRefundBlockReason(ticket.event, now)
          : null;

      return {
        ...ticket,
        qrCodeDataUrl: locked ? null : ticket.qrCodeDataUrl,
        uuid: locked ? null : ticket.uuid,
        signature: locked ? null : ticket.signature,
        qrCodeLocked: locked,
        qrCodeReleaseAt: releaseTime?.toISOString() ?? null,
        refundAvailable:
          ticket.status === TicketStatus.AVAILABLE && refundBlockedReason === null,
        refundBlockedReason,
        refundDeadline: ticket.event.allowTicketRefund
          ? getRefundDeadline(ticket.event).toISOString()
          : null,
        pendingTransfer: transfers[0]
          ? {
              id: transfers[0].id,
              receiverName: transfers[0].receiver?.name ?? null,
              receiverEmail:
                transfers[0].receiverEmail ?? transfers[0].receiver?.email ?? null,
              receiverCpfLast4: transfers[0].receiverCpf?.slice(-4) ?? null,
              createdAt: transfers[0].createdAt.toISOString(),
              expiresAt: transfers[0].expiresAt?.toISOString() ?? null,
            }
          : null,
        event: {
          ...ticket.event,
          allowTicketTransfer: ticket.event.allowTicketTransfer,
          ticketTransferLockTime:
            ticket.event.ticketTransferLockTime?.toISOString() ?? null,
        },
      };
    });
  }

  private async reconcileOwnedOrders(userId: string, email: string | null) {
    const cacheKey = `buyer:reconcile:${userId}:${email ?? "-"}`;
    if (await this.cache.get(cacheKey)) return;

    const orders = await this.prisma.order.findMany({
      where: {
        status: { in: [PaymentStatus.PENDING, PaymentStatus.PAID] },
        OR: [
          { userId },
          ...(email ? [{ userId: null, buyerEmail: email }] : []),
        ],
      },
      select: {
        id: true,
        status: true,
        event: { select: { tenantId: true } },
        payment: { select: { id: true } },
        _count: { select: { tickets: true } },
      },
    });

    await Promise.all(orders.map(async (order) => {
      if (!order.payment || order._count.tickets > 0) return;

      if (order.status === PaymentStatus.PENDING) {
        await this.payments.reconcileProviderStatus(order.payment.id, order.event.tenantId);
        return;
      }

      await this.payments.updateStatus(order.payment.id, order.event.tenantId, {
        status: PaymentStatus.PAID,
      });
    }));

    await this.cache.set(cacheKey, { checkedAt: Date.now() }, 60);
  }

  async requestRefund(userId: string, email: string | null, ticketId: string, confirmation: string) {
    this.confirmSensitiveAction(confirmation);
    const ticket = await this.findOwnedTicket(userId, email, ticketId);
    if (ticket.status !== TicketStatus.AVAILABLE) {
      throw new BadRequestException(
        "Somente ingressos disponiveis podem solicitar reembolso.",
      );
    }

    const refundBlockedReason = getRefundBlockReason(ticket.event);
    if (refundBlockedReason) {
      throw new BadRequestException(refundBlockedReason);
    }

    await this.prisma.$transaction(async (tx) => {
      const canceled = await tx.ticket.updateMany({
        where: { id: ticket.id, status: TicketStatus.AVAILABLE },
        data: { status: TicketStatus.CANCELED },
      });
      if (canceled.count !== 1) {
        throw new BadRequestException("Este ingresso já foi cancelado.");
      }

      const stockReleased = await tx.ticketType.updateMany({
        where: { id: ticket.ticketTypeId, sold: { gt: 0 } },
        data: { sold: { decrement: 1 } },
      });
      if (stockReleased.count !== 1) {
        throw new BadRequestException("Não foi possível liberar a vaga deste ingresso.");
      }

      if (ticket.seatId) {
        await tx.seat.updateMany({
          where: { id: ticket.seatId, status: "SOLD" },
          data: { status: "AVAILABLE" },
        });
        await tx.seatReservation.updateMany({
          where: { seatId: ticket.seatId, eventId: ticket.eventId, orderId: ticket.orderId },
          data: { status: "AVAILABLE" },
        });
      }
    });

    void this.googleWallet?.deactivateTicket(ticket.uuid);

    await this.audit.log({
      userId,
      action: "refund.requested",
      entity: "ticket",
      entityId: ticket.id,
      metadata: {
        orderId: ticket.orderId,
        eventId: ticket.eventId,
        scope: "individual_ticket",
      },
    });
    return {
      message: "Ingresso cancelado individualmente. A solicitação de reembolso foi registrada.",
      status: "REFUND_REQUESTED",
    };
  }

  async ticketPdf(userId: string, email: string | null, ticketId: string) {
    const ticket = await this.findOwnedTicket(userId, email, ticketId);

    if (isQrCodeLocked(ticket.event)) {
      throw new BadRequestException(
        "O QR Code ainda não está disponível. Aguarde a liberação próxima ao evento.",
      );
    }

    const qrCodeDataUrl = ticket.qrCodeDataUrl ?? await this.generateQrCodeDataUrl(ticket);
    return this.renderTicketPdf({
      eventTitle: ticket.event.title,
      attendeeName: ticket.attendeeName,
      attendeeEmail: ticket.attendeeEmail,
      ticketTypeName: ticket.ticketType.name,
      startsAt: ticket.event.startsAt,
      venue: this.ticketVenue(ticket.event),
      status: ticket.status,
      shortCode: this.shortTicketCode(ticket.uuid),
      qrCodeDataUrl,
    });
  }

  walletConfig() {
    return { google: this.googleWallet?.isEnabled() ?? false };
  }

  async googleWalletSaveUrl(userId: string, email: string | null, ticketId: string) {
    if (!this.googleWallet?.isEnabled()) {
      throw new BadRequestException("Google Wallet ainda não está disponível.");
    }

    const ticket = await this.findOwnedTicket(userId, email, ticketId);

    if (ticket.status !== TicketStatus.AVAILABLE) {
      throw new BadRequestException("Somente ingressos ativos podem ir para a carteira.");
    }
    if (isQrCodeLocked(ticket.event)) {
      throw new BadRequestException(
        "O QR Code ainda não está disponível. Aguarde a liberação próxima ao evento.",
      );
    }
    if (!ticket.signature) {
      throw new BadRequestException("QR Code indisponível para este ingresso.");
    }

    return this.googleWallet.createSaveUrl({
      uuid: ticket.uuid,
      orderId: ticket.orderId,
      signature: ticket.signature,
      attendeeName: ticket.attendeeName,
      ticketTypeName: ticket.ticketType.name,
      event: ticket.event,
    });
  }

  private async findOwnedTicket(
    userId: string,
    email: string | null,
    ticketId: string,
  ) {
    const normalizedEmail = email?.toLowerCase() ?? null;
    const ticket = await this.prisma.ticket.findFirst({
      where: {
        id: ticketId,
        OR: [
          { ownerId: userId },
          { ownerId: null, order: { userId } },
          ...(normalizedEmail
            ? [
                {
                  ownerId: null,
                  OR: [
                    { attendeeEmail: normalizedEmail },
                    { order: { buyerEmail: normalizedEmail } },
                  ],
                },
              ]
            : []),
        ],
      },
      include: { event: true, ticketType: true, order: true },
    });
    if (!ticket) {
      throw new NotFoundException("Ingresso nao encontrado.");
    }
    return ticket;
  }

  private confirmSensitiveAction(confirmation: string) {
    if (confirmation.trim().toUpperCase() !== "CONFIRMAR") {
      throw new BadRequestException("Digite CONFIRMAR para concluir esta ação.");
    }
  }

  private async generateQrCodeDataUrl(ticket: { uuid: string; orderId: string; signature: string | null }) {
    if (!ticket.signature) {
      throw new BadRequestException("QR Code indisponível para este ingresso.");
    }
    return QRCode.toDataURL(JSON.stringify({
      uuid: ticket.uuid,
      orderId: ticket.orderId,
      signature: ticket.signature,
    }));
  }

  private async renderTicketPdf(ticket: {
    eventTitle: string;
    attendeeName: string;
    attendeeEmail: string;
    ticketTypeName: string;
    startsAt: Date;
    venue: string;
    status: TicketStatus;
    shortCode: string;
    qrCodeDataUrl: string;
  }) {
    const width = 1240;
    const height = 1754;
    const svg = this.ticketSvg(ticket, width, height);
    const sharpFactory = sharp as unknown as (input: Buffer) => Sharp;
    const jpeg = await sharpFactory(Buffer.from(svg)).jpeg({ quality: 94 }).toBuffer();
    return this.imagePdf(jpeg, 595, 842);
  }

  private ticketSvg(ticket: {
    eventTitle: string;
    attendeeName: string;
    attendeeEmail: string;
    ticketTypeName: string;
    startsAt: Date;
    venue: string;
    status: TicketStatus;
    shortCode: string;
    qrCodeDataUrl: string;
  }, width: number, height: number) {
    const eventLines = this.svgLines(ticket.eventTitle, 28, 2);
    const venueLines = this.svgLines(ticket.venue, 48, 2);
    const date = this.formatTicketDate(ticket.startsAt);
    const status = ticket.status === TicketStatus.AVAILABLE ? "VALIDO" : ticket.status;
    const qr = this.escapeAttribute(ticket.qrCodeDataUrl);

    return `
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <defs>
    <linearGradient id="page" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#fff7fb"/>
      <stop offset="0.52" stop-color="#f4efff"/>
      <stop offset="1" stop-color="#effbf7"/>
    </linearGradient>
    <linearGradient id="ticket" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#2c1236"/>
      <stop offset="0.48" stop-color="#1d1734"/>
      <stop offset="1" stop-color="#0e4b48"/>
    </linearGradient>
    <linearGradient id="accent" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#6b37ff"/>
      <stop offset="1" stop-color="#e84791"/>
    </linearGradient>
    <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="24" stdDeviation="28" flood-color="#171321" flood-opacity="0.22"/>
    </filter>
  </defs>
  <rect width="1240" height="1754" fill="url(#page)"/>
  <g transform="translate(104 96)">
    <path d="M0 28 C0 12 12 0 28 0 H92 C108 0 120 12 120 28 V92 C120 108 108 120 92 120 H28 C12 120 0 108 0 92 Z" fill="#171321"/>
    <path d="M33 33 H82 C88 33 91 33 95 32 C91 45 83 51 70 51 H29 C28 43 29 37 33 33 Z" fill="#743cff"/>
    <path d="M29 59 H82 C78 72 70 78 57 78 H29 Z" fill="#9140ff"/>
    <path d="M29 86 H73 C69 99 61 105 48 105 H29 Z" fill="#e84791"/>
    <text x="142" y="48" font-family="${TICKET_FONT_FAMILY}" font-size="34" font-weight="800" fill="#171321">event</text>
    <text x="142" y="88" font-family="${TICKET_FONT_FAMILY}" font-size="34" font-weight="800" fill="#171321">flow</text>
  </g>
  <g filter="url(#shadow)">
    <rect x="96" y="262" width="1048" height="1268" rx="44" fill="url(#ticket)"/>
    <circle cx="138" cy="896" r="32" fill="url(#page)"/>
    <circle cx="1102" cy="896" r="32" fill="url(#page)"/>
  </g>
  <g transform="translate(148 330)">
    <text x="0" y="0" font-family="${TICKET_FONT_FAMILY}" font-size="22" font-weight="800" fill="#ffffff" opacity="0.72" letter-spacing="7">EVENTFLOW PASS</text>
    <rect x="742" y="-36" width="154" height="54" rx="27" fill="#ffffff" opacity="0.1" stroke="#ffffff" stroke-opacity="0.26"/>
    <text x="819" y="-2" text-anchor="middle" font-family="${TICKET_FONT_FAMILY}" font-size="20" font-weight="800" fill="#cbfff1">${this.escapeXml(status)}</text>

    ${eventLines.map((line, index) => `<text x="0" y="${126 + index * 82}" font-family="${TICKET_FONT_FAMILY}" font-size="68" font-weight="900" fill="#ffffff">${this.escapeXml(line)}</text>`).join("")}

    <g transform="translate(0 360)">
      ${this.infoBox(0, 0, "DATA", date)}
      ${this.infoBox(304, 0, "LOTE", ticket.ticketTypeName)}
      ${this.infoBox(608, 0, "CODIGO", ticket.shortCode)}
    </g>

    <line x1="0" y1="562" x2="896" y2="562" stroke="#ffffff" stroke-opacity="0.24" stroke-width="2" stroke-dasharray="10 10"/>

    <text x="0" y="650" font-family="${TICKET_FONT_FAMILY}" font-size="22" font-weight="800" fill="#ffffff" opacity="0.62" letter-spacing="5">PARTICIPANTE</text>
    <text x="0" y="706" font-family="${TICKET_FONT_FAMILY}" font-size="44" font-weight="900" fill="#ffffff">${this.escapeXml(ticket.attendeeName)}</text>
    <text x="0" y="746" font-family="${TICKET_FONT_FAMILY}" font-size="24" fill="#ffffff" opacity="0.68">${this.escapeXml(ticket.attendeeEmail)}</text>

    <text x="0" y="838" font-family="${TICKET_FONT_FAMILY}" font-size="22" font-weight="800" fill="#ffffff" opacity="0.62" letter-spacing="5">LOCAL</text>
    ${venueLines.map((line, index) => `<text x="0" y="${894 + index * 34}" font-family="${TICKET_FONT_FAMILY}" font-size="28" fill="#ffffff" opacity="0.9">${this.escapeXml(line)}</text>`).join("")}

    <g transform="translate(582 620)">
      <rect x="0" y="0" width="314" height="314" rx="30" fill="#ffffff"/>
      <image href="${qr}" x="26" y="26" width="262" height="262"/>
      <text x="157" y="368" text-anchor="middle" font-family="${TICKET_FONT_FAMILY}" font-size="24" font-weight="900" fill="#ffffff" letter-spacing="3">${this.escapeXml(ticket.shortCode)}</text>
    </g>

    <rect x="0" y="1050" width="896" height="92" rx="22" fill="#fff8e8"/>
    <text x="32" y="1086" font-family="${TICKET_FONT_FAMILY}" font-size="22" font-weight="800" fill="#3b2d00">Apresente este QR code na entrada.</text>
    <text x="32" y="1120" font-family="${TICKET_FONT_FAMILY}" font-size="18" fill="#685b35">Este ingresso e pessoal e sera validado uma unica vez.</text>
  </g>
</svg>`.trim();
  }

  private infoBox(x: number, y: number, label: string, value: string) {
    return `
      <g transform="translate(${x} ${y})">
        <rect width="272" height="118" rx="20" fill="#ffffff" opacity="0.09" stroke="#ffffff" stroke-opacity="0.16"/>
        <text x="24" y="42" font-family="${TICKET_FONT_FAMILY}" font-size="18" font-weight="800" fill="#ffffff" opacity="0.62">${this.escapeXml(label)}</text>
        <text x="24" y="82" font-family="${TICKET_FONT_FAMILY}" font-size="24" font-weight="900" fill="#ffffff">${this.escapeXml(this.truncate(value, 18))}</text>
      </g>`;
  }

  private imagePdf(jpeg: Buffer, pageWidth: number, pageHeight: number) {
    const content = `q\n${pageWidth} 0 0 ${pageHeight} 0 0 cm\n/Im1 Do\nQ`;
    const objects = [
      Buffer.from("1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj", "binary"),
      Buffer.from("2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj", "binary"),
      Buffer.from(`3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageWidth} ${pageHeight}] /Resources << /XObject << /Im1 4 0 R >> >> /Contents 5 0 R >>\nendobj`, "binary"),
      Buffer.concat([
        Buffer.from(`4 0 obj\n<< /Type /XObject /Subtype /Image /Width 1240 /Height 1754 /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpeg.length} >>\nstream\n`, "binary"),
        jpeg,
        Buffer.from("\nendstream\nendobj", "binary"),
      ]),
      Buffer.from(`5 0 obj\n<< /Length ${Buffer.byteLength(content)} >>\nstream\n${content}\nendstream\nendobj`, "binary"),
    ];

    const chunks: Buffer[] = [Buffer.from("%PDF-1.4\n", "binary")];
    const offsets = [0];
    let length = chunks[0].length;
    for (const object of objects) {
      offsets.push(length);
      chunks.push(object);
      length += object.length;
    }
    const xrefOffset = length;
    const xref = [
      "xref",
      `0 ${offsets.length}`,
      "0000000000 65535 f ",
      ...offsets.slice(1).map((offset) => `${String(offset).padStart(10, "0")} 00000 n `),
      "trailer",
      `<< /Size ${offsets.length} /Root 1 0 R >>`,
      "startxref",
      String(xrefOffset),
      "%%EOF",
    ].join("\n");
    chunks.push(Buffer.from(`\n${xref}`, "binary"));
    return Buffer.concat(chunks);
  }

  private formatTicketDate(date: Date) {
    return new Intl.DateTimeFormat("pt-BR", {
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "America/Sao_Paulo",
    }).format(date).replace(".", "");
  }

  private ticketVenue(event: { format?: string | null; address?: string | null; city?: string | null; state?: string | null }) {
    if (event.format === "ONLINE") return "Online";
    return [event.address, event.city, event.state].filter(Boolean).join(", ") || "Local a confirmar";
  }

  private shortTicketCode(uuid: string) {
    return uuid.replace(/-/g, "").slice(0, 10).toUpperCase();
  }

  private svgLines(value: string, maxLength: number, maxLines: number) {
    const words = value.split(/\s+/).filter(Boolean);
    const lines: string[] = [];
    let current = "";
    for (const word of words) {
      const candidate = current ? `${current} ${word}` : word;
      if (candidate.length > maxLength && current) {
        lines.push(current);
        current = word;
      } else {
        current = candidate;
      }
      if (lines.length === maxLines) break;
    }
    if (current && lines.length < maxLines) lines.push(current);
    if (lines.length === maxLines && words.join(" ").length > lines.join(" ").length) {
      lines[maxLines - 1] = `${this.truncate(lines[maxLines - 1], maxLength - 1)}...`;
    }
    return lines.length ? lines : [value];
  }

  private truncate(value: string, maxLength: number) {
    return value.length > maxLength ? `${value.slice(0, Math.max(0, maxLength - 1))}...` : value;
  }

  private escapeXml(value: string) {
    return value
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&apos;");
  }

  private escapeAttribute(value: string) {
    return this.escapeXml(value);
  }
}
