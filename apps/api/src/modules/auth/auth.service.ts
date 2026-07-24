import { ConflictException, Injectable, NotFoundException, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import { User, UserRole } from "@prisma/client";
import * as bcrypt from "bcryptjs";
import { createHash, randomUUID } from "crypto";
import { PrismaService } from "../../prisma/prisma.service";
import { ForgotPasswordDto } from "./dto/forgot-password.dto";
import { LoginDto } from "./dto/login.dto";
import { RefreshTokenDto } from "./dto/refresh-token.dto";
import { RegisterDto } from "./dto/register.dto";
import { ResetPasswordDto } from "./dto/reset-password.dto";

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService
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

    return this.issueSession(user);
  }

  async becomeOrganizer(userId: string, companyName: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException("Usuario nao encontrado.");
    }
    if (user.role === UserRole.ORGANIZER || user.role === UserRole.ADMIN) {
      throw new ConflictException("Voce ja e um organizador.");
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const tenant = await tx.tenant.create({ data: { name: companyName } });
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

  async refresh(dto: RefreshTokenDto) {
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

    // TODO: Enviar token por email/SMS em vez de retornar na resposta
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
        data: { passwordHash: await bcrypt.hash(dto.password, 12) }
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

  async me(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, tenantId: true, name: true, email: true, phone: true, role: true, avatarUrl: true, tenant: true }
    });
    if (!user) {
      throw new NotFoundException("Usuario nao encontrado.");
    }
    return user;
  }

  private async issueSession(user: User) {
    const accessToken = await this.jwt.signAsync(
      { sub: user.id, role: user.role, tenantId: user.tenantId },
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
        role: user.role
      }
    };
  }

  private hash(value: string) {
    return createHash("sha256").update(value).digest("hex");
  }
}
