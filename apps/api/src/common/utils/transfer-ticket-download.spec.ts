import { transferTicketDownloadToken, verifyTransferTicketDownloadToken } from "./transfer-ticket-download";

describe("transfer ticket PDF tokens", () => {
  it("binds a download to one transfer, ticket and receiver", () => {
    const token = transferTicketDownloadToken("secret", "transfer-1", "ticket-1", "receiver-1");
    expect(verifyTransferTicketDownloadToken("secret", "transfer-1", "ticket-1", "receiver-1", token)).toBe(true);
    expect(verifyTransferTicketDownloadToken("secret", "transfer-2", "ticket-1", "receiver-1", token)).toBe(false);
    expect(verifyTransferTicketDownloadToken("secret", "transfer-1", "ticket-2", "receiver-1", token)).toBe(false);
    expect(verifyTransferTicketDownloadToken("secret", "transfer-1", "ticket-1", "receiver-2", token)).toBe(false);
    expect(verifyTransferTicketDownloadToken("secret", "transfer-1", "ticket-1", "receiver-1", "bad-token")).toBe(false);
  });
});
