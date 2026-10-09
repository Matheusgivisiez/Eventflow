import { BadRequestException } from "@nestjs/common";
import { EventFormat, EventStatus, Prisma, TeamPermission, UserRole } from "@prisma/client";
import { EventsService } from "./events.service";

jest.mock("nanoid", () => ({ nanoid: jest.fn(() => "fixed-id") }));

const future = () => new Date(Date.now() + 1000 * 60 * 60).toISOString();

function createDto(overrides: Record<string, unknown> = {}) {
  return {
    title: "Festa Teste",
    description: "Evento de teste",
    category: "show",
    startsAt: future(),
    format: EventFormat.ONLINE,
    onlineUrl: "https://stream.example.com",
    status: EventStatus.DRAFT,
    ...overrides
  } as any;
}

function createService() {
  const tx = {
    event: {
      create: jest.fn()
    },
    ticketType: {
      create: jest.fn()
    }
  };
  const prisma = {
    teamMember: { findUnique: jest.fn() },
    event: {
      findUnique: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      create: jest.fn()
    },
    $transaction: jest.fn((callback) => callback(tx))
  };
  const repository = {
    findByIdForTenant: jest.fn(),
    list: jest.fn()
  };
  const cache = {
    del: jest.fn(),
    delByPattern: jest.fn(),
    get: jest.fn(),
    set: jest.fn()
  };
  const service = new EventsService(prisma as any, repository as any, cache as any);
  return { service, prisma, repository, cache, tx };
}

describe("EventsService", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("retries event creation when a concurrent request takes the generated slug", async () => {
    const { service, prisma, tx } = createService();
    const slugError = new Prisma.PrismaClientKnownRequestError("Unique constraint failed", {
      code: "P2002",
      clientVersion: "test",
      meta: { target: ["slug"] }
    });
    prisma.event.findUnique.mockResolvedValue(null);
    tx.event.create
      .mockRejectedValueOnce(slugError)
      .mockResolvedValueOnce({ id: "event-1", slug: expect.any(String) });

    const result = await service.create("tenant-1", "owner-1", createDto());

    expect(result).toEqual({ id: "event-1", slug: expect.any(String) });
    expect(prisma.$transaction).toHaveBeenCalledTimes(2);
    expect(tx.event.create).toHaveBeenCalledTimes(2);
  });

  it("saves the per-screen hero art on creation", async () => {
    const { service, prisma, tx } = createService();
    prisma.event.findUnique.mockResolvedValue(null);
    tx.event.create.mockResolvedValue({ id: "event-1" });

    await service.create("tenant-1", "owner-1", createDto({
      bannerUrl: "https://cdn.example.com/banner.webp",
      heroMobileUrl: "https://cdn.example.com/hero-mobile.webp"
    }));

    expect(tx.event.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        bannerUrl: "https://cdn.example.com/banner.webp",
        heroMobileUrl: "https://cdn.example.com/hero-mobile.webp"
      })
    }));
  });

  it("clears the mobile hero art with null and leaves the banner untouched", async () => {
    const { service, prisma, repository } = createService();
    repository.findByIdForTenant.mockResolvedValue({
      id: "event-1",
      format: EventFormat.ONLINE,
      city: null,
      state: null,
      zipCode: null,
      address: null,
      onlineUrl: "https://stream.example.com",
      startsAt: new Date(Date.now() + 1000 * 60 * 60),
      endsAt: null
    });
    prisma.event.update.mockResolvedValue({ id: "event-1", slug: "festa" });

    await service.update("event-1", "tenant-1", { heroMobileUrl: null } as any);

    const { data } = prisma.event.update.mock.calls[0][0];
    expect(data.heroMobileUrl).toBeNull();
    expect(data.bannerUrl).toBeUndefined();
  });

  it("uses EventStatus.CLOSED when canceling an event", async () => {
    const { service, prisma, repository } = createService();
    repository.findByIdForTenant.mockResolvedValue({ id: "event-1" });
    prisma.event.update.mockResolvedValue({ id: "event-1", status: EventStatus.CLOSED });

    const result = await service.cancel("event-1", "tenant-1");

    expect(result.status).toBe(EventStatus.CLOSED);
    expect(prisma.event.update).toHaveBeenCalledWith({
      where: { id: "event-1" },
      data: { status: EventStatus.CLOSED }
    });
  });

  it("rejects moving an event start date into the past", async () => {
    const { service, repository } = createService();
    repository.findByIdForTenant.mockResolvedValue({
      format: EventFormat.ONLINE,
      city: null,
      state: null,
      zipCode: null,
      address: null,
      onlineUrl: "https://stream.example.com",
      startsAt: new Date(Date.now() + 1000 * 60 * 60),
      endsAt: null
    });

    await expect(
      service.update("event-1", "tenant-1", { startsAt: new Date(Date.now() - 1000).toISOString() } as any)
    ).rejects.toThrow(BadRequestException);
  });

  it("lists only selected events for a team member", async () => {
    const { service, prisma, repository } = createService();
    prisma.teamMember.findUnique.mockResolvedValue({ scopeConfigured: true, allEvents: false, eventIds: ["event-1"], permissions: [TeamPermission.EDIT_EVENT] });
    await service.list("tenant-1", {}, { userId: "member-1", role: UserRole.TEAM });
    expect(repository.list).toHaveBeenCalledWith("tenant-1", expect.objectContaining({ scopedIds: ["event-1"] }));
  });

  it("keeps edit-only events out of the check-in selector", async () => {
    const { service, prisma, repository } = createService();
    prisma.teamMember.findUnique.mockResolvedValue({ scopeConfigured: true, allEvents: true, eventIds: [], permissions: [TeamPermission.EDIT_EVENT] });
    await service.list("tenant-1", { purpose: "CHECK_IN" }, { userId: "member-1", role: UserRole.TEAM });
    expect(repository.list).toHaveBeenCalledWith("tenant-1", expect.objectContaining({ scopedIds: [] }));
  });

  it("limits all-events scope to the manager's events", async () => {
    const { service, prisma, repository } = createService();
    prisma.teamMember.findUnique.mockResolvedValue({ managerId: "owner-1", scopeConfigured: true, allEvents: true, eventIds: [], permissions: [TeamPermission.CHECK_IN] });
    await service.list("tenant-1", {}, { userId: "member-1", role: UserRole.TEAM });
    expect(repository.list).toHaveBeenCalledWith("tenant-1", expect.objectContaining({ scopedIds: null, scopedOwnerId: "owner-1" }));
  });
});
