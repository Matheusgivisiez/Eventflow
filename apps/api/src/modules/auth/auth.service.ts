import { ConflictException, Injectable, Logger, NotFoundException, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import { User, UserRole } from "@prisma/client";
import * as bcrypt from "bcryptjs";
import { createHash, randomUUID } from "crypto";
import { PrismaService } from "../../prisma/prisma.service";
import { MailService } from "../../common/services/mail.service";
import {
  EMAIL_VERIFICATION_RESEND_COOLDOWN_MS,
  EmailVerificationService
} from "../email-verification/email-verification.service";
import { BecomeOrganizerDto } from "./dto/become-organizer.dto";
import { ForgotPasswordDto } from "./dto/forgot-password.dto";
import { LoginDto } from "./dto/login.dto";
import { RefreshTokenDto } from "./dto/refresh-token.dto";
import { RegisterDto } from "./dto/register.dto";
import { RegisterOrganizerDto } from "./dto/register-organizer.dto";
import { ResetPasswordDto } from "./dto/reset-password.dto";

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly mail: MailService,
    private readonly emailVerification: EmailVerificationService
  ) {}

  async register(dto: RegisterDto) {
    const exists = await this.prisma.user.findUnique({ where: { email: dto.email.toLowerCase() } });
    if (exists) {
      throw new ConflictException("Ja existe uma conta com este e-mail.");
    }

    const passwordHash = await bcrypt.hash(dto.password, 12);

    // If companyName is provided, create as ORGANIZER with tenant
    if (dto.companyName) {
      const user = await this.prisma.$transaction(async (tx) => {
        const tenant = await tx.tenant.create({ data: { name: dto.companyName! } });
        return tx.user.create({
          data: {
            tenantId: tenant.id,
            name: dto.name,
            email: dto.email.toLowerCase(),
            passwordHash,
            phone: dto.phone,
            cpf: dto.cpf,
            role: UserRole.ORGANIZER
          }
        });
      });
      await this.issueEmailVerification(user);
      return this.issueSession(user);
    }

    // Default: create as CUSTOMER (no tenant)
    const user = await this.prisma.user.create({
      data: {
        name: dto.name,
        email: dto.email.toLowerCase(),
        passwordHash,
        phone: dto.phone,
        cpf: dto.cpf,
        role: UserRole.CUSTOMER
      }
    });

    await this.issueEmailVerification(user);
    return this.issueSession(user);
  }

  async registerOrganizer(dto: RegisterOrganizerDto) {
    const emailExists = await this.prisma.user.findUnique({ where: { email: dto.email.toLowerCase() } });
    if (emailExists) {
      throw new ConflictException("Ja existe uma conta com este e-mail.");
    }

    const cnpjClean = dto.cnpj.replace(/\D/g, "");
    const cnpjExists = await this.prisma.tenant.findFirst({ where: { document: cnpjClean } });
    if (cnpjExists) {
      throw new ConflictException("Ja existe uma empresa cadastrada com este CNPJ.");
    }

    const passwordHash = await bcrypt.hash(dto.password, 12);

    const user = await this.prisma.$transaction(async (tx) => {
      const tenant = await tx.tenant.create({
        data: {
          name: dto.companyName,
          document: cnpjClean,
          city: dto.city,
          state: dto.state.toUpperCase(),
          website: dto.website?.trim() || null,
          instagram: dto.instagram?.trim().replace(/^@/, "") || null,
          logoUrl: dto.logoUrl?.trim() || null,
        }
      });
      return tx.user.create({
        data: {
          tenantId: tenant.id,
          name: dto.name,
          email: dto.email.toLowerCase(),
          passwordHash,
          phone: dto.phone,
          role: UserRole.ORGANIZER
        }
      });
    });

    await this.issueEmailVerification(user);
    return this.issueSession(user);
  }

  async becomeOrganizer(userId: string, dto: BecomeOrganizerDto) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException("Usuario nao encontrado.");
    }
    if (user.role === UserRole.ORGANIZER || user.role === UserRole.ADMIN) {
      throw new ConflictException("Voce ja e um organizador.");
    }

    const cnpjClean = dto.cnpj.replace(/\D/g, "");
    const cnpjExists = await this.prisma.tenant.findFirst({ where: { document: cnpjClean } });
    if (cnpjExists) {
      throw new ConflictException("Ja existe uma empresa cadastrada com este CNPJ.");
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const tenant = await tx.tenant.create({
        data: {
          name: dto.companyName,
          document: cnpjClean,
          city: dto.city,
          state: dto.state.toUpperCase(),
          website: dto.website?.trim() || null,
          instagram: dto.instagram?.trim().replace(/^@/, "") || null,
          logoUrl: dto.logoUrl?.trim() || null,
        }
      });
      return tx.user.update({
        where: { id: userId },
        data: {
          tenantId: tenant.id,
          role: UserRole.ORGANIZER
        }
      });
    });

    return this.issueSession(updated);
  }

  async login(dto: LoginDto) {
    const user = await this.prisma.user.findUnique({ where: { email: dto.email.toLowerCase() } });
    if (!user || !(await bcrypt.compare(dto.password, user.passwordHash))) {
      throw new UnauthorizedException("E-mail ou senha invalidos.");
    }

    return this.issueSession(user);
  }

  async refresh(dto: Pick<RefreshTokenDto, "refreshToken">) {
    const tokenHash = this.hash(dto.refreshToken);
    const stored = await this.prisma.refreshToken.findFirst({
      where: {
        tokenHash,
        revokedAt: null,
        expiresAt: { gt: new Date() }
      },
      include: { user: true }
    });

    if (!stored) {
      throw new UnauthorizedException("Refresh token invalido.");
    }

    await this.prisma.refreshToken.update({
      where: { id: stored.id },
      data: { revokedAt: new Date() }
    });

    return this.issueSession(stored.user);
  }

  async logout(refreshToken?: string) {
    if (refreshToken) {
      await this.prisma.refreshToken.updateMany({
        where: {
          tokenHash: this.hash(refreshToken),
          revokedAt: null
        },
        data: { revokedAt: new Date() }
      });
    }

    return { message: "Sessao encerrada com sucesso." };
  }

  async forgotPassword(dto: ForgotPasswordDto) {
    const user = await this.prisma.user.findUnique({ where: { email: dto.email.toLowerCase() } });
    if (!user) {
      return { message: "Se o e-mail existir, enviaremos instrucoes de recuperacao." };
    }

    const token = randomUUID();
    await this.prisma.passwordResetToken.create({
      data: {
        userId: user.id,
        tokenHash: this.hash(token),
        expiresAt: new Date(Date.now() + 1000 * 60 * 30)
      }
    });

    await this.mail.send({
      to: user.email,
      subject: "Recuperacao de senha Event Flow",
      text: `Use este link para redefinir sua senha: ${this.resetPasswordUrl(token)}`,
      html: `<p>Recebemos uma solicitacao para redefinir sua senha.</p><p><a href="${this.resetPasswordUrl(token)}">Redefinir senha</a></p><p>Este link expira em 30 minutos.</p>`
    });

    return {
      message: "Se o e-mail existir, enviaremos instrucoes de recuperacao."
    };
  }

  async resetPassword(dto: ResetPasswordDto) {
    const reset = await this.prisma.passwordResetToken.findFirst({
      where: {
        tokenHash: this.hash(dto.token),
        usedAt: null,
        expiresAt: { gt: new Date() }
      }
    });

    if (!reset) {
      throw new UnauthorizedException("Token expirado ou invalido.");
    }

    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: reset.userId },
        data: {
          passwordHash: await bcrypt.hash(dto.password, 12),
          tokenVersion: { increment: 1 }
        }
      }),
      this.prisma.passwordResetToken.update({
        where: { id: reset.id },
        data: { usedAt: new Date() }
      }),
      this.prisma.refreshToken.updateMany({
        where: { userId: reset.userId, revokedAt: null },
        data: { revokedAt: new Date() }
      })
    ]);

    return { message: "Senha atualizada com sucesso." };
  }

  async verifyEmail(token: string) {
    const record = await this.prisma.emailVerificationToken.findFirst({
      where: {
        tokenHash: this.emailVerification.hash(token),
        usedAt: null,
        expiresAt: { gt: new Date() }
      },
      include: { user: true }
    });

    if (!record) {
      throw new UnauthorizedException("Token expirado ou invalido.");
    }

    // The address is only proven if it is still the account's address.
    if (record.email !== record.user.email.toLowerCase()) {
      throw new UnauthorizedException("Token expirado ou invalido.");
    }

    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: record.userId },
        data: { emailVerifiedAt: record.user.emailVerifiedAt ?? new Date() }
      }),
      this.prisma.emailVerificationToken.update({
        where: { id: record.id },
        data: { usedAt: new Date() }
      }),
      this.prisma.emailVerificationToken.updateMany({
        where: { userId: record.userId, usedAt: null },
        data: { usedAt: new Date() }
      })
    ]);

    return { message: "E-mail confirmado com sucesso.", email: record.email };
  }

  async resendEmailVerification(email: string) {
    // Neutral response: it must not reveal whether an account exists.
    const neutral = { message: "Se a conta existir e ainda nao estiver confirmada, enviaremos um novo link." };
    const user = await this.prisma.user.findUnique({ where: { email: email.toLowerCase() } });
    if (!user || user.emailVerifiedAt) {
      return neutral;
    }

    const lastSent = await this.prisma.emailVerificationToken.findFirst({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      select: { createdAt: true }
    });
    if (lastSent && Date.now() - lastSent.createdAt.getTime() < EMAIL_VERIFICATION_RESEND_COOLDOWN_MS) {
      return neutral;
    }

    await this.issueEmailVerification(user);
    return neutral;
  }

  private issueEmailVerification(user: { id: string; email: string; name: string }) {
    return this.emailVerification.issue(user);
  }

  async me(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, tenantId: true, name: true, email: true, emailVerifiedAt: true, phone: true, role: true, avatarUrl: true, tenant: true }
    });
    if (!user) {
      throw new NotFoundException("Usuario nao encontrado.");
    }
    return { ...user, emailVerified: Boolean(user.emailVerifiedAt) };
  }

  private async issueSession(user: User) {
    const accessToken = await this.jwt.signAsync(
      { sub: user.id, role: user.role, tenantId: user.tenantId, tokenVersion: user.tokenVersion },
      {
        secret: this.config.getOrThrow<string>("JWT_ACCESS_SECRET"),
        expiresIn: this.config.get<string>("JWT_ACCESS_EXPIRES_IN") ?? "15m"
      }
    );
    const refreshToken = randomUUID();

    await this.prisma.refreshToken.create({
      data: {
        userId: user.id,
        tokenHash: this.hash(refreshToken),
        expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 7)
      }
    });

    return {
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        tenantId: user.tenantId,
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: user.role,
        emailVerified: Boolean(user.emailVerifiedAt)
      }
    };
  }

  private hash(value: string) {
    return createHash("sha256").update(value).digest("hex");
  }

  private resetPasswordUrl(token: string) {
    const appUrl = this.config.get<string>("APP_URL") ?? "http://localhost:3000";
    const url = new URL("/reset-password", appUrl);
    url.searchParams.set("token", token);
    return url.toString();
  }
}
