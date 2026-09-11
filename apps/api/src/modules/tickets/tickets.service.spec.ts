import { BadRequestException } from "@nestjs/common";
import { TicketsService } from "./tickets.service";

jest.mock("nanoid", () => ({ nanoid: jest.fn(() => "fixed-id") }));

function createService() {
  const prisma = {
    ticketType: {
      create: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
      delete: jest.fn()
    }
  };
  const events = { findOne: jest.fn().mockResolvedValue({ id: "event-1" }) };
  const service = new TicketsService(prisma as any, events as any);
  return { service, prisma, events };
}

describe("TicketsService", () => {
  it("rejects creating a ticket lot with a past sales start date", async () => {
    const { service, prisma } = createService();

    await expect(service.create("event-1", "tenant-1", {
      name: "Lote 1",
      quantity: 10,
      priceCents: 1000,
      startsAt: new Date(Date.now() - 1000).toISOString(),
      endsAt: new Date(Date.now() + 1000 * 60).toISOString(),
      limitPerBuy: 5
    })).rejects.toThrow(BadRequestException);
    expect(prisma.ticketType.create).not.toHaveBeenCalled();
  });

  it("rejects updating a ticket lot with an end before the start", async () => {
    const { service, prisma } = createService();
    prisma.ticketType.findFirst.mockResolvedValue({
      id: "ticket-type-1",
      startsAt: new Date(Date.now() + 1000 * 60 * 60),
      endsAt: new Date(Date.now() + 1000 * 60 * 60 * 2)
    });

    await expect(service.update("ticket-type-1", "tenant-1", {
      startsAt: new Date(Date.now() + 1000 * 60 * 60).toISOString(),
      endsAt: new Date(Date.now() + 1000 * 60).toISOString()
    })).rejects.toThrow(BadRequestException);
    expect(prisma.ticketType.update).not.toHaveBeenCalled();
  });
});
