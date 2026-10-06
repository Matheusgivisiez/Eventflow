import { ForbiddenException } from "@nestjs/common";
import { TeamPermission, UserRole } from "@prisma/client";
import { teamEventIds } from "./team-event-scope";

const user = { id: "member", tenantId: "tenant", role: UserRole.TEAM, email: "member@example.com" };

describe("teamEventIds", () => {
  const prisma = {
    teamMember: { findUnique: jest.fn() },
    event: { findMany: jest.fn() }
  };

  beforeEach(() => jest.clearAllMocks());

  it("limita vendas aos eventos escolhidos do organizador responsável", async () => {
    prisma.teamMember.findUnique.mockResolvedValue({
      managerId: "owner", scopeConfigured: true, allEvents: false,
      eventIds: ["event-1"], permissions: [TeamPermission.VIEW_SALES]
    });
    prisma.event.findMany.mockResolvedValue([{ id: "event-1" }]);
    await expect(teamEventIds(prisma as any, user as any, TeamPermission.VIEW_SALES)).resolves.toEqual(["event-1"]);
    expect(prisma.event.findMany).toHaveBeenCalledWith({
      where: { tenantId: "tenant", ownerId: "owner", id: { in: ["event-1"] } }, select: { id: true }
    });
  });

  it("não deixa financeiro usar a permissão de vendas", async () => {
    prisma.teamMember.findUnique.mockResolvedValue({
      managerId: "owner", scopeConfigured: true, allEvents: true,
      eventIds: [], permissions: [TeamPermission.VIEW_SALES]
    });
    await expect(teamEventIds(prisma as any, user as any, TeamPermission.FINANCE)).rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.event.findMany).not.toHaveBeenCalled();
  });

  it("inclui eventos futuros do mesmo organizador quando todos estão marcados", async () => {
    prisma.teamMember.findUnique.mockResolvedValue({
      managerId: "owner", scopeConfigured: true, allEvents: true,
      eventIds: [], permissions: [TeamPermission.FINANCE]
    });
    prisma.event.findMany.mockResolvedValue([{ id: "future-event" }]);
    await expect(teamEventIds(prisma as any, user as any, TeamPermission.FINANCE)).resolves.toEqual(["future-event"]);
    expect(prisma.event.findMany).toHaveBeenCalledWith({
      where: { tenantId: "tenant", ownerId: "owner" }, select: { id: true }
    });
  });

  it("nega permissões antigas sem atribuição de eventos", async () => {
    prisma.teamMember.findUnique.mockResolvedValue({
      managerId: "owner", scopeConfigured: false, allEvents: false,
      eventIds: [], permissions: [TeamPermission.FINANCE]
    });
    await expect(teamEventIds(prisma as any, user as any, TeamPermission.FINANCE)).rejects.toBeInstanceOf(ForbiddenException);
  });
});
