import { GUARDS_METADATA, PATH_METADATA } from "@nestjs/common/constants";
import { UserRole } from "@prisma/client";
import { ROLES_KEY } from "../../common/decorators/roles.decorator";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { RolesGuard } from "../../common/guards/roles.guard";
import { AdminController } from "./admin.controller";

jest.mock("nanoid", () => ({ nanoid: jest.fn(() => "fixed-id") }));

describe("AdminController access and existing routes", () => {
  it("requires an authenticated ADMIN for all administrative routes", () => {
    expect(Reflect.getMetadata(ROLES_KEY, AdminController)).toEqual([UserRole.ADMIN]);
    expect(Reflect.getMetadata(GUARDS_METADATA, AdminController)).toEqual(expect.arrayContaining([JwtAuthGuard, RolesGuard]));
  });

  it("keeps the original list paths and adds separate paginated paths", () => {
    for (const [method, path] of [
      ["users", "users"], ["events", "events"], ["payments", "payments"],
      ["usersPage", "users-page"], ["eventsPage", "events-page"], ["paymentsPage", "payments-page"]
    ] as const) {
      expect(Reflect.getMetadata(PATH_METADATA, AdminController.prototype[method])).toBe(path);
    }
  });
});
