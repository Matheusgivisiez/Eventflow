import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { EmailVerificationService } from "../email-verification/email-verification.service";
import { UpdateUserDto } from "./dto/update-user.dto";

const USER_VIEW = {
  id: true,
  name: true,
  email: true,
  emailVerifiedAt: true,
  phone: true,
  role: true,
  updatedAt: true
} as const;

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly emailVerification: EmailVerificationService
  ) {}

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

    return this.applyUpdate(user, {
      ...dto,
      email: dto.email?.toLowerCase()
    });
  }

  async updateMe(userId: string, dto: UpdateUserDto) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException("Usuario nao encontrado.");
    }

    return this.applyUpdate(user, {
      name: dto.name,
      email: dto.email?.toLowerCase(),
      phone: dto.phone
    });
  }

  private async applyUpdate(
    user: { id: string; email: string; name: string },
    data: { name?: string; email?: string; phone?: string; role?: UpdateUserDto["role"] }
  ) {
    const emailChanged = EmailVerificationService.isEmailChange(user.email, data.email);

    if (emailChanged) {
      const taken = await this.prisma.user.findFirst({
        where: { email: data.email!, NOT: { id: user.id } },
        select: { id: true }
      });
      if (taken) {
        throw new BadRequestException("Este e-mail ja esta em uso.");
      }
    }

    const updated = await this.prisma.user.update({
      where: { id: user.id },
      data: {
        ...data,
        // A new address was never proven. Keeping the old proof would let an
        // account move onto someone else's e-mail and claim their purchases.
        ...(emailChanged ? EmailVerificationService.clearedVerificationData() : {})
      },
      select: USER_VIEW
    });

    if (emailChanged) {
      await this.emailVerification.handleEmailChanged({
        id: updated.id,
        email: updated.email,
        name: updated.name
      });
    }

    return { ...updated, emailVerified: Boolean(updated.emailVerifiedAt) };
  }
}
