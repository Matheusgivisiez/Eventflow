import { Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";

@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  log(input: { userId?: string; action: string; entity: string; entityId?: string; metadata?: Prisma.InputJsonValue }) {
    return this.prisma.auditLog.create({ data: input });
  }

  list(query: { userId?: string; entity?: string; page?: string; perPage?: string }) {
    const page = Number(query.page ?? 1);
    const perPage = Number(query.perPage ?? 50);
    return this.prisma.auditLog.findMany({
      where: { userId: query.userId, entity: query.entity },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * perPage,
      take: perPage
    });
  }
}
