import { GUARDS_METADATA } from "@nestjs/common/constants";
import { UserRole } from "@prisma/client";
import { ROLES_KEY } from "../../common/decorators/roles.decorator";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { RolesGuard } from "../../common/guards/roles.guard";
import { PaymentsController } from "./payments.controller";

describe("PaymentsController security", () => {
  it("requires JWT and roles guards for payment routes", () => {
    const guards = Reflect.getMetadata(GUARDS_METADATA, PaymentsController) ?? [];

    expect(guards).toEqual(expect.arrayContaining([JwtAuthGuard, RolesGuard]));
  });

  it("allows only admins to manually update payment status", () => {
    const roles = Reflect.getMetadata(ROLES_KEY, PaymentsController.prototype.updateStatus);

    expect(roles).toEqual([UserRole.ADMIN]);
  });

  it("limits provider preference creation to admins and organizers", () => {
    const roles = Reflect.getMetadata(ROLES_KEY, PaymentsController.prototype.createPreference);

    expect(roles).toEqual([UserRole.ADMIN, UserRole.ORGANIZER]);
  });
});
