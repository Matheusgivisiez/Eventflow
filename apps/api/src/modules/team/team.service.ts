import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { UserRole } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { AddMemberDto } from "./dto/add-member.dto";
import { UpdatePermissionsDto } from "./dto/update-permissions.dto";

@Injectable()
export class TeamService {
  constructor(private readonly prisma: PrismaService) {}

  async addMember(tenantId: string, dto: AddMemberDto) {
    let user = await this.prisma.user.findUnique({ where: { email: dto.email.toLowerCase() } });
    
    if (user && user.tenantId && user.tenantId !== tenantId) {
      throw new BadRequestException("Usuário ja pertence a outra organização.");
    }

    if (!user) {
      throw new BadRequestException("A pessoa precisa criar uma conta Event Flow antes de entrar na equipe.");
    }

    if (user.role === UserRole.CUSTOMER && (!user.tenantId || user.tenantId === tenantId)) {
      user = await this.prisma.user.update({ where: { id: user.id }, data: { tenantId, role: UserRole.TEAM } });
    }
    if (user.role !== UserRole.TEAM || user.tenantId !== tenantId) {
      throw new BadRequestException("Esta conta não pode ser adicionada como colaboradora desta organização.");
    }

    const existingMember = await this.prisma.teamMember.findUnique({
      where: { tenantId_userId: { tenantId, userId: user.id } }
    });

    if (existingMember) {
      throw new BadRequestException("Usuário ja e membro desta equipe.");
    }

    return this.prisma.teamMember.create({
      data: {
        tenantId,
        userId: user.id,
        permissions: dto.permissions
      },
      include: { user: { select: { id: true, name: true, email: true, role: true } } }
    });
  }

  list(tenantId: string) {
    return this.prisma.teamMember.findMany({
      where: { tenantId },
      include: { user: { select: { id: true, name: true, email: true, role: true, avatarUrl: true } } },
      orderBy: { createdAt: "desc" }
    });
  }

  async updatePermissions(id: string, tenantId: string, dto: UpdatePermissionsDto) {
    const member = await this.prisma.teamMember.findFirst({ where: { id, tenantId } });
    if (!member) {
      throw new NotFoundException("Membro não encontrado.");
    }

    return this.prisma.teamMember.update({
      where: { id },
      data: { permissions: dto.permissions },
      include: { user: { select: { id: true, name: true, email: true, role: true } } }
    });
  }

  async removeMember(id: string, tenantId: string, actorUserId?: string) {
    const member = await this.prisma.teamMember.findFirst({ where: { id, tenantId } });
    if (!member) {
      throw new NotFoundException("Membro não encontrado.");
    }
    
    await this.prisma.$transaction(async (tx) => {
      const eventAssignments = await tx.eventAccess.findMany({
        where: { userId: member.userId, event: { tenantId } },
        select: { eventId: true, role: true }
      });
      await tx.eventAccess.deleteMany({ where: { userId: member.userId, event: { tenantId } } });
      await tx.teamMember.delete({ where: { id } });
      for (const assignment of eventAssignments) {
        await tx.auditLog.create({ data: {
          userId: actorUserId,
          action: "event_access.revoked_with_team_membership",
          entity: "event_access",
          entityId: assignment.eventId,
          metadata: { targetUserId: member.userId, role: assignment.role }
        } });
      }
    });
    return { success: true };
  }
}
