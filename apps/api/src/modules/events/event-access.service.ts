import { ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { EventAccessRole, TeamPermission, UserRole } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";

@Injectable()
export class EventAccessService {
  constructor(private readonly prisma: PrismaService) {}

  async assertAccess(eventId: string, userId: string, allowedRoles: EventAccessRole[]) {
    const role = await this.roleFor(eventId, userId);
    if (role !== "OWNER" && !allowedRoles.includes(role)) {
      throw new ForbiddenException("Você não tem permissão para acessar este evento.");
    }
  }

  async roleFor(eventId: string, userId: string): Promise<EventAccessRole | "OWNER"> {
    const event = await this.prisma.event.findUnique({ where: { id: eventId }, select: { id: true, ownerId: true, tenantId: true } });
    if (!event) throw new NotFoundException("Evento não encontrado.");
    if (event.ownerId === userId) return "OWNER";
    const member = await this.prisma.teamMember.findUnique({
      where: { tenantId_userId: { tenantId: event.tenantId, userId } },
      include: { user: { select: { role: true } } }
    });
    if (!member || member.user.role !== UserRole.TEAM) throw new ForbiddenException("Você não tem permissão para acessar este evento.");
    if (member.scopeConfigured) {
      if ((member.allEvents && member.managerId !== event.ownerId) || (!member.allEvents && !member.eventIds.includes(eventId))) {
        throw new ForbiddenException("Você não foi atribuído a este evento.");
      }
      const canEdit = member.permissions.includes(TeamPermission.EDIT_EVENT);
      const canCheckIn = member.permissions.includes(TeamPermission.CHECK_IN);
      if (canEdit && canCheckIn) return EventAccessRole.GESTOR;
      if (canEdit) return EventAccessRole.EDITOR;
      if (canCheckIn) return EventAccessRole.OPERACAO;
      throw new ForbiddenException("Você não tem permissão para acessar este evento.");
    }
    const access = await this.prisma.eventAccess.findUnique({ where: { eventId_userId: { eventId, userId } } });
    if (!access) throw new ForbiddenException("Você não tem permissão para acessar este evento.");
    return access.role;
  }

  async assertOwner(eventId: string, userId: string) {
    const event = await this.prisma.event.findUnique({ where: { id: eventId }, select: { ownerId: true } });
    if (!event) throw new NotFoundException("Evento não encontrado.");
    if (event.ownerId !== userId) throw new ForbiddenException("Somente quem criou o evento pode gerenciar estes acessos.");
  }

  async assertTicketTypeAccess(ticketTypeId: string, userId: string, allowedRoles: EventAccessRole[]) {
    const ticketType = await this.prisma.ticketType.findUnique({ where: { id: ticketTypeId }, select: { eventId: true } });
    if (!ticketType) throw new NotFoundException("Lote de ingresso não encontrado.");
    return this.assertAccess(ticketType.eventId, userId, allowedRoles);
  }

  async list(eventId: string, userId: string, tenantId: string) {
    await this.assertOwner(eventId, userId);
    return this.prisma.eventAccess.findMany({
      where: { eventId, event: { tenantId } },
      include: { user: { select: { id: true, name: true, email: true, role: true } } },
      orderBy: { createdAt: "asc" }
    });
  }

  async add(eventId: string, userId: string, tenantId: string, targetUserId: string, role: EventAccessRole) {
    await this.assertOwner(eventId, userId);
    const [event, target, teamMember] = await Promise.all([
      this.prisma.event.findFirst({ where: { id: eventId, tenantId }, select: { id: true } }),
      this.prisma.user.findUnique({ where: { id: targetUserId }, select: { id: true, tenantId: true, role: true } }),
      this.prisma.teamMember.findUnique({ where: { tenantId_userId: { tenantId, userId: targetUserId } }, select: { id: true } })
    ]);
    if (!event) throw new NotFoundException("Evento não encontrado.");
    if (!target || target.tenantId !== tenantId || target.role !== UserRole.TEAM || !teamMember) {
      throw new ForbiddenException("A pessoa precisa primeiro pertencer à equipe desta organização.");
    }
    return this.prisma.$transaction(async (tx) => {
      const previous = await tx.eventAccess.findUnique({ where: { eventId_userId: { eventId, userId: targetUserId } }, select: { role: true } });
      const assignment = await tx.eventAccess.upsert({
        where: { eventId_userId: { eventId, userId: targetUserId } },
        create: { eventId, userId: targetUserId, role },
        update: { role },
        include: { user: { select: { id: true, name: true, email: true, role: true } } }
      });
      await tx.auditLog.create({ data: {
        userId,
        action: previous ? "event_access.role_changed" : "event_access.granted",
        entity: "event_access",
        entityId: eventId,
        metadata: { targetUserId, role, previousRole: previous?.role ?? null }
      } });
      return assignment;
    });
  }

  async remove(eventId: string, userId: string, memberUserId: string) {
    await this.assertOwner(eventId, userId);
    await this.prisma.$transaction(async (tx) => {
      const removed = await tx.eventAccess.delete({ where: { eventId_userId: { eventId, userId: memberUserId } } });
      await tx.auditLog.create({ data: {
        userId,
        action: "event_access.revoked",
        entity: "event_access",
        entityId: eventId,
        metadata: { targetUserId: memberUserId, role: removed.role }
      } });
    });
    return { success: true };
  }
}
