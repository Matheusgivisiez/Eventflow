import { ArtistsController } from "./artists.controller";

describe("ArtistsController routes", () => {
  const user = { id: "user-1", tenantId: "tenant-1", role: "ORGANIZER", email: "organizer@example.com" } as any;
  it("forwards event links with the authenticated tenant", () => {
    const artists = { link: jest.fn(), unlink: jest.fn(), eventArtists: jest.fn(), list: jest.fn(), create: jest.fn(), update: jest.fn(), reorder: jest.fn() };
    const controller = new ArtistsController(artists as any);
    controller.link(user, "event-1", "artist-1");
    controller.unlink(user, "event-1", "artist-1");
    controller.reorder(user, "event-1", { artistIds: ["artist-1"] });
    expect(artists.link).toHaveBeenCalledWith("event-1", "artist-1", "tenant-1");
    expect(artists.unlink).toHaveBeenCalledWith("event-1", "artist-1", "tenant-1");
    expect(artists.reorder).toHaveBeenCalledWith("event-1", ["artist-1"], "tenant-1");
  });
});
