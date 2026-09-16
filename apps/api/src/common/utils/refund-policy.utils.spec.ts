import { getRefundBlockReason, getRefundDeadline } from "./refund-policy.utils";

const startsAt = new Date("2026-11-21T19:00:00.000Z");

describe("refund policy", () => {
  it("blocks when the organizer disabled refunds", () => {
    expect(getRefundBlockReason({ allowTicketRefund: false, startsAt }, new Date("2026-10-01T00:00:00Z")))
      .toMatch(/não aceita reembolso/);
  });

  it("allows until the event starts when no deadline is set", () => {
    const event = { allowTicketRefund: true, ticketRefundLockHours: null, startsAt };
    expect(getRefundDeadline(event)).toEqual(startsAt);
    expect(getRefundBlockReason(event, new Date("2026-11-21T18:59:00Z"))).toBeNull();
    expect(getRefundBlockReason(event, startsAt)).toMatch(/prazo/);
  });

  it("closes refunds N hours before the event", () => {
    const event = { allowTicketRefund: true, ticketRefundLockHours: 48, startsAt };
    expect(getRefundDeadline(event)).toEqual(new Date("2026-11-19T19:00:00.000Z"));
    expect(getRefundBlockReason(event, new Date("2026-11-19T18:59:59Z"))).toBeNull();
    expect(getRefundBlockReason(event, new Date("2026-11-19T19:00:00Z"))).toMatch(/prazo/);
  });
});
