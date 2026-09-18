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
import { readFileSync } from "fs";
import { join } from "path";
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

const TICKET_PDF_ASSETS_DIR = join(__dirname, "..", "..", "assets", "ticket-pdf");
const TICKET_PDF_ASSET_FILES = {
  cardBackground: "ticket-card-bg.png",
  notchLeft: "ticket-notch-left.png",
  notchRight: "ticket-notch-right.png",
  iconCalendar: "icon-white-calendar.png",
  iconClock: "icon-white-clock.png",
  iconTicket: "icon-white-ticket.png",
  iconTicketDark: "icon-dark-ticket.png",
  logo: "eventflow-logo-purple-white.png",
  logoDark: "eventflow-logo-purple-black.png",
} as const;

type TicketPdfAssets = Record<keyof typeof TICKET_PDF_ASSET_FILES, string>;

let ticketPdfAssetsCache: TicketPdfAssets | null = null;

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
    return this.renderTicketPdfFor(ticket);
  }

  /**
   * Renders a ticket's PDF given an already-authorized ticket record.
   * Callers are responsible for proving the requester may see this ticket:
   * findOwnedTicket() covers the logged-in path, and CheckoutService's
   * order-access-token check covers the guest (order-page / e-mail) path.
   */
  async renderTicketPdfFor(ticket: {
    event: {
      title: string;
      startsAt: Date;
      format?: string | null;
      address?: string | null;
      city?: string | null;
      state?: string | null;
      qrCodeReleaseAt?: Date | string | null;
      qrCodeReleaseMinutesBeforeStart?: number | null;
    };
    ticketType: { name: string };
    attendeeName: string;
    attendeeEmail: string;
    status: TicketStatus;
    uuid: string;
    orderId: string;
    signature: string | null;
    qrCodeDataUrl: string | null;
  }) {
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
    const svg = this.ticketSvg(ticket, width, height, this.ticketPdfAssets());
    const sharpFactory = sharp as unknown as (input: Buffer) => Sharp;
    const jpeg = await sharpFactory(Buffer.from(svg)).jpeg({ quality: 94 }).toBuffer();
    return this.imagePdf(jpeg, 595, 842);
  }

  private ticketPdfAssets(): TicketPdfAssets {
    if (ticketPdfAssetsCache) return ticketPdfAssetsCache;
    const entries = (Object.entries(TICKET_PDF_ASSET_FILES) as [keyof typeof TICKET_PDF_ASSET_FILES, string][]).map(
      ([key, file]) => {
        const bytes = readFileSync(join(TICKET_PDF_ASSETS_DIR, file));
        return [key, `data:image/png;base64,${bytes.toString("base64")}`] as const;
      },
    );
    ticketPdfAssetsCache = Object.fromEntries(entries) as TicketPdfAssets;
    return ticketPdfAssetsCache;
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
  }, width: number, height: number, assets: TicketPdfAssets) {
    const eventLines = this.svgLines(ticket.eventTitle, 20, 2);
    const venueLines = this.svgLines(ticket.venue, 40, 2);
    const isValid = ticket.status === TicketStatus.AVAILABLE;
    const statusLabel = isValid ? "\u2713 V\u00e1lido" : ticket.status === TicketStatus.USED ? "Utilizado" : "Cancelado";
    const statusColor = isValid
      ? { bg: "rgba(45,212,191,0.18)", fg: "#8ff2d6" }
      : { bg: "rgba(244,114,182,0.18)", fg: "#f9a8d4" };
    const qr = this.escapeAttribute(ticket.qrCodeDataUrl);

    const cardX = 96;
    const cardY = 150;
    const cardWidth = 1048;
    const cardHeight = 820;
    const cardRadius = 44;
    const leftX = cardX + 56;
    const topY = cardY + 70;
    const leftWidth = 620;
    const rightWidth = 292;
    const rightX = cardX + cardWidth - 56 - rightWidth;

    const notchWidth = 44;
    const notchHeight = Math.round((notchWidth * 112) / 40);
    const notchY = cardY + cardHeight / 2 - notchHeight / 2;

    const titleLine2 = eventLines[1]
      ? `<text x="0" y="214" font-family="${TICKET_FONT_FAMILY}" font-size="44" font-weight="900" fill="#ffffff">${this.escapeXml(eventLines[1])}</text>`
      : "";

    return `
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <defs>
    <clipPath id="cardClip">
      <rect x="${cardX}" y="${cardY}" width="${cardWidth}" height="${cardHeight}" rx="${cardRadius}"/>
    </clipPath>
    <filter id="cardShadow" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="22" stdDeviation="30" flood-color="#1a0f33" flood-opacity="0.22"/>
    </filter>
  </defs>

  <rect width="${width}" height="${height}" fill="#ffffff"/>

  <g filter="url(#cardShadow)">
    <rect x="${cardX}" y="${cardY}" width="${cardWidth}" height="${cardHeight}" rx="${cardRadius}" fill="#1a0f33"/>
  </g>
  <g clip-path="url(#cardClip)">
    <image href="${assets.cardBackground}" x="${cardX}" y="${cardY}" width="${cardWidth}" height="${cardHeight}" preserveAspectRatio="xMidYMid slice"/>
    <image href="${assets.notchLeft}" x="${cardX}" y="${notchY}" width="${notchWidth}" height="${notchHeight}"/>
    <image href="${assets.notchRight}" x="${cardX + cardWidth - notchWidth}" y="${notchY}" width="${notchWidth}" height="${notchHeight}"/>
  </g>

  <g transform="translate(${leftX} ${topY})">
    <image href="${assets.logo}" width="164" height="65.4"/>
    <rect x="${leftWidth - 190}" y="6" width="190" height="52" rx="26" fill="${statusColor.bg}"/>
    <text x="${leftWidth - 95}" y="39" text-anchor="middle" font-family="${TICKET_FONT_FAMILY}" font-size="21" font-weight="800" fill="${statusColor.fg}">${this.escapeXml(statusLabel)}</text>

    <text x="0" y="118" font-family="${TICKET_FONT_FAMILY}" font-size="18" font-weight="800" letter-spacing="3" fill="#b8a9e0">${this.escapeXml(this.truncate(ticket.eventTitle, 34).toUpperCase())}</text>
    <text x="0" y="162" font-family="${TICKET_FONT_FAMILY}" font-size="44" font-weight="900" fill="#ffffff">${this.escapeXml(eventLines[0] ?? "")}</text>
    ${titleLine2}

    <g transform="translate(0 300)">
      ${this.metaPill(assets.iconCalendar, "DATA", this.formatShortDayMonth(ticket.startsAt), 0)}
      ${this.metaPill(assets.iconClock, "HORA", this.formatHourMinute(ticket.startsAt), 212)}
      ${this.metaPill(assets.iconTicket, "SETOR", ticket.ticketTypeName, 424)}
    </g>

    <line x1="0" y1="450" x2="${leftWidth}" y2="450" stroke="#ffffff" stroke-opacity="0.24" stroke-width="2" stroke-dasharray="10 10"/>

    <text x="0" y="482" font-family="${TICKET_FONT_FAMILY}" font-size="18" font-weight="800" fill="#ffffff" fill-opacity="0.62" letter-spacing="3">PARTICIPANTE</text>
    <text x="0" y="524" font-family="${TICKET_FONT_FAMILY}" font-size="32" font-weight="900" fill="#ffffff">${this.escapeXml(ticket.attendeeName)}</text>
    <text x="0" y="554" font-family="${TICKET_FONT_FAMILY}" font-size="18" fill="#ffffff" fill-opacity="0.68">${this.escapeXml(this.truncate(ticket.attendeeEmail, 42))}</text>

    <text x="0" y="602" font-family="${TICKET_FONT_FAMILY}" font-size="18" font-weight="800" fill="#ffffff" fill-opacity="0.62" letter-spacing="3">LOCAL</text>
    ${venueLines.map((line, i) => `<text x="0" y="${636 + i * 30}" font-family="${TICKET_FONT_FAMILY}" font-size="22" fill="#ffffff" fill-opacity="0.9">${this.escapeXml(line)}</text>`).join("")}
  </g>

  <g transform="translate(${rightX} ${topY})">
    <rect width="${rightWidth}" height="372" rx="20" fill="#ffffff"/>
    <image href="${assets.iconTicketDark}" x="24" y="20" width="20" height="20"/>
    <text x="52" y="36" font-family="${TICKET_FONT_FAMILY}" font-size="15" font-weight="800" letter-spacing="1" fill="#171321">SEU INGRESSO</text>
    <image href="${qr}" x="26" y="56" width="240" height="240"/>
    <text x="${rightWidth / 2}" y="330" text-anchor="middle" font-family="${TICKET_FONT_FAMILY}" font-size="20" font-weight="900" letter-spacing="2" fill="#171321">${this.escapeXml(ticket.shortCode)}</text>

    <text x="${rightWidth / 2}" y="404" text-anchor="middle" font-family="${TICKET_FONT_FAMILY}" font-size="16" fill="#5c5470">Apresente este QR code</text>
    <text x="${rightWidth / 2}" y="426" text-anchor="middle" font-family="${TICKET_FONT_FAMILY}" font-size="16" fill="#5c5470">na entrada.</text>
    <text x="${rightWidth / 2}" y="462" text-anchor="middle" font-family="${TICKET_FONT_FAMILY}" font-size="13" fill="#8477a3">Ingresso pessoal, validado uma unica vez.</text>
  </g>

  <g transform="translate(${cardX} ${cardY + cardHeight + 90})">
    <text x="0" y="0" font-family="${TICKET_FONT_FAMILY}" font-size="26" font-weight="800" fill="#171321">Como usar este ingresso</text>
    <g transform="translate(0 50)">
      ${[
        "Chegue com antecedencia para evitar filas na entrada.",
        "Apresente o QR Code acima (impresso ou na tela do celular).",
        "Ingresso pessoal e intransferivel: leve um documento com foto.",
      ]
        .map(
          (line, i) => `
      <g transform="translate(0 ${i * 56})">
        <circle cx="14" cy="14" r="14" fill="#f2eef9"/>
        <text x="14" y="19" text-anchor="middle" font-family="${TICKET_FONT_FAMILY}" font-size="16" font-weight="800" fill="#5b3ff0">${i + 1}</text>
        <text x="42" y="19" font-family="${TICKET_FONT_FAMILY}" font-size="20" fill="#3f3856">${this.escapeXml(line)}</text>
      </g>`,
        )
        .join("")}
    </g>
  </g>

  <g transform="translate(${width / 2} ${height - 90})" text-anchor="middle">
    <image href="${assets.logoDark}" x="-70" y="-56" width="140" height="55.9"/>
    <text x="0" y="20" text-anchor="middle" font-family="${TICKET_FONT_FAMILY}" font-size="15" letter-spacing="2" fill="#a79bc4">INGRESSOS QUE APROXIMAM</text>
  </g>
</svg>`.trim();
  }

  private metaPill(iconHref: string, label: string, value: string, x: number) {
    const width = 190;
    const height = 108;
    return `
      <g transform="translate(${x} 0)">
        <rect width="${width}" height="${height}" rx="18" fill="#ffffff" fill-opacity="0.08" stroke="#ffffff" stroke-opacity="0.16"/>
        <image href="${iconHref}" x="20" y="18" width="24" height="24"/>
        <text x="54" y="36" font-family="${TICKET_FONT_FAMILY}" font-size="15" font-weight="800" letter-spacing="1" fill="#ffffff" fill-opacity="0.62">${this.escapeXml(label)}</text>
        <text x="20" y="80" font-family="${TICKET_FONT_FAMILY}" font-size="23" font-weight="900" fill="#ffffff">${this.escapeXml(this.truncate(value, 15))}</text>
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

  private formatShortDayMonth(date: Date) {
    const day = new Intl.DateTimeFormat("pt-BR", {
      day: "2-digit",
      timeZone: "America/Sao_Paulo",
    }).format(date);
    const month = new Intl.DateTimeFormat("pt-BR", {
      month: "short",
      timeZone: "America/Sao_Paulo",
    })
      .format(date)
      .replace(".", "");
    return `${day} ${month.charAt(0).toUpperCase()}${month.slice(1)}`;
  }

  private formatHourMinute(date: Date) {
    const parts = new Intl.DateTimeFormat("pt-BR", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
      timeZone: "America/Sao_Paulo",
    }).formatToParts(date);
    const hour = parts.find((part) => part.type === "hour")?.value ?? "00";
    const minute = parts.find((part) => part.type === "minute")?.value ?? "00";
    return `${hour}h${minute}`;
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
