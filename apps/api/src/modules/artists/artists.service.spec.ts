import { BadRequestException, ForbiddenException, NotFoundException } from "@nestjs/common";
import { ArtistsService } from "./artists.service";

function createService() {
  const prisma = { artist: { findMany: jest.fn(), create: jest.fn(), findUnique: jest.fn(), update: jest.fn() }, event: { findFirst: jest.fn() }, eventArtist: { aggregate: jest.fn(), create: jest.fn(), deleteMany: jest.fn(), findMany: jest.fn(), update: jest.fn() }, $transaction: jest.fn() };
  const cache = { delByPattern: jest.fn() };
  return { service: new ArtistsService(prisma as any, cache as any), prisma, cache };
}

describe("ArtistsService", () => {
  it("creates a global artist with a trimmed stage name", async () => {
    const { service, prisma } = createService();
    prisma.artist.create.mockResolvedValue({ id: "artist-1", stageName: "Pavor" });
    await expect(service.create("user-1", { stageName: "  Pavor  " })).resolves.toMatchObject({ stageName: "Pavor" });
    expect(prisma.artist.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ stageName: "Pavor", createdById: "user-1" }) }));
  });

  it("does not link artists to another tenant's event", async () => {
    const { service, prisma } = createService();
    prisma.event.findFirst.mockResolvedValue(null);
    await expect(service.link("event-1", "artist-1", "tenant-2")).rejects.toThrow(NotFoundException);
    expect(prisma.eventArtist.create).not.toHaveBeenCalled();
  });

  it("rejects a duplicate artist-event link", async () => {
    const { service, prisma } = createService();
    prisma.event.findFirst.mockResolvedValue({ id: "event-1" });
    prisma.artist.findUnique.mockResolvedValue({ id: "artist-1" });
    prisma.eventArtist.aggregate.mockResolvedValue({ _max: { position: 0 } });
    prisma.eventArtist.create.mockRejectedValue({ code: "P2002" });
    await expect(service.link("event-1", "artist-1", "tenant-1")).rejects.toThrow(BadRequestException);
  });

  it("rejects updates from a user other than the artist creator", async () => {
    const { service, prisma } = createService();
    prisma.artist.findUnique.mockResolvedValue({ id: "artist-1", createdById: "owner-1" });
    await expect(service.update("artist-1", "other-user", { stageName: "Outro" })).rejects.toThrow(ForbiddenException);
  });

  it("requires reorder requests to contain every linked artist exactly once", async () => {
    const { service, prisma } = createService();
    prisma.event.findFirst.mockResolvedValue({ id: "event-1" });
    prisma.eventArtist.findMany.mockResolvedValue([{ artistId: "a" }, { artistId: "b" }]);
    await expect(service.reorder("event-1", ["a", "a"], "tenant-1")).rejects.toThrow(BadRequestException);
    await expect(service.reorder("event-1", ["a"], "tenant-1")).rejects.toThrow(BadRequestException);
  });
});
