import { createHmac, timingSafeEqual } from "crypto";

/** A VIP invitation link is bound to the ticket's current named owner. */
export function vipTicketDownloadToken(secret: string, ticketId: string, ownerId: string) {
  return createHmac("sha256", secret)
    .update(`eventflow:vip-ticket-pdf:v1:${ticketId}:${ownerId}`)
    .digest("hex");
}

export function verifyVipTicketDownloadToken(secret: string, ticketId: string, ownerId: string, token: string) {
  if (!/^[a-f0-9]{64}$/.test(token)) return false;
  const expected = Buffer.from(vipTicketDownloadToken(secret, ticketId, ownerId), "hex");
  return timingSafeEqual(expected, Buffer.from(token, "hex"));
}
