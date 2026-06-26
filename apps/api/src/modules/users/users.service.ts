import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { UpdateUserDto } from "./dto/update-user.dto";

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  list(tenantId: string) {
    return this.prisma.user.findMany({
      where: { tenantId },
      select: { id: true, name: true, email: true, phone: true, role: true, createdAt: true },
      orderBy: { createdAt: "desc" }
    });
  }

  async update(id: string, tenantId: string, dto: UpdateUserDto) {
    const user = await this.prisma.user.findFirst({ where: { id, tenantId } });
    if (!user) {
      throw new NotFoundException("Usuario nao encontrado.");
    }
    return this.prisma.user.update({
      where: { id },
      data: { ...dto, email: dto.email?.toLowerCase() },
      select: { id: true, name: true, email: true, phone: true, role: true, updatedAt: true }
    });
  }
}
