import { BadRequestException } from "@nestjs/common";
import { CheckInStatus, TicketStatus, UserRole } from "@prisma/client";
import { EnterpriseMobileService } from "./enterprise-mobile.service";

const user = { id: "operator-1", tenantId: "tenant-1", email: "operator@example.com", role: UserRole.TEAM };

function createService() {
  const prisma = {
    event: { findFirst: jest.fn() },
    offlineCheckinBatch: { create: jest.fn() }
  };
  const validateTicket = { execute: jest.fn() };
  const service = new EnterpriseMobileService(prisma as any, validateTicket as any);
  return { service, prisma, validateTicket };
}

describe("EnterpriseMobileService offline check-in", () => {
  it("uses the same signed ticket validation as online check-in before accepting an offline scan", async () => {
    const { service, prisma, validateTicket } = createService();
    prisma.event.findFirst.mockResolvedValue({ id: "event-1" });
    validateTicket.execute.mockResolvedValue({
      status: CheckInStatus.ENTERED,
      message: "Entrada liberada.",
      ticket: { id: "ticket-1", uuid: "ticket-uuid", status: TicketStatus.USED }
    });
    prisma.offlineCheckinBatch.create.mockImplementation(({ data }) => data);
    const signedPayload = '{"uuid":"ticket-uuid","orderId":"order-1","signature":"valid"}';

    const result = await service.syncOfflineCheckins(user, {
      eventId: "event-1", deviceId: "device-1", scans: [{ ticketUuid: "ticket-uuid", rawPayload: signedPayload }]
    });

    expect(validateTicket.execute).toHaveBeenCalledWith("event-1", "tenant-1", "operator-1", signedPayload, { requireSignedPayload: true });
    expect(result.acceptedScans).toBe(1);
    expect(result.rejectedScans).toBe(0);
  });

  it("records a refusal when the shared validator rejects an unsigned or unpaid ticket", async () => {
    const { service, prisma, validateTicket } = createService();
    prisma.event.findFirst.mockResolvedValue({ id: "event-1" });
    validateTicket.execute.mockRejectedValue(new BadRequestException("QR Code assinado obrigatorio para sincronizacao offline."));
    prisma.offlineCheckinBatch.create.mockImplementation(({ data }) => data);

    const result = await service.syncOfflineCheckins(user, {
      eventId: "event-1", deviceId: "device-1", scans: [{ ticketUuid: "ticket-uuid", rawPayload: "ticket-uuid" }]
    });

    expect(result.acceptedScans).toBe(0);
    expect(result.rejectedScans).toBe(1);
    expect(result.entries.create[0]).toEqual(expect.objectContaining({ status: CheckInStatus.REFUSED }));
  });
});
