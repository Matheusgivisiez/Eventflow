import { Injectable, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PassportStrategy } from "@nestjs/passport";
import { ExtractJwt, Strategy } from "passport-jwt";
import { PrismaService } from "../../prisma/prisma.service";
import { RequestUser } from "../../common/types/request-user";

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, "jwt") {
  constructor(
    config: ConfigService,
    private readonly prisma: PrismaService
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.getOrThrow<string>("JWT_ACCESS_SECRET")
    });
  }

  async validate(payload: { sub: string; tokenVersion?: number }): Promise<RequestUser> {
    const user = await this.prisma.user.findUnique({ where: { id: payload.sub } });
    if (!user) {
      throw new UnauthorizedException("Sessão inválida.");
    }
    if (payload.tokenVersion !== user.tokenVersion) {
      throw new UnauthorizedException("Sessão expirada. Entre novamente.");
    }
    if (user.emailVerificationRequired && !user.emailVerifiedAt) {
      throw new UnauthorizedException("Confirme seu e-mail antes de entrar.");
    }

    return {
      id: user.id,
      tenantId: user.tenantId,
      email: user.email,
      emailVerified: Boolean(user.emailVerifiedAt),
      role: user.role
    };
  }
}
