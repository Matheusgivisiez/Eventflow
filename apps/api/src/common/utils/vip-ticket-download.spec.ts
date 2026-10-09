import { vipTicketDownloadToken, verifyVipTicketDownloadToken } from "./vip-ticket-download";

describe("VIP ticket download token", () => {
  it("is valid only for the named ticket owner", () => {
    const token = vipTicketDownloadToken("secret", "ticket-1", "owner-1");
    expect(verifyVipTicketDownloadToken("secret", "ticket-1", "owner-1", token)).toBe(true);
    expect(verifyVipTicketDownloadToken("secret", "ticket-1", "owner-2", token)).toBe(false);
    expect(verifyVipTicketDownloadToken("secret", "ticket-2", "owner-1", token)).toBe(false);
    expect(verifyVipTicketDownloadToken("secret", "ticket-1", "owner-1", "invalid")).toBe(false);
  });
});
