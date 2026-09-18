import { BadRequestException, ForbiddenException, Injectable, NotFoundException, Optional } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { NotificationEvent, NotificationType, Prisma, TicketStatus, TransferStatus, User, UserRole } from "@prisma/client";
import * as QRCode from "qrcode";
import { createHash, createHmac, randomUUID } from "crypto";
import { resolveClaimEmail } from "../../common/utils/claim-email.utils";
import { maskEmail, maskName } from "../../common/utils/mask.utils";
import { RequestUser } from "../../common/types/request-user";
import { PrismaService } from "../../prisma/prisma.service";
import { AuditService } from "../audit/audit.service";
import { CacheService } from "../cache/cache.service";
import { NotificationsService } from "../notifications/notifications.service";
import { GoogleWalletService } from "../wallet/google-wallet.service";
import {
  renderTransferAccepted,
  renderTransferDeclined,
  renderTransferExpired,
  renderTransferReceived
} from "../notifications/templates/ticket-transfer.template";
import { CreateTransferDto, ResolveTransferRecipientDto } from "./dto/create-transfer.dto";

type RecipientLookup = {
  receiverId?: string;
  receiverEmail?: string;
  user?: Pick<User, "id" | "name" | "email" | "avatarUrl">;
};

@Injectable()
export class TransfersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly notifications: NotificationsService,
    private readonly cache: CacheService,
    private readonly config: ConfigService,
    @Optional() private readonly googleWallet?: GoogleWalletService
  ) {}

  /**
   * Confirma para quem o ingresso vai — sem virar uma consulta de dados
   * pessoais. Antes esta rota devolvia nome, id e e-mail completos de qualquer
   * conta: com um CPF em maos, qualquer usuario logado descobria o nome e o
   * e-mail do titular. Agora so volta o que serve para reconhecer a pessoa,
   * mascarado, e o e-mail cru jamais e revelado a partir de um CPF.
   */
  async resolveRecipient(sender: RequestUser, dto: ResolveTransferRecipientDto) {
    const recipient = await this.lookupRecipient(dto);
    this.ensureNotSelf(sender, recipient);

    return {
      exists: Boolean(recipient.user),
      user: recipient.user
        ? {
            name: maskName(recipient.user.name),
            email: maskEmail(recipient.user.email)
          }
        : undefined,
      receiverEmail: dto.receiverEmail.trim().toLowerCase()
    };
  }

  async create(sender: RequestUser, dto: CreateTransferDto) {
    this.confirmSensitiveAction(dto.confirmation);
    await this.expirePendingTransfers();

    const recipient = await this.lookupRecipient(dto);
    this.ensureNotSelf(sender, recipient);

    const ticket = await this.findOwnedTicket(sender, dto.ticketId);
    this.ensureTicketCanBeTransferred(ticket);

    const pending = await this.prisma.transfer.findFirst({
      where: { ticketId: ticket.id, status: TransferStatus.PENDING }
    });
    if (pending) {
      throw new BadRequestException("Ja existe uma transferencia pendente para este ingresso.");
    }

    let transfer;
    try {
      transfer = await this.prisma.transfer.create({
        data: {
          ticketId: ticket.id,
          senderId: sender.id,
          receiverId: recipient.receiverId,
          receiverEmail: recipient.receiverEmail,
          expiresAt: this.transferExpiresAt(ticket.event),
          history: {
            create: {
              action: "TRANSFER_CREATED",
              userId: sender.id,
              metadata: this.compactJson({
                receiverEmail: recipient.receiverEmail,
                receiverId: recipient.receiverId
              })
            }
          }
        },
        include: this.transferInclude()
      });
    } catch (error) {
      if (this.isPrismaError(error, "P2002")) {
        throw new BadRequestException("Ja existe uma transferencia pendente para este ingresso.");
      }
      throw error;
    }

    const recipientEmail = recipient.receiverEmail ?? recipient.user?.email;
    if (recipientEmail) {
      await this.notifications.send({
        userId: recipient.receiverId,
        type: NotificationType.EMAIL,
        event: NotificationEvent.TICKET_TRANSFER_RECEIVED,
        recipient: recipientEmail,
        payload: {
          transferId: transfer.id,
          ticketId: ticket.id,
          eventTitle: ticket.event.title,
          senderId: sender.id
        },
        dedupeKey: `ticket-transfer-received:${transfer.id}`,
        mail: renderTransferReceived({
          recipientName: recipient.user?.name ?? "participante",
          eventTitle: ticket.event.title,
          counterpartName: sender.email,
          actionUrl: this.appUrl("/me/recebidos")
        })
      });
    }

    await this.audit.log({
      userId: sender.id,
      action: "ticket_transfer.created",
      entity: "transfer",
      entityId: transfer.id,
      metadata: { ticketId: ticket.id, eventId: ticket.eventId, receiverId: recipient.receiverId }
    });

    return transfer;
  }

  async received(user: RequestUser, query: { page?: string; perPage?: string; status?: TransferStatus }) {
    await this.expirePendingTransfers();
    const { page, perPage } = this.pagination(query);
    const claimEmail = resolveClaimEmail(user);

    return this.prisma.transfer.findMany({
      where: {
        status: query.status,
        OR: [
          { receiverId: user.id },
          ...(claimEmail ? [{ receiverEmail: claimEmail }] : [])
        ]
      },
      include: this.transferInclude(),
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * perPage,
      take: perPage
    });
  }

  async sent(user: RequestUser, query: { page?: string; perPage?: string; status?: TransferStatus }) {
    await this.expirePendingTransfers();
    const { page, perPage } = this.pagination(query);

    return this.prisma.transfer.findMany({
      where: { senderId: user.id, status: query.status },
      include: this.transferInclude(),
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * perPage,
      take: perPage
    });
  }

  async history(user: RequestUser, query: { page?: string; perPage?: string }) {
    await this.expirePendingTransfers();
    const { page, perPage } = this.pagination(query);
    const claimEmail = resolveClaimEmail(user);

    return this.prisma.transfer.findMany({
      where: {
        OR: [
          { senderId: user.id },
          { receiverId: user.id },
          ...(claimEmail ? [{ receiverEmail: claimEmail }] : [])
        ]
      },
      include: this.transferInclude(),
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * perPage,
      take: perPage
    });
  }

  async all(user: RequestUser, query: { page?: string; perPage?: string; status?: TransferStatus }) {
    if (user.role !== UserRole.ADMIN) {
      throw new ForbiddenException("Apenas administradores podem visualizar todas as transferencias.");
    }

    await this.expirePendingTransfers();
    const { page, perPage } = this.pagination(query);
    return this.prisma.transfer.findMany({
      where: { status: query.status },
      include: this.transferInclude(),
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * perPage,
      take: perPage
    });
  }

  async accept(user: RequestUser, transferId: string) {
    await this.expirePendingTransfers();
    await this.ensureTransferTargetsUser(user, transferId);

    const result = await this.prisma.$transaction(async (tx) => {
      const transfer = await tx.transfer.findUnique({
        where: { id: transferId },
        include: { ticket: { include: { event: true } }, sender: true }
      });
      if (!transfer) {
        throw new NotFoundException("Transferencia nao encontrada.");
      }
      if (transfer.status !== TransferStatus.PENDING) {
        throw new BadRequestException("Esta transferencia nao esta pendente.");
      }

      this.ensureTicketCanBeTransferred(transfer.ticket);

      const recipient = await tx.user.findUnique({ where: { id: user.id } });
      if (!recipient) {
        throw new NotFoundException("Usuario destinatario nao encontrado.");
      }

      const qr = await this.generateTicketQr(transfer.ticket.orderId);

      const updatedTicket = await tx.ticket.updateMany({
        where: { id: transfer.ticketId, status: TicketStatus.AVAILABLE },
        data: {
          ownerId: user.id,
          attendeeName: recipient.name,
          attendeeEmail: recipient.email,
          uuid: qr.uuid,
          hash: qr.hash,
          signature: qr.signature,
          qrCodeDataUrl: qr.qrCodeDataUrl
        }
      });
      if (updatedTicket.count !== 1) {
        throw new BadRequestException("O ingresso foi utilizado ou ficou indisponível durante a transferência.");
      }

      const updated = await tx.transfer.update({
        where: {
          id: transfer.id,
          status: TransferStatus.PENDING,
          OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }]
        },
        data: {
          status: TransferStatus.ACCEPTED,
          receiverId: user.id,
          receiverEmail: transfer.receiverEmail ?? recipient.email,
          acceptedAt: new Date(),
          history: { create: { action: "TRANSFER_ACCEPTED", userId: user.id } }
        },
        include: this.transferInclude()
      });

      return { transfer: updated, sender: transfer.sender, previousUuid: transfer.ticket.uuid };
    }).catch((error: unknown) => {
      if (this.isPrismaError(error, "P2025")) {
        throw new BadRequestException("Esta transferência não está mais pendente ou já expirou.");
      }
      throw error;
    });

    // O passe do Google Wallet de quem transferiu deixa de valer.
    void this.googleWallet?.deactivateTicket(result.previousUuid);

    await this.notifications.send({
      userId: result.sender.id,
      type: NotificationType.EMAIL,
      event: NotificationEvent.TICKET_TRANSFER_ACCEPTED,
      recipient: result.sender.email,
      payload: { transferId, ticketId: result.transfer.ticketId, receiverId: user.id },
      dedupeKey: `ticket-transfer-accepted:${transferId}`,
      mail: renderTransferAccepted({
        recipientName: result.sender.name ?? result.sender.email,
        eventTitle: result.transfer.ticket.event.title,
        counterpartName: result.transfer.receiver?.name ?? user.email,
        actionUrl: this.appUrl("/me/ingressos")
      })
    });

    await this.audit.log({
      userId: user.id,
      action: "ticket_transfer.accepted",
      entity: "transfer",
      entityId: transferId,
      metadata: { ticketId: result.transfer.ticketId }
    });

    return result.transfer;
  }

  async reject(user: RequestUser, transferId: string) {
    await this.expirePendingTransfers();
    await this.ensureTransferTargetsUser(user, transferId);

    let transfer;
    try {
      transfer = await this.prisma.transfer.update({
        where: { id: transferId, status: TransferStatus.PENDING },
        data: {
          status: TransferStatus.DECLINED,
          declinedAt: new Date(),
          history: { create: { action: "TRANSFER_DECLINED", userId: user.id } }
        },
        include: this.transferInclude()
      });
    } catch (error) {
      if (this.isPrismaError(error, "P2025")) {
        throw new BadRequestException("Esta transferência não está mais pendente.");
      }
      throw error;
    }

    await this.notifications.send({
      userId: transfer.senderId,
      type: NotificationType.EMAIL,
      event: NotificationEvent.TICKET_TRANSFER_DECLINED,
      recipient: transfer.sender.email,
      payload: { transferId, ticketId: transfer.ticketId, receiverId: user.id },
      dedupeKey: `ticket-transfer-declined:${transferId}`,
      mail: renderTransferDeclined({
        recipientName: transfer.sender.name,
        eventTitle: transfer.ticket.event.title,
        counterpartName: transfer.receiver?.name ?? user.email,
        actionUrl: this.appUrl("/me/ingressos")
      })
    });

    await this.audit.log({
      userId: user.id,
      action: "ticket_transfer.declined",
      entity: "transfer",
      entityId: transferId,
      metadata: { ticketId: transfer.ticketId }
    });

    return transfer;
  }

  async cancel(user: RequestUser, transferId: string) {
    await this.expirePendingTransfers();
    const transfer = await this.prisma.transfer.findUnique({ where: { id: transferId } });
    if (!transfer) {
      throw new NotFoundException("Transferencia nao encontrada.");
    }
    if (transfer.senderId !== user.id && user.role !== UserRole.ADMIN) {
      throw new ForbiddenException("Voce nao pode cancelar esta transferencia.");
    }
    if (transfer.status !== TransferStatus.PENDING) {
      throw new BadRequestException("Somente transferencias pendentes podem ser canceladas.");
    }

    let updated;
    try {
      updated = await this.prisma.transfer.update({
        where: { id: transferId, status: TransferStatus.PENDING },
        data: {
          status: TransferStatus.CANCELLED,
          cancelledAt: new Date(),
          history: { create: { action: "TRANSFER_CANCELLED", userId: user.id } }
        },
        include: this.transferInclude()
      });
    } catch (error) {
      if (this.isPrismaError(error, "P2025")) {
        throw new BadRequestException("Esta transferência não está mais pendente.");
      }
      throw error;
    }

    await this.audit.log({
      userId: user.id,
      action: "ticket_transfer.cancelled",
      entity: "transfer",
      entityId: transferId,
      metadata: { ticketId: transfer.ticketId }
    });

    return updated;
  }

  private async lookupRecipient(dto: ResolveTransferRecipientDto): Promise<RecipientLookup> {
    const receiverEmail = dto.receiverEmail?.trim().toLowerCase();
    if (!receiverEmail) {
      throw new BadRequestException("Informe o e-mail do destinatario.");
    }

    const user = await this.prisma.user.findUnique({
      where: { email: receiverEmail },
      select: { id: true, name: true, email: true, avatarUrl: true }
    });
    return { receiverId: user?.id, receiverEmail, user: user ?? undefined };
  }

  private async findOwnedTicket(user: RequestUser, ticketId: string) {
    // Only a verified address may claim a guest ticket. Otherwise anyone could
    // register with someone else's e-mail and transfer that person's ticket away.
    const email = resolveClaimEmail(user);
    const ticket = await this.prisma.ticket.findFirst({
      where: {
        id: ticketId,
        OR: [
          { ownerId: user.id },
          { ownerId: null, order: { userId: user.id } },
          ...(email
            ? [
                {
                  ownerId: null,
                  OR: [{ attendeeEmail: email }, { order: { buyerEmail: email } }]
                }
              ]
            : [])
        ]
      },
      include: { event: true, ticketType: true, order: true }
    });
    if (!ticket) {
      throw new NotFoundException("Ingresso nao encontrado.");
    }
    return ticket;
  }

  private ensureTicketCanBeTransferred(ticket: { status: TicketStatus; usedAt: Date | null; event: { startsAt: Date; endsAt: Date | null; allowTicketTransfer: boolean; ticketTransferLockTime: Date | null } }) {
    if (!ticket.event.allowTicketTransfer) {
      throw new BadRequestException("A transferência de ingressos não está permitida para este evento.");
    }
    if (ticket.event.ticketTransferLockTime && new Date() >= new Date(ticket.event.ticketTransferLockTime)) {
      throw new BadRequestException("As transferências de ingressos para este evento já foram encerradas.");
    }
    if (ticket.status === TicketStatus.USED || ticket.usedAt) {
      throw new BadRequestException("Nao e permitido transferir ingresso ja utilizado.");
    }
    if (ticket.status === TicketStatus.CANCELED) {
      throw new BadRequestException("Nao e permitido transferir ingresso cancelado.");
    }
    if (ticket.status !== TicketStatus.AVAILABLE) {
      throw new BadRequestException("Somente ingressos disponiveis podem ser transferidos.");
    }
    const eventEndsAt = ticket.event.endsAt ?? ticket.event.startsAt;
    if (eventEndsAt < new Date()) {
      throw new BadRequestException("Nao e permitido transferir ingresso expirado.");
    }
  }

  private async ensureTransferTargetsUser(user: RequestUser, transferId: string) {
    const transfer = await this.prisma.transfer.findUnique({ where: { id: transferId } });
    if (!transfer) {
      throw new NotFoundException("Transferencia nao encontrada.");
    }
    if (transfer.status !== TransferStatus.PENDING) {
      throw new BadRequestException("Esta transferencia nao esta pendente.");
    }
    const claimEmail = resolveClaimEmail(user);
    if (transfer.receiverId === user.id) {
      return transfer;
    }
    if (claimEmail && transfer.receiverEmail === claimEmail) {
      return transfer;
    }
    throw new ForbiddenException("Esta transferencia nao pertence ao usuario autenticado.");
  }

  private ensureNotSelf(sender: RequestUser, recipient: RecipientLookup) {
    if (recipient.receiverId === sender.id || recipient.receiverEmail === sender.email.toLowerCase()) {
      throw new BadRequestException("Nao e permitido transferir um ingresso para si mesmo.");
    }
  }

  private confirmSensitiveAction(confirmation: string) {
    if (confirmation.trim().toUpperCase() !== "CONFIRMAR") {
      throw new BadRequestException("Digite CONFIRMAR para concluir esta ação.");
    }
  }

  private async expirePendingTransfers() {
    const cacheKey = "transfers:expire-pending";
    if (await this.cache.get(cacheKey)) return;
    await this.cache.set(cacheKey, { startedAt: Date.now() }, 60);

    const expired = await this.prisma.transfer.findMany({
      where: { status: TransferStatus.PENDING, expiresAt: { lt: new Date() } },
      include: {
        sender: true,
        receiver: { select: { name: true } },
        ticket: { include: { event: true } }
      },
      orderBy: { expiresAt: "asc" },
      take: 100
    });

    if (!expired.length) return;

    for (const transfer of expired) {
      try {
        await this.prisma.transfer.update({
          where: { id: transfer.id, status: TransferStatus.PENDING, expiresAt: { lt: new Date() } },
          data: {
            status: TransferStatus.EXPIRED,
            history: { create: { action: "TRANSFER_EXPIRED", userId: transfer.senderId } }
          }
        });
      } catch (error) {
        if (this.isPrismaError(error, "P2025")) continue;
        throw error;
      }

      await this.notifications.send({
        userId: transfer.senderId,
        type: NotificationType.EMAIL,
        event: NotificationEvent.TICKET_TRANSFER_EXPIRED,
        recipient: transfer.sender.email,
        payload: { transferId: transfer.id, ticketId: transfer.ticketId },
        dedupeKey: `ticket-transfer-expired:${transfer.id}`,
        mail: renderTransferExpired({
          recipientName: transfer.sender.name,
          eventTitle: transfer.ticket.event.title,
          counterpartName: transfer.receiver?.name ?? transfer.receiverEmail ?? "destinatário",
          actionUrl: this.appUrl("/me/ingressos")
        })
      });
    }
  }

  private async generateTicketQr(orderId: string) {
    const uuid = randomUUID();
    const secret = this.config.get<string>("QR_CODE_SECRET");
    if (!secret) {
      throw new Error("QR_CODE_SECRET is required.");
    }
    const signature = createHmac("sha256", secret).update(`${uuid}:${orderId}`).digest("hex");
    const hash = createHash("sha256").update(uuid).digest("hex");
    const payload = JSON.stringify({ uuid, orderId, signature });
    const qrCodeDataUrl = await QRCode.toDataURL(payload);
    return { uuid, signature, hash, qrCodeDataUrl };
  }

  private transferInclude() {
    return {
      ticket: {
        include: {
          event: true,
          ticketType: true,
          order: { select: { id: true, status: true, buyerEmail: true } }
        }
      },
      sender: { select: { id: true, name: true, email: true, avatarUrl: true } },
      receiver: { select: { id: true, name: true, email: true, avatarUrl: true } },
      history: { orderBy: { timestamp: "asc" as const } }
    } satisfies Prisma.TransferInclude;
  }

  private pagination(query: { page?: string; perPage?: string }) {
    const page = Math.max(Number(query.page ?? 1), 1);
    const perPage = Math.min(Math.max(Number(query.perPage ?? 20), 1), 100);
    return { page, perPage };
  }

  private compactJson<T extends Record<string, unknown>>(value: T): Prisma.InputJsonObject {
    return Object.fromEntries(Object.entries(value).filter(([, item]) => item !== undefined)) as Prisma.InputJsonObject;
  }

  private transferExpiresAt(event: { startsAt: Date; endsAt: Date | null; ticketTransferLockTime: Date | null }) {
    const limits = [Date.now() + 1000 * 60 * 60 * 24 * 7, (event.endsAt ?? event.startsAt).getTime()];
    if (event.ticketTransferLockTime) limits.push(event.ticketTransferLockTime.getTime());
    return new Date(Math.min(...limits));
  }

  private appUrl(path: string) {
    const base = (this.config.get<string>("APP_URL") ?? "http://localhost:3000").replace(/\/+$/, "");
    return `${base}${path}`;
  }

  private isPrismaError(error: unknown, code: string) {
    return typeof error === "object" && error !== null && (error as { code?: string }).code === code;
  }
}
