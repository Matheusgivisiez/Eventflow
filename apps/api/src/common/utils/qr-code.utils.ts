/**
 * Shared QR Code lock utilities.
 * Used by BuyerService and CheckoutService to determine
 * whether a ticket's QR code should be hidden.
 */

type QrCodeEventInfo = {
  qrCodeReleaseAt?: Date | string | null;
  qrCodeReleaseMinutesBeforeStart?: number | null;
  startsAt: Date | string;
};

/**
 * Calculates the absolute date/time when QR codes become visible.
 * Priority: explicit `qrCodeReleaseAt` > relative `qrCodeReleaseMinutesBeforeStart` before event start.
 * Returns `null` if no lock is configured.
 */
export function getQrCodeReleaseTime(event: QrCodeEventInfo): Date | null {
  if (event.qrCodeReleaseAt) {
    return new Date(event.qrCodeReleaseAt);
  }
  if (
    event.qrCodeReleaseMinutesBeforeStart !== null &&
    event.qrCodeReleaseMinutesBeforeStart !== undefined
  ) {
    const startsAt = new Date(event.startsAt).getTime();
    return new Date(startsAt - event.qrCodeReleaseMinutesBeforeStart * 60 * 1000);
  }
  return null;
}

/**
 * Returns `true` if the current time is before the QR code release time,
 * meaning the QR code should remain hidden / locked.
 */
export function isQrCodeLocked(event: QrCodeEventInfo): boolean {
  const releaseTime = getQrCodeReleaseTime(event);
  if (!releaseTime) return false;
  return new Date() < releaseTime;
}
