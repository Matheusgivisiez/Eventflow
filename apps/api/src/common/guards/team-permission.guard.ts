import { CanActivate, ExecutionContext, Injectable, ForbiddenException } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { EventAccessRole, TeamPermission, UserRole } from "@prisma/client";
import { PERMISSIONS_KEY } from "../decorators/permissions.decorator";
import { RequestUser } from "../types/request-user";
import { PrismaService } from "../../prisma/prisma.service";

@Injectable()
export class TeamPermissionGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredPermissions = this.reflector.getAllAndOverride<TeamPermission[]>(PERMISSIONS_KEY, [
      context.getHandler(),
      context.getClass()
    ]);

    if (!requiredPermissions?.length) {
      return true;
    }

    const request = context.switchToHttp().getRequest<{ user?: RequestUser }>();
    const user = request.user;

    if (!user) return false;
    
    // Organizers and Admins bypass permission checks
    if (user.role === UserRole.ORGANIZER || user.role === UserRole.ADMIN) {
      return true;
    }

    // Só colaboradores (TEAM) que ainda pertencem à equipe da organização passam daqui.
    if (user.role !== UserRole.TEAM || !user.tenantId) {
      return false;
    }

    const member = await this.prisma.teamMember.findUnique({
      where: { tenantId_userId: { tenantId: user.tenantId, userId: user.id } }
    });
    if (!member) {
      return false;
    }

    if (!requiredPermissions.every((perm) => member.permissions.includes(perm) || (perm === TeamPermission.CHECK_IN && !member.scopeConfigured))) {
      throw new ForbiddenException("Você não tem permissão para realizar esta ação na equipe.");
    }

    if (requiredPermissions.includes(TeamPermission.CHECK_IN)) {
      const checkInRequest = context.switchToHttp().getRequest<{ params?: { eventId?: string }; body?: { eventId?: string } }>();
      const eventId = checkInRequest.params?.eventId ?? checkInRequest.body?.eventId;
      if (!eventId) return member.permissions.includes(TeamPermission.CHECK_IN);
      if (member.scopeConfigured) {
        const event = await this.prisma.event.findFirst({ where: { id: eventId, tenantId: user.tenantId }, select: { id: true, ownerId: true } });
        if (!event || (member.allEvents && member.managerId !== event.ownerId) || (!member.allEvents && !member.eventIds.includes(eventId))) {
          throw new ForbiddenException("Você não está atribuído à portaria deste evento.");
        }
        return true;
      }
      const eventAccess = await this.prisma.eventAccess.findFirst({
        where: { eventId, userId: user.id, event: { tenantId: user.tenantId } },
        select: { role: true }
      });
      if (eventAccess?.role !== EventAccessRole.GESTOR && eventAccess?.role !== EventAccessRole.OPERACAO) {
        throw new ForbiddenException("Você não está atribuído à portaria deste evento.");
      }
    }

    return true;
  }
}
