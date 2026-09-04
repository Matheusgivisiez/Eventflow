import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import * as bcrypt from "bcryptjs";
import { NotificationEvent, NotificationType, Prisma, TicketStatus, TransferStatus, User, UserRole } from "@prisma/client";
import QRCode from "qrcode";
import { createHash, createHmac, randomUUID } from "crypto";
import { RequestUser } from "../../common/types/request-user";
import { PrismaService } from "../../prisma/prisma.service";
import { AuditService } from "../audit/audit.service";
import { NotificationsService } from "../notifications/notifications.service";
import { CreateTransferDto, ResolveTransferRecipientDto } from "./dto/create-transfer.dto";

type RecipientLookup = {
  receiverId?: string;
  receiverEmail?: string;
  receiverCpf?: string;
  user?: Pick<User, "id" | "name" | "email" | "avatarUrl">;
};

@Injectable()
export class TransfersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly notifications: NotificationsService,
    private readonly config: ConfigService
  ) {}

  async resolveRecipient(sender: RequestUser, dto: ResolveTransferRecipientDto) {
    const recipient = await this.lookupRecipient(dto);
    this.ensureNotSelf(sender, recipient);

    return {
      exists: Boolean(recipient.user),
      user: recipient.user
        ? {
            id: recipient.user.id,
            name: recipient.user.name,
            email: recipient.user.email,
            avatarUrl: recipient.user.avatarUrl
          }
        : undefined,
      receiverEmail: recipient.receiverEmail,
      receiverCpf: recipient.receiverCpf
    };
  }

  async create(sender: RequestUser, dto: CreateTransferDto) {
    await this.confirmPassword(sender.id, dto.password);
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

    const transfer = await this.prisma.transfer.create({
      data: {
        ticketId: ticket.id,
        senderId: sender.id,
        receiverId: recipient.receiverId,
        receiverEmail: recipient.receiverEmail,
        receiverCpf: recipient.receiverCpf,
        expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 7),
        history: {
          create: {
            action: "TRANSFER_CREATED",
            userId: sender.id,
            metadata: {
              receiverEmail: recipient.receiverEmail,
              receiverCpf: recipient.receiverCpf,
              receiverId: recipient.receiverId
            }
          }
        }
      },
      include: this.transferInclude()
    });

    await this.notifications.send({
      userId: recipient.receiverId,
      type: NotificationType.EMAIL,
      event: NotificationEvent.TICKET_TRANSFER_RECEIVED,
      recipient: recipient.receiverEmail ?? recipient.user?.email ?? sender.email,
      payload: {
        transferId: transfer.id,
        ticketId: ticket.id,
        eventTitle: ticket.event.title,
        senderId: sender.id
      }
    });

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
    const receiverCpfValues = await this.userCpfValues(user);

    return this.prisma.transfer.findMany({
      where: {
        status: query.status,
        OR: [
          { receiverId: user.id },
          { receiverEmail: user.email.toLowerCase() },
          ...(receiverCpfValues.length ? [{ receiverCpf: { in: receiverCpfValues } }] : [])
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
    const receiverCpfValues = await this.userCpfValues(user);

    return this.prisma.transfer.findMany({
      where: {
        OR: [
          { senderId: user.id },
          { receiverId: user.id },
          { receiverEmail: user.email.toLowerCase() },
          ...(receiverCpfValues.length ? [{ receiverCpf: { in: receiverCpfValues } }] : [])
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

      await tx.ticket.update({
        where: { id: transfer.ticketId },
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

      const updated = await tx.transfer.update({
        where: { id: transfer.id },
        data: {
          status: TransferStatus.ACCEPTED,
          receiverId: user.id,
          receiverEmail: transfer.receiverEmail ?? recipient.email,
          acceptedAt: new Date(),
          history: { create: { action: "TRANSFER_ACCEPTED", userId: user.id } }
        },
        include: this.transferInclude()
      });

      return { transfer: updated, sender: transfer.sender };
    });

    await this.notifications.send({
      userId: result.sender.id,
      type: NotificationType.EMAIL,
      event: NotificationEvent.TICKET_TRANSFER_ACCEPTED,
      recipient: result.sender.email,
      payload: { transferId, ticketId: result.transfer.ticketId, receiverId: user.id }
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

    const transfer = await this.prisma.transfer.update({
      where: { id: transferId },
      data: {
        status: TransferStatus.DECLINED,
        declinedAt: new Date(),
        history: { create: { action: "TRANSFER_DECLINED", userId: user.id } }
      },
      include: this.transferInclude()
    });

    await this.notifications.send({
      userId: transfer.senderId,
      type: NotificationType.EMAIL,
      event: NotificationEvent.TICKET_TRANSFER_DECLINED,
      recipient: transfer.sender.email,
      payload: { transferId, ticketId: transfer.ticketId, receiverId: user.id }
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

    const updated = await this.prisma.transfer.update({
      where: { id: transferId },
      data: {
        status: TransferStatus.CANCELLED,
        cancelledAt: new Date(),
        history: { create: { action: "TRANSFER_CANCELLED", userId: user.id } }
      },
      include: this.transferInclude()
    });

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
    const receiverCpf = dto.receiverCpf ? this.onlyDigits(dto.receiverCpf) : undefined;

    if (!receiverEmail && !receiverCpf) {
      throw new BadRequestException("Informe o e-mail ou CPF do destinatario.");
    }

    if (receiverEmail) {
      const user = await this.prisma.user.findUnique({
        where: { email: receiverEmail },
        select: { id: true, name: true, email: true, avatarUrl: true }
      });
      return { receiverId: user?.id, receiverEmail, user: user ?? undefined };
    }

    const order = await this.prisma.order.findFirst({
      where: { buyerDocument: receiverCpf, userId: { not: null } },
      include: { user: { select: { id: true, name: true, email: true, avatarUrl: true } } },
      orderBy: { createdAt: "desc" }
    });

    return {
      receiverId: order?.user?.id,
      receiverEmail: order?.user?.email,
      receiverCpf,
      user: order?.user ?? undefined
    };
  }

  private async findOwnedTicket(user: RequestUser, ticketId: string) {
    const email = user.email.toLowerCase();
    const ticket = await this.prisma.ticket.findFirst({
      where: {
        id: ticketId,
        OR: [
          { ownerId: user.id },
          {
            ownerId: null,
            OR: [{ attendeeEmail: email }, { order: { buyerEmail: email } }]
          }
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
    if (transfer.receiverId === user.id || transfer.receiverEmail === user.email.toLowerCase()) {
      return transfer;
    }
    if (transfer.receiverCpf) {
      const cpfValues = await this.userCpfValues(user);
      if (cpfValues.includes(transfer.receiverCpf)) {
        return transfer;
      }
    }
    throw new ForbiddenException("Esta transferencia nao pertence ao usuario autenticado.");
  }

  private ensureNotSelf(sender: RequestUser, recipient: RecipientLookup) {
    if (recipient.receiverId === sender.id || recipient.receiverEmail === sender.email.toLowerCase()) {
      throw new BadRequestException("Nao e permitido transferir um ingresso para si mesmo.");
    }
  }

  private async confirmPassword(userId: string, password: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { passwordHash: true },
    });
    if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
      throw new ForbiddenException("Senha inválida.");
    }
  }

  private async userCpfValues(user: RequestUser) {
    const orders = await this.prisma.order.findMany({
      where: {
        OR: [{ userId: user.id }, { buyerEmail: user.email.toLowerCase() }],
        buyerDocument: { not: null }
      },
      select: { buyerDocument: true },
      take: 100
    });

    return Array.from(new Set(orders.map((order) => this.onlyDigits(order.buyerDocument ?? "")).filter(Boolean)));
  }

  private async expirePendingTransfers() {
    const expired = await this.prisma.transfer.findMany({
      where: { status: TransferStatus.PENDING, expiresAt: { lt: new Date() } },
      include: { sender: true }
    });

    for (const transfer of expired) {
      await this.prisma.transfer.update({
        where: { id: transfer.id },
        data: {
          status: TransferStatus.EXPIRED,
          history: { create: { action: "TRANSFER_EXPIRED", userId: transfer.senderId } }
        }
      });
      await this.notifications.send({
        userId: transfer.senderId,
        type: NotificationType.EMAIL,
        event: NotificationEvent.TICKET_TRANSFER_EXPIRED,
        recipient: transfer.sender.email,
        payload: { transferId: transfer.id, ticketId: transfer.ticketId }
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

  private onlyDigits(value: string) {
    return value.replace(/\D/g, "");
  }
}
