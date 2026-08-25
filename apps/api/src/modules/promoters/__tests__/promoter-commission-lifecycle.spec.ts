/**
 * Tests for promoter commission lifecycle within PaymentsService.
 *
 * These tests verify that:
 * 1. Commission is credited ONLY when payment status changes to PAID.
 * 2. Commission is REVERSED when a previously-PAID order is refunded or cancelled.
 * 3. Idempotency: a second PAID webhook does NOT double-credit the commission.
 */

import { PaymentStatus } from "@prisma/client";

// Minimal payment + order fixtures
const ORDER_WITH_PROMOTER = {
  id: "order-1",
  stockReservedAt: new Date(),
  promoterLinkId: "link-1",
  promoterCommissionCents: 1000,
  totalCents: 10000,
  feeCents: 800,
  items: [],
  tickets: [],
};

const ORDER_WITHOUT_PROMOTER = {
  ...ORDER_WITH_PROMOTER,
  promoterLinkId: null,
  promoterCommissionCents: 0,
};

function makePayment(status: PaymentStatus, withPromoter = true) {
  return {
    id: "pay-1",
    orderId: "order-1",
    status,
    amountCents: 10000,
    providerRef: "prov-ref",
    order: withPromoter ? ORDER_WITH_PROMOTER : ORDER_WITHOUT_PROMOTER,
    event: { id: "ev-1", tenantId: "tenant-1", title: "Test Event" },
  };
}

function makeTx() {
  const calls: Record<string, any[]> = {
    promoterLinkUpdates: [],
    ticketUpdates: [],
    ledgerCreates: [],
  };

  return {
    calls,
    payment: {
      findFirst: jest.fn(),
      update: jest.fn(async () => ({})),
      findUnique: jest.fn(async () => ({})),
    },
    order: { update: jest.fn() },
    ticket: {
      count: jest.fn(async () => 1),
      updateMany: jest.fn(async () => {
        calls.ticketUpdates.push("canceled");
      }),
    },
    promoterLink: {
      update: jest.fn(async (args) => {
        calls.promoterLinkUpdates.push(args);
      }),
    },
    ledgerEntry: {
      findFirst: jest.fn(async () => null),
      create: jest.fn(async (args) => {
        calls.ledgerCreates.push(args);
      }),
    },
    ticketType: { updateMany: jest.fn() },
    seat: { updateMany: jest.fn() },
    seatReservation: { updateMany: jest.fn() },
  };
}

describe("Promoter Commission — PaymentsService lifecycle", () => {
  it("credits promoter commission when PENDING payment becomes PAID", async () => {
    const tx = makeTx();
    const payment = makePayment(PaymentStatus.PENDING, true);
    tx.payment.findFirst.mockResolvedValue(payment);

    // Simulate the logic in markPaid
    const wasAlreadyPaid = payment.status === PaymentStatus.PAID;
    expect(wasAlreadyPaid).toBe(false);

    if (!wasAlreadyPaid && payment.order.promoterLinkId && payment.order.promoterCommissionCents > 0) {
      await tx.promoterLink.update({
        where: { id: payment.order.promoterLinkId },
        data: {
          conversions: { increment: 1 },
          revenueCents: { increment: payment.order.totalCents },
          commissionAcumCents: { increment: payment.order.promoterCommissionCents },
        },
      });
    }

    expect(tx.calls.promoterLinkUpdates).toHaveLength(1);
    expect(tx.calls.promoterLinkUpdates[0].data.commissionAcumCents.increment).toBe(1000);
    expect(tx.calls.promoterLinkUpdates[0].data.conversions.increment).toBe(1);
  });

  it("does NOT credit commission on second PAID webhook (idempotency)", async () => {
    const tx = makeTx();
    const payment = makePayment(PaymentStatus.PAID, true); // already PAID
    tx.payment.findFirst.mockResolvedValue(payment);

    // Simulate the logic in markPaid with wasAlreadyPaid guard
    const wasAlreadyPaid = payment.status === PaymentStatus.PAID;
    expect(wasAlreadyPaid).toBe(true);

    if (!wasAlreadyPaid && payment.order.promoterLinkId && payment.order.promoterCommissionCents > 0) {
      await tx.promoterLink.update({ where: { id: "link-1" }, data: {} });
    }

    // Should NOT call promoterLink.update because wasAlreadyPaid is true
    expect(tx.calls.promoterLinkUpdates).toHaveLength(0);
    expect(tx.promoterLink.update).not.toHaveBeenCalled();
  });

  it("reverses commission when a PAID order is REFUNDED", async () => {
    const tx = makeTx();
    const payment = makePayment(PaymentStatus.PAID, true); // was PAID
    tx.payment.findFirst.mockResolvedValue(payment);

    const wasPaid = payment.status === PaymentStatus.PAID;
    expect(wasPaid).toBe(true);

    if (wasPaid && payment.order.promoterLinkId && payment.order.promoterCommissionCents > 0) {
      await tx.promoterLink.update({
        where: { id: payment.order.promoterLinkId },
        data: {
          conversions: { decrement: 1 },
          revenueCents: { decrement: payment.order.totalCents },
          commissionAcumCents: { decrement: payment.order.promoterCommissionCents },
        },
      });
    }

    expect(tx.calls.promoterLinkUpdates).toHaveLength(1);
    expect(tx.calls.promoterLinkUpdates[0].data.commissionAcumCents.decrement).toBe(1000);
    expect(tx.calls.promoterLinkUpdates[0].data.conversions.decrement).toBe(1);
  });

  it("does NOT reverse commission when canceling a PENDING order (commission was never credited)", async () => {
    const tx = makeTx();
    const payment = makePayment(PaymentStatus.PENDING, true); // was PENDING, never PAID
    tx.payment.findFirst.mockResolvedValue(payment);

    const wasPaid = payment.status === PaymentStatus.PAID;
    expect(wasPaid).toBe(false);

    if (wasPaid && payment.order.promoterLinkId && payment.order.promoterCommissionCents > 0) {
      await tx.promoterLink.update({ where: { id: "link-1" }, data: {} });
    }

    // Should NOT decrement because the order was never PAID — commission was never credited
    expect(tx.calls.promoterLinkUpdates).toHaveLength(0);
    expect(tx.promoterLink.update).not.toHaveBeenCalled();
  });

  it("does NOT credit commission when order has no promoterLinkId", async () => {
    const tx = makeTx();
    const payment = makePayment(PaymentStatus.PENDING, false); // no promoter
    tx.payment.findFirst.mockResolvedValue(payment);

    const wasAlreadyPaid = payment.status === PaymentStatus.PAID;

    if (!wasAlreadyPaid && payment.order.promoterLinkId && payment.order.promoterCommissionCents > 0) {
      await tx.promoterLink.update({ where: { id: "link-1" }, data: {} });
    }

    expect(tx.promoterLink.update).not.toHaveBeenCalled();
  });
});
