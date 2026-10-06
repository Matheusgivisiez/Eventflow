import { ForbiddenException } from "@nestjs/common";
import { ReportsService } from "./reports.service";

describe("ReportsService scoped sales", () => {
  const prismaRead = {
    order: { findMany: jest.fn().mockResolvedValue([]) },
    checkInLog: { count: jest.fn().mockResolvedValue(0) },
    ticket: { count: jest.fn().mockResolvedValue(0), findMany: jest.fn().mockResolvedValue([]) },
    analyticsEvent: { findMany: jest.fn().mockResolvedValue([]) }
  };
  const cache = { get: jest.fn().mockResolvedValue(null), set: jest.fn() };
  const service = new ReportsService({} as any, prismaRead as any, cache as any);

  beforeEach(() => jest.clearAllMocks());

  it("nega evento fora da atribuição antes de consultar dados", async () => {
    await expect(service.summary("tenant", { eventId: "other" }, ["event-1"])).rejects.toBeInstanceOf(ForbiddenException);
    expect(prismaRead.order.findMany).not.toHaveBeenCalled();
  });

  it("filtra vendas e visualizações e omite participantes", async () => {
    const result = await service.summary("tenant", {}, ["event-1"]);
    expect(prismaRead.order.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ event: { tenantId: "tenant", id: { in: ["event-1"] } } })
    }));
    expect(prismaRead.analyticsEvent.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ eventId: { in: ["event-1"] } })
    }));
    expect(prismaRead.ticket.findMany).not.toHaveBeenCalled();
    expect(result.participants).toEqual([]);
  });

  it("não exporta participantes com permissão apenas de vendas", async () => {
    await expect(service.export("tenant", { type: "participants" }, ["event-1"])).rejects.toBeInstanceOf(ForbiddenException);
  });
});
