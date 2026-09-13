import { BadRequestException, Injectable, UnauthorizedException } from "@nestjs/common";
import * as bcrypt from "bcryptjs";
import { PrismaService } from "../../prisma/prisma.service";
import { EmailVerificationService } from "../email-verification/email-verification.service";
import { ChangePasswordDto, UpdateProfileDto } from "./dto/update-profile.dto";

@Injectable()
export class ProfileService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly emailVerification: EmailVerificationService
  ) {}

  async update(userId: string, tenantId: string, dto: UpdateProfileDto) {
    const current = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, name: true }
    });
    if (!current) {
      throw new BadRequestException("Usuario nao encontrado.");
    }

    const emailChanged = EmailVerificationService.isEmailChange(current.email, dto.email);

    const result = await this.prisma.$transaction(async (tx) => {
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
          phone: dto.phone,
          // A changed address carries no proof of ownership until confirmed.
          ...(emailChanged ? EmailVerificationService.clearedVerificationData() : {})
        },
        select: { id: true, name: true, email: true, emailVerifiedAt: true, phone: true, role: true, tenantId: true }
      });

      const tenant = await tx.tenant.update({
        where: { id: tenantId },
        data: { name: dto.companyName, logoUrl: dto.logoUrl }
      });

      return { ...user, emailVerified: Boolean(user.emailVerifiedAt), tenant };
    });

    if (emailChanged) {
      // Outside the transaction: SMTP must not hold a lock, and a mail outage
      // must not roll back a profile the user already saved.
      await this.emailVerification.handleEmailChanged({
        id: result.id,
        email: result.email,
        name: result.name
      });
    }

    return result;
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

  /**
   * @param email verified e-mail of the account, or null when unverified.
   *   An unverified account must not reach guest orders by buyerEmail.
   */
  async myTickets(email: string | null, userId?: string) {
    const normalizedEmail = email?.toLowerCase() ?? null;
    return this.prisma.ticket.findMany({
      where: {
        OR: [
          ...(userId ? [{ ownerId: userId }, { ownerId: null, order: { userId } }] : []),
          ...(normalizedEmail
            ? [
                {
                  ownerId: null,
                  OR: [
                    { attendeeEmail: normalizedEmail },
                    { order: { buyerEmail: normalizedEmail } }
                  ]
                }
              ]
            : [])
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
