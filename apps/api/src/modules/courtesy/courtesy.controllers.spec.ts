import { ForbiddenException } from "@nestjs/common";
import { TicketOrigin, UserRole } from "@prisma/client";
import { ROLES_KEY } from "../../common/decorators/roles.decorator";
import { AdminCourtesyController } from "./admin-courtesy.controller";
import { EventCourtesyController } from "./event-courtesy.controller";

const owner = { id: "owner-1", tenantId: "tenant-1", email: "o@example.com", emailVerified: true, role: UserRole.ORGANIZER };
const dto = { guests: [{ name: "Ana", email: "ana@example.com" }] };

function createCourtesy() {
  return { issue: jest.fn().mockResolvedValue({}), list: jest.fn().mockResolvedValue({}), cancel: jest.fn().mockResolvedValue({}), countsByEvent: jest.fn() };
}

describe("AdminCourtesyController", () => {
  it("é restrito ao admin da plataforma", () => {
    expect(Reflect.getMetadata(ROLES_KEY, AdminCourtesyController)).toEqual([UserRole.ADMIN]);
  });

  it("emite e cancela sempre como PLATFORM_COURTESY, em qualquer evento", async () => {
    const courtesy = createCourtesy();
    const controller = new AdminCourtesyController(courtesy as any);
    const admin = { ...owner, id: "admin-1", role: UserRole.ADMIN };

    await controller.issue(admin, "event-de-outro-tenant", dto);
    await controller.cancel(admin, "ticket-1");

    expect(courtesy.issue).toHaveBeenCalledWith("event-de-outro-tenant", TicketOrigin.PLATFORM_COURTESY, admin, dto);
    expect(courtesy.cancel).toHaveBeenCalledWith("ticket-1", TicketOrigin.PLATFORM_COURTESY, admin);
  });

  it("lista VIP por padrão e só troca para cortesia do organizador quando pedido", async () => {
    const courtesy = createCourtesy();
    const controller = new AdminCourtesyController(courtesy as any);
    await controller.list("event-1");
    await controller.list("event-1", "ORGANIZER_COURTESY");
    await controller.list("event-1", "SALE");
    expect(courtesy.list.mock.calls.map((call) => call[1])).toEqual([
      TicketOrigin.PLATFORM_COURTESY, TicketOrigin.ORGANIZER_COURTESY, TicketOrigin.PLATFORM_COURTESY
    ]);
  });
});

describe("EventCourtesyController", () => {
  it("só o dono do evento emite, lista e cancela: quem não é dono para antes do serviço", async () => {
    const courtesy = createCourtesy();
    const access = { assertOwner: jest.fn().mockRejectedValue(new ForbiddenException()) };
    const controller = new EventCourtesyController(courtesy as any, access as any);

    await expect(controller.issue(owner, "event-1", dto)).rejects.toBeInstanceOf(ForbiddenException);
    await expect(controller.list(owner, "event-1")).rejects.toBeInstanceOf(ForbiddenException);
    await expect(controller.cancel(owner, "event-1", "ticket-1")).rejects.toBeInstanceOf(ForbiddenException);

    expect(access.assertOwner).toHaveBeenCalledWith("event-1", "owner-1");
    expect(courtesy.issue).not.toHaveBeenCalled();
    expect(courtesy.list).not.toHaveBeenCalled();
    expect(courtesy.cancel).not.toHaveBeenCalled();
  });

  it("a origem é sempre ORGANIZER_COURTESY: o dono nunca enxerga nem cancela VIP da plataforma", async () => {
    const courtesy = createCourtesy();
    const access = { assertOwner: jest.fn().mockResolvedValue(undefined) };
    const controller = new EventCourtesyController(courtesy as any, access as any);

    await controller.issue(owner, "event-1", dto);
    await controller.list(owner, "event-1");
    await controller.cancel(owner, "event-1", "ticket-1");

    expect(courtesy.issue).toHaveBeenCalledWith("event-1", TicketOrigin.ORGANIZER_COURTESY, owner, dto);
    expect(courtesy.list).toHaveBeenCalledWith("event-1", TicketOrigin.ORGANIZER_COURTESY);
    expect(courtesy.cancel).toHaveBeenCalledWith("ticket-1", TicketOrigin.ORGANIZER_COURTESY, owner, "event-1");
  });
});
