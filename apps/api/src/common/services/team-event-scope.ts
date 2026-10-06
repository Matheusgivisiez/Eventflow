import { ForbiddenException } from "@nestjs/common";
import { TeamPermission } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { RequestUser } from "../types/request-user";

/** Resolve o conjunto atual de eventos de um colaborador, sempre no servidor. */
export async function teamEventIds(prisma: PrismaService, user: RequestUser, permission: TeamPermission): Promise<string[]> {
  if (!user.tenantId) throw new ForbiddenException("Organização não encontrada.");
  const member = await prisma.teamMember.findUnique({
    where: { tenantId_userId: { tenantId: user.tenantId, userId: user.id } }
  });
  if (!member?.scopeConfigured || !member.managerId || !member.permissions.includes(permission)) {
    throw new ForbiddenException("Você não tem permissão para acessar esta área.");
  }
  const events = await prisma.event.findMany({
    where: {
      tenantId: user.tenantId,
      ownerId: member.managerId,
      ...(member.allEvents ? {} : { id: { in: member.eventIds } })
    },
    select: { id: true }
  });
  return events.map((event) => event.id);
}
