import { BadRequestException, Injectable, UnauthorizedException } from "@nestjs/common";
import * as bcrypt from "bcryptjs";
import { PrismaService } from "../../prisma/prisma.service";
import { ChangePasswordDto, UpdateProfileDto } from "./dto/update-profile.dto";

@Injectable()
export class ProfileService {
  constructor(private readonly prisma: PrismaService) {}

  async update(userId: string, tenantId: string, dto: UpdateProfileDto) {
    return this.prisma.$transaction(async (tx) => {
      if (dto.email) {
        const exists = await tx.user.findFirst({ where: { email: dto.email.toLowerCase(), NOT: { id: userId } } });
        if (exists) {
          throw new BadRequestException("Este e-mail ja esta em uso.");
        }
      }

      const user = await tx.user.update({
        where: { id: userId },
        data: {
          name: dto.name,
          email: dto.email?.toLowerCase(),
          phone: dto.phone
        },
        select: { id: true, name: true, email: true, phone: true, role: true, tenantId: true }
      });

      const tenant = await tx.tenant.update({
        where: { id: tenantId },
        data: { name: dto.companyName, logoUrl: dto.logoUrl }
      });

      return { ...user, tenant };
    });
  }

  async changePassword(userId: string, dto: ChangePasswordDto) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user || !(await bcrypt.compare(dto.currentPassword, user.passwordHash))) {
      throw new UnauthorizedException("Senha atual invalida.");
    }
    await this.prisma.user.update({
      where: { id: userId },
      data: { passwordHash: await bcrypt.hash(dto.newPassword, 12) }
    });
    return { message: "Senha alterada com sucesso." };
  }

  async myTickets(email: string, userId?: string) {
    const normalizedEmail = email.toLowerCase();
    return this.prisma.ticket.findMany({
      where: {
        OR: [
          ...(userId ? [{ ownerId: userId }] : []),
          {
            ownerId: null,
            OR: [
              { attendeeEmail: normalizedEmail },
              { order: { buyerEmail: normalizedEmail } }
            ]
          }
        ]
      },
      include: {
        event: { select: { title: true, slug: true, startsAt: true, bannerUrl: true, city: true, state: true } },
        ticketType: { select: { name: true } },
        order: { select: { id: true, status: true } }
      },
      orderBy: { createdAt: "desc" }
    });
  }
}
