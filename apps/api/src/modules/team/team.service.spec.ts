import { BadRequestException } from "@nestjs/common";
import { TeamPermission, UserRole } from "@prisma/client";
import { TeamService } from "./team.service";

function setup() {
  const prisma = {
    event: { count: jest.fn().mockResolvedValue(1) },
    user: { findUnique: jest.fn().mockResolvedValue({ id: "member", tenantId: null, role: UserRole.CUSTOMER }), update: jest.fn().mockResolvedValue({ id: "member", tenantId: "tenant", role: UserRole.TEAM }) },
    teamMember: { findUnique: jest.fn().mockResolvedValue(null), create: jest.fn().mockResolvedValue({ id: "team-1" }), findFirst: jest.fn().mockResolvedValue({ id: "team-1" }), update: jest.fn().mockResolvedValue({ id: "team-1" }) }
  };
  return { service: new TeamService(prisma as never), prisma };
}

describe("TeamService event scope", () => {
  it("saves chosen events with the team permissions", async () => {
    const { service, prisma } = setup();
    await service.addMember("tenant", "owner", { email: "member@example.com", permissions: [TeamPermission.CHECK_IN], allEvents: false, eventIds: ["event-1"] });
    expect(prisma.event.count).toHaveBeenCalledWith({ where: { id: { in: ["event-1"] }, tenantId: "tenant", ownerId: "owner" } });
    expect(prisma.teamMember.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({
      permissions: [TeamPermission.CHECK_IN], managerId: "owner", allEvents: false, eventIds: ["event-1"], scopeConfigured: true
    }) }));
  });

  it("rejects events outside the organization", async () => {
    const { service, prisma } = setup();
    prisma.event.count.mockResolvedValue(0);
    await expect(service.addMember("tenant", "owner", { email: "member@example.com", permissions: [TeamPermission.CHECK_IN], allEvents: false, eventIds: ["other-tenant-event"] })).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it("allows all current and future events without storing IDs", async () => {
    const { service, prisma } = setup();
    await service.updatePermissions("team-1", "tenant", "owner", { permissions: [TeamPermission.EDIT_EVENT], allEvents: true, eventIds: ["ignored"] });
    expect(prisma.teamMember.update).toHaveBeenCalledWith(expect.objectContaining({ data: {
      permissions: [TeamPermission.EDIT_EVENT], managerId: "owner", allEvents: true, eventIds: [], scopeConfigured: true
    } }));
  });
});
