import { ExecutionContext, ForbiddenException } from "@nestjs/common";
import { EventAccessRole, TeamPermission, UserRole } from "@prisma/client";
import { TeamPermissionGuard } from "./team-permission.guard";

function setup(options: {
  required: TeamPermission[];
  user?: { id: string; role: UserRole; tenantId?: string | null };
  eventId?: string;
  member?: { permissions: TeamPermission[] } | null;
  eventRole?: EventAccessRole | null;
}) {
  const reflector = { getAllAndOverride: jest.fn().mockReturnValue(options.required) };
  const prisma = {
    teamMember: { findUnique: jest.fn().mockResolvedValue(options.member ?? null) },
    eventAccess: { findFirst: jest.fn().mockResolvedValue(options.eventRole ? { role: options.eventRole } : null) }
  };
  const request = { user: options.user, params: options.eventId ? { eventId: options.eventId } : {} };
  const context = {
    getHandler: () => undefined,
    getClass: () => undefined,
    switchToHttp: () => ({ getRequest: () => request })
  } as unknown as ExecutionContext;
  return { guard: new TeamPermissionGuard(reflector as any, prisma as any), context, prisma };
}

const team = { id: "user-1", role: UserRole.TEAM, tenantId: "tenant-1" };

describe("TeamPermissionGuard", () => {
  it("libera organizador sem consultar a equipe", async () => {
    const { guard, context, prisma } = setup({ required: [TeamPermission.FINANCE], user: { ...team, role: UserRole.ORGANIZER } });
    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(prisma.teamMember.findUnique).not.toHaveBeenCalled();
  });

  it("libera check-in para Operação atribuída ao evento", async () => {
    const { guard, context, prisma } = setup({
      required: [TeamPermission.CHECK_IN], user: team, eventId: "event-1",
      member: { permissions: [] }, eventRole: EventAccessRole.OPERACAO
    });
    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(prisma.eventAccess.findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: { eventId: "event-1", userId: "user-1", event: { tenantId: "tenant-1" } }
    }));
  });

  it("nega check-in a quem tem a permissão geral mas não foi atribuído ao evento", async () => {
    const { guard, context } = setup({
      required: [TeamPermission.CHECK_IN], user: team, eventId: "event-1",
      member: { permissions: [TeamPermission.CHECK_IN] }, eventRole: null
    });
    await expect(guard.canActivate(context)).rejects.toThrow(ForbiddenException);
  });

  it("nega check-in a Editor do evento", async () => {
    const { guard, context } = setup({
      required: [TeamPermission.CHECK_IN], user: team, eventId: "event-1",
      member: { permissions: [] }, eventRole: EventAccessRole.EDITOR
    });
    await expect(guard.canActivate(context)).rejects.toThrow(ForbiddenException);
  });

  it("nega check-in a quem saiu da equipe, mesmo com atribuição antiga no evento", async () => {
    const { guard, context, prisma } = setup({
      required: [TeamPermission.CHECK_IN], user: team, eventId: "event-1",
      member: null, eventRole: EventAccessRole.OPERACAO
    });
    await expect(guard.canActivate(context)).resolves.toBe(false);
    expect(prisma.eventAccess.findFirst).not.toHaveBeenCalled();
  });

  it("atribuição ao evento NÃO concede outras permissões em rotas com :eventId", async () => {
    for (const eventRole of [EventAccessRole.GESTOR, EventAccessRole.OPERACAO]) {
      const { guard, context } = setup({
        required: [TeamPermission.MANAGE_SEAT_MAPS], user: team, eventId: "event-1",
        member: { permissions: [TeamPermission.CHECK_IN] }, eventRole
      });
      await expect(guard.canActivate(context)).rejects.toThrow(ForbiddenException);
    }
  });

  it("libera permissão de equipe que o membro possui", async () => {
    const { guard, context } = setup({
      required: [TeamPermission.MANAGE_SEAT_MAPS], user: team, eventId: "event-1",
      member: { permissions: [TeamPermission.MANAGE_SEAT_MAPS] }
    });
    await expect(guard.canActivate(context)).resolves.toBe(true);
  });

  it("nega cliente comum", async () => {
    const { guard, context } = setup({
      required: [TeamPermission.CHECK_IN], user: { id: "c", role: UserRole.CUSTOMER, tenantId: null }, eventId: "event-1"
    });
    await expect(guard.canActivate(context)).resolves.toBe(false);
  });
});
