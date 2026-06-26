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

    if (user.role !== UserRole.TEAM || !user.tenantId) {
      return false;
    }

    const member = await this.prisma.teamMember.findUnique({
      where: { tenantId_userId: { tenantId: user.tenantId, userId: user.id } }
    });

    if (!member) return false;

    const hasPermission = requiredPermissions.every((perm) => member.permissions.includes(perm));
    
    if (!hasPermission) {
      throw new ForbiddenException("Voce nao tem permissao para realizar esta acao na equipe.");
    }

    return true;
  }
}
