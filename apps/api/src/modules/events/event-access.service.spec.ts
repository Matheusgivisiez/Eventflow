import { ForbiddenException } from "@nestjs/common";
import { EventAccessRole, TeamPermission, UserRole } from "@prisma/client";
import { EventAccessService } from "./event-access.service";

function setup(permissions: TeamPermission[], allEvents: boolean, eventIds: string[]) {
  const prisma = {
    event: { findUnique: jest.fn().mockResolvedValue({ id: "e2", ownerId: "owner", tenantId: "tenant" }) },
    teamMember: { findUnique: jest.fn().mockResolvedValue({
      user: { role: UserRole.TEAM }, managerId: "owner", scopeConfigured: true, permissions, allEvents, eventIds
    }) },
    eventAccess: { findUnique: jest.fn() }
  };
  return { service: new EventAccessService(prisma as never), prisma };
}

describe("EventAccessService: acesso configurado na equipe", () => {
  it("libera edição e check-in no evento atribuído", async () => {
    const { service } = setup([TeamPermission.EDIT_EVENT, TeamPermission.CHECK_IN], false, ["e2"]);
    await expect(service.roleFor("e2", "member")).resolves.toBe(EventAccessRole.GESTOR);
    await expect(service.assertAccess("e2", "member", [EventAccessRole.GESTOR, EventAccessRole.EDITOR])).resolves.toBeUndefined();
  });

  it("nega outro evento mesmo com as mesmas funções", async () => {
    const { service } = setup([TeamPermission.EDIT_EVENT, TeamPermission.CHECK_IN], false, ["e1"]);
    await expect(service.assertAccess("e2", "member", [EventAccessRole.GESTOR])).rejects.toBeInstanceOf(ForbiddenException);
  });

  it("inclui eventos futuros quando todos estão selecionados", async () => {
    const { service } = setup([TeamPermission.CHECK_IN], true, []);
    await expect(service.roleFor("e2", "member")).resolves.toBe(EventAccessRole.OPERACAO);
  });

  it("não estende todos os eventos a outro organizador da mesma organização", async () => {
    const { service, prisma } = setup([TeamPermission.CHECK_IN], true, []);
    prisma.event.findUnique.mockResolvedValue({ id: "e2", ownerId: "other-owner", tenantId: "tenant" });
    await expect(service.roleFor("e2", "member")).rejects.toBeInstanceOf(ForbiddenException);
  });

  it("não transforma só check-in em permissão de edição", async () => {
    const { service } = setup([TeamPermission.CHECK_IN], true, []);
    await expect(service.assertAccess("e2", "member", [EventAccessRole.GESTOR, EventAccessRole.EDITOR])).rejects.toBeInstanceOf(ForbiddenException);
  });
});
