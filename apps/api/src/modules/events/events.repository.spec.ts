import { EventStatus } from "@prisma/client";
import { EventsRepository } from "./events.repository";

function createRepository() {
  const prisma = {
    event: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn()
    },
    $transaction: jest.fn()
  };
  const repository = new EventsRepository(prisma as any);
  return { repository, prisma };
}

describe("EventsRepository public visibility", () => {
  const now = new Date("2026-09-14T14:00:00.000Z");

  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(now);
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.clearAllMocks();
  });

  it("lists only published events that have not reached their end/start cutoff", async () => {
    const { repository, prisma } = createRepository();
    prisma.event.findMany.mockReturnValue(Promise.resolve([]));
    prisma.event.count.mockReturnValue(Promise.resolve(0));
    prisma.$transaction.mockResolvedValue([[], 0]);

    await repository.findPublicEvents({ page: 1, perPage: 12 });

    expect(prisma.event.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        status: EventStatus.PUBLISHED,
        AND: [
          {
            OR: [
              { endsAt: { gte: now } },
              { endsAt: null, startsAt: { gte: now } }
            ]
          }
        ]
      })
    }));
    expect(prisma.event.count).toHaveBeenCalledWith({
      where: expect.objectContaining({
        status: EventStatus.PUBLISHED,
        AND: [
          {
            OR: [
              { endsAt: { gte: now } },
              { endsAt: null, startsAt: { gte: now } }
            ]
          }
        ]
      })
    });
  });

  it("does not return an expired public event by slug", async () => {
    const { repository, prisma } = createRepository();
    prisma.event.findFirst.mockResolvedValue(null);

    await repository.findPublicBySlug("festival-antigo");

    expect(prisma.event.findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: {
        slug: "festival-antigo",
        status: EventStatus.PUBLISHED,
        AND: [
          {
            OR: [
              { endsAt: { gte: now } },
              { endsAt: null, startsAt: { gte: now } }
            ]
          }
        ]
      }
    }));
  });

  it("includes tenant name and logoUrl in findPublicBySlug", async () => {
    const { repository, prisma } = createRepository();
    prisma.event.findFirst.mockResolvedValue(null);

    await repository.findPublicBySlug("festival-com-logo");

    expect(prisma.event.findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ slug: "festival-com-logo" }),
      include: expect.objectContaining({
        tenant: { select: { name: true, logoUrl: true } }
      })
    }));
  });
});
