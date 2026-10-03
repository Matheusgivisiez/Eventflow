import { ArtistsController } from "./artists.controller";

describe("ArtistsController routes", () => {
  const user = { id: "user-1", tenantId: "tenant-1", role: "ORGANIZER", email: "organizer@example.com" } as any;
  it("checks event access before forwarding event links with the authenticated tenant", async () => {
    const artists = { link: jest.fn(), unlink: jest.fn(), eventArtists: jest.fn(), list: jest.fn(), create: jest.fn(), update: jest.fn(), reorder: jest.fn() };
    const eventAccess = { assertAccess: jest.fn().mockResolvedValue(undefined) };
    const controller = new ArtistsController(artists as any, eventAccess as any);
    await controller.link(user, "event-1", "artist-1");
    await controller.unlink(user, "event-1", "artist-1");
    await controller.reorder(user, "event-1", { artistIds: ["artist-1"] });
    expect(eventAccess.assertAccess).toHaveBeenNthCalledWith(1, "event-1", "user-1", ["GESTOR", "EDITOR"]);
    expect(artists.link).toHaveBeenCalledWith("event-1", "artist-1", "tenant-1");
    expect(artists.unlink).toHaveBeenCalledWith("event-1", "artist-1", "tenant-1");
    expect(artists.reorder).toHaveBeenCalledWith("event-1", ["artist-1"], "tenant-1");
  });
});
