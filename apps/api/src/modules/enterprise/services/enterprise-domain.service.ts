import { BadRequestException, NotFoundException, UnauthorizedException } from "@nestjs/common";
import { createHash } from "crypto";
import { PrismaService } from "../../../prisma/prisma.service";
import { RequestUser } from "../../../common/types/request-user";

export type AnyRecord = Record<string, unknown>;
type DynamicPrismaClient = Record<string, any>;

export abstract class EnterpriseDomainService {
  protected constructor(protected readonly prisma: PrismaService) {}

  protected async ensureEvent(tenantId: string, eventId: string) {
    const event = await this.prisma.event.findFirst({ where: { id: eventId, tenantId } });
    if (!event) throw new NotFoundException("Evento nao encontrado.");
    return event;
  }

  protected db(): DynamicPrismaClient {
    return this.prisma as unknown as DynamicPrismaClient;
  }

  protected requireTenant(user: RequestUser) {
    if (!user.tenantId) throw new UnauthorizedException("Conta sem tenant organizador.");
    return user.tenantId;
  }

  protected requiredString(value: unknown, field: string) {
    const result = this.string(value);
    if (!result) throw new BadRequestException(`Campo obrigatorio: ${field}.`);
    return result;
  }

  protected string(value: unknown) {
    return typeof value === "string" && value.trim() ? value.trim() : undefined;
  }

  protected stringArray(value: unknown) {
    if (!Array.isArray(value) || !value.length) throw new BadRequestException("Envie uma lista de assentos.");
    return value.map(String);
  }

  protected slug(value: string) {
    return value
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "");
  }

  protected hash(value: string) {
    return createHash("sha256").update(value).digest("hex");
  }
}
