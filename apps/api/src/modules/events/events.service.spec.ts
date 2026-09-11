import { BadRequestException } from "@nestjs/common";
import { EventFormat, EventStatus, Prisma } from "@prisma/client";
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
    event: {
      findUnique: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      create: jest.fn()
    },
    $transaction: jest.fn((callback) => callback(tx))
  };
  const repository = {
    findByIdForTenant: jest.fn()
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
});
