import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { UserRole } from "@prisma/client";
import * as bcrypt from "bcryptjs";
import { nanoid } from "nanoid";
import { PrismaService } from "../../prisma/prisma.service";
import { AddMemberDto } from "./dto/add-member.dto";
import { UpdatePermissionsDto } from "./dto/update-permissions.dto";

@Injectable()
export class TeamService {
  constructor(private readonly prisma: PrismaService) {}

  async addMember(tenantId: string, dto: AddMemberDto) {
    let user = await this.prisma.user.findUnique({ where: { email: dto.email.toLowerCase() } });
    
    if (user && user.tenantId && user.tenantId !== tenantId) {
      throw new BadRequestException("Usuario ja pertence a outra organizacao.");
    }

    if (!user) {
      const tempPassword = nanoid(10);
      const passwordHash = await bcrypt.hash(tempPassword, 12);
      
      user = await this.prisma.user.create({
        data: {
          tenantId,
          name: dto.name,
          email: dto.email.toLowerCase(),
          passwordHash,
          role: UserRole.TEAM
        }
      });
      // Em um ambiente real, enviariamos um email com a senha temporaria aqui.
    }

    const existingMember = await this.prisma.teamMember.findUnique({
      where: { tenantId_userId: { tenantId, userId: user.id } }
    });

    if (existingMember) {
      throw new BadRequestException("Usuario ja e membro desta equipe.");
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
      throw new NotFoundException("Membro nao encontrado.");
    }

    return this.prisma.teamMember.update({
      where: { id },
      data: { permissions: dto.permissions },
      include: { user: { select: { id: true, name: true, email: true, role: true } } }
    });
  }

  async removeMember(id: string, tenantId: string) {
    const member = await this.prisma.teamMember.findFirst({ where: { id, tenantId } });
    if (!member) {
      throw new NotFoundException("Membro nao encontrado.");
    }
    
    await this.prisma.teamMember.delete({ where: { id } });
    return { success: true };
  }
}
