import { createHmac, timingSafeEqual } from "crypto";

/** A transfer email may expose only its recipient's ticket, never the original order. */
export function transferTicketDownloadToken(secret: string, transferId: string, ticketId: string, receiverId: string) {
  return createHmac("sha256", secret)
    .update(`eventflow:transfer-ticket-pdf:v1:${transferId}:${ticketId}:${receiverId}`)
    .digest("hex");
}

export function verifyTransferTicketDownloadToken(secret: string, transferId: string, ticketId: string, receiverId: string, token: string) {
  if (!/^[a-f0-9]{64}$/.test(token)) return false;
  const expected = Buffer.from(transferTicketDownloadToken(secret, transferId, ticketId, receiverId), "hex");
  return timingSafeEqual(expected, Buffer.from(token, "hex"));
}
