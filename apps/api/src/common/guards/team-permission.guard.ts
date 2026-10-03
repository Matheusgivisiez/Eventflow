import { CanActivate, ExecutionContext, Injectable, ForbiddenException } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { TeamPermission, UserRole } from "@prisma/client";
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

    if (requiredPermissions.includes(TeamPermission.CHECK_IN)) {
      const request = context.switchToHttp().getRequest<{ params?: { eventId?: string } }>();
      const eventId = request.params?.eventId;
      if (!eventId || !user.tenantId) return false;
      const eventAccess = await this.prisma.eventAccess.findFirst({
        where: { eventId, userId: user.id, event: { tenantId: user.tenantId } },
        select: { role: true }
      });
      return eventAccess?.role === "GESTOR" || eventAccess?.role === "OPERACAO";
    }

    if (user.role !== UserRole.TEAM || !user.tenantId) {
      return false;
    }

    const member = await this.prisma.teamMember.findUnique({
      where: { tenantId_userId: { tenantId: user.tenantId, userId: user.id } }
    });

    if (!member) {
      const eventId = context.switchToHttp().getRequest<{ params?: { eventId?: string } }>().params?.eventId;
      if (!eventId) return false;
      const eventAccess = await this.prisma.eventAccess.findUnique({ where: { eventId_userId: { eventId, userId: user.id } } });
      return eventAccess?.role === "GESTOR" || eventAccess?.role === "OPERACAO";
    }

    const hasPermission = requiredPermissions.every((perm) => member.permissions.includes(perm));
    
    if (!hasPermission) {
      const eventId = context.switchToHttp().getRequest<{ params?: { eventId?: string } }>().params?.eventId;
      if (eventId) {
        const eventAccess = await this.prisma.eventAccess.findUnique({ where: { eventId_userId: { eventId, userId: user.id } } });
        if (eventAccess?.role === "GESTOR" || eventAccess?.role === "OPERACAO") return true;
      }
      throw new ForbiddenException("Você não tem permissão para realizar esta ação na equipe.");
    }

    return true;
  }
}
