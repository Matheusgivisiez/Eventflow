import { TeamPermission, UserRole } from "@prisma/client";
import { PERMISSIONS_KEY } from "../../common/decorators/permissions.decorator";
import { ROLES_KEY } from "../../common/decorators/roles.decorator";
import { FinanceController } from "./finance.controller";

describe("FinanceController permissions", () => {
  it("permite consulta financeira à equipe com permissão", () => {
    expect(Reflect.getMetadata(ROLES_KEY, FinanceController)).toContain(UserRole.TEAM);
    expect(Reflect.getMetadata(PERMISSIONS_KEY, FinanceController)).toContain(TeamPermission.FINANCE);
  });

  it("mantém solicitação e listagem de saques exclusivas do organizador e admin", () => {
    for (const method of [FinanceController.prototype.requestWithdrawal, FinanceController.prototype.listWithdrawals]) {
      expect(Reflect.getMetadata(ROLES_KEY, method)).toEqual([UserRole.ADMIN, UserRole.ORGANIZER]);
    }
  });
});
