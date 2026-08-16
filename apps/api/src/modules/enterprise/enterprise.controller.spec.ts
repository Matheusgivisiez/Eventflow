import { GUARDS_METADATA } from "@nestjs/common/constants";
import { Reflector } from "@nestjs/core";
import { TeamPermission, UserRole } from "@prisma/client";
import { PERMISSIONS_KEY } from "../../common/decorators/permissions.decorator";
import { ROLES_KEY } from "../../common/decorators/roles.decorator";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { RolesGuard } from "../../common/guards/roles.guard";
import { TeamPermissionGuard } from "../../common/guards/team-permission.guard";
import { EnterpriseController } from "./enterprise.controller";

const enterpriseRoles = [UserRole.ADMIN, UserRole.ORGANIZER, UserRole.TEAM];

function guardsFor(methodName: keyof EnterpriseController) {
  return Reflect.getMetadata(GUARDS_METADATA, EnterpriseController.prototype[methodName]) ?? [];
}

function rolesFor(methodName: keyof EnterpriseController) {
  return Reflect.getMetadata(ROLES_KEY, EnterpriseController.prototype[methodName]) ?? [];
}

function permissionsFor(methodName: keyof EnterpriseController) {
  return Reflect.getMetadata(PERMISSIONS_KEY, EnterpriseController.prototype[methodName]) ?? [];
}

function contextFor(methodName: keyof EnterpriseController, user: { id: string; role: UserRole; tenantId?: string | null }) {
  return {
    getHandler: () => EnterpriseController.prototype[methodName],
    getClass: () => EnterpriseController,
    switchToHttp: () => ({
      getRequest: () => ({ user })
    })
  } as any;
}

describe("EnterpriseController security", () => {
  it("keeps public enterprise discovery routes unauthenticated", () => {
    for (const methodName of ["publicApiDocs", "track", "marketplace", "marketplaceCategories", "resolveDomain"] as const) {
      expect(guardsFor(methodName)).toEqual([]);
      expect(rolesFor(methodName)).toEqual([]);
      expect(permissionsFor(methodName)).toEqual([]);
    }
  });

  it.each([
    ["overview", TeamPermission.VIEW_ANALYTICS],
    ["whiteLabel", TeamPermission.MANAGE_WHITE_LABEL],
    ["upsertWhiteLabel", TeamPermission.MANAGE_WHITE_LABEL],
    ["registerDevice", TeamPermission.CHECK_IN],
    ["syncOfflineCheckins", TeamPermission.CHECK_IN],
    ["affiliates", TeamPermission.MANAGE_AFFILIATES],
    ["upsertAffiliateProgram", TeamPermission.MANAGE_AFFILIATES],
    ["createAffiliateLink", TeamPermission.MANAGE_AFFILIATES],
    ["crmCustomers", TeamPermission.MANAGE_CRM],
    ["createCrmCustomer", TeamPermission.MANAGE_CRM],
    ["createSegment", TeamPermission.MANAGE_CRM],
    ["createCampaign", TeamPermission.MANAGE_MARKETING],
    ["createAutomation", TeamPermission.MANAGE_MARKETING],
    ["marketing", TeamPermission.MANAGE_MARKETING],
    ["queueMessage", TeamPermission.MANAGE_MARKETING],
    ["analytics", TeamPermission.VIEW_ANALYTICS],
    ["upsertAnalyticsIntegration", TeamPermission.VIEW_ANALYTICS],
    ["createApiClient", TeamPermission.MANAGE_PUBLIC_API],
    ["createApiKey", TeamPermission.MANAGE_PUBLIC_API],
    ["seatMaps", TeamPermission.MANAGE_SEAT_MAPS],
    ["createSeatMap", TeamPermission.MANAGE_SEAT_MAPS],
    ["holdSeats", TeamPermission.MANAGE_SEAT_MAPS],
    ["reserveSeats", TeamPermission.MANAGE_SEAT_MAPS],
    ["upsertMarketplaceProfile", TeamPermission.EDIT_EVENT],
    ["ai", TeamPermission.VIEW_ANALYTICS],
    ["createForecast", TeamPermission.VIEW_ANALYTICS],
    ["executive", TeamPermission.VIEW_ANALYTICS],
    ["security", TeamPermission.MANAGE_SECURITY],
    ["enableTwoFactor", TeamPermission.MANAGE_SECURITY],
    ["scheduleBackup", TeamPermission.MANAGE_SECURITY],
    ["infrastructure", TeamPermission.MANAGE_SECURITY]
  ] as Array<[keyof EnterpriseController, TeamPermission]>)(
    "requires enterprise role and %s permission",
    (methodName, permission) => {
      expect(guardsFor(methodName)).toEqual(expect.arrayContaining([JwtAuthGuard, RolesGuard, TeamPermissionGuard]));
      expect(rolesFor(methodName)).toEqual(enterpriseRoles);
      expect(rolesFor(methodName)).not.toContain(UserRole.CUSTOMER);
      expect(permissionsFor(methodName)).toEqual([permission]);
    }
  );

  it("allows authenticated customers only on marketplace review and favorite routes", () => {
    for (const methodName of ["reviewEvent", "favoriteEvent"] as const) {
      expect(guardsFor(methodName)).toEqual(expect.arrayContaining([JwtAuthGuard, RolesGuard]));
      expect(guardsFor(methodName)).not.toContain(TeamPermissionGuard);
      expect(rolesFor(methodName)).toEqual(expect.arrayContaining(Object.values(UserRole)));
      expect(permissionsFor(methodName)).toEqual([]);
    }
  });

  it("denies customers before they can access enterprise tenant routes", () => {
    const guard = new RolesGuard(new Reflector());

    const allowed = guard.canActivate(contextFor("whiteLabel", {
      id: "customer-1",
      role: UserRole.CUSTOMER,
      tenantId: null
    }));

    expect(allowed).toBe(false);
  });

  it("denies team members missing the required enterprise permission", async () => {
    const guard = new TeamPermissionGuard(new Reflector(), {
      teamMember: {
        findUnique: jest.fn().mockResolvedValue({ permissions: [] })
      }
    } as any);

    await expect(guard.canActivate(contextFor("whiteLabel", {
      id: "team-1",
      role: UserRole.TEAM,
      tenantId: "tenant-1"
    }))).rejects.toThrow("Voce nao tem permissao");
  });

  it("allows team members with the required enterprise permission", async () => {
    const guard = new TeamPermissionGuard(new Reflector(), {
      teamMember: {
        findUnique: jest.fn().mockResolvedValue({ permissions: [TeamPermission.MANAGE_WHITE_LABEL] })
      }
    } as any);

    await expect(guard.canActivate(contextFor("whiteLabel", {
      id: "team-1",
      role: UserRole.TEAM,
      tenantId: "tenant-1"
    }))).resolves.toBe(true);
  });
});
