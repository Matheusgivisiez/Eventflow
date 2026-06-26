import { SetMetadata } from "@nestjs/common";
import { TeamPermission } from "@prisma/client";

export const PERMISSIONS_KEY = "team_permissions";
export const RequirePermissions = (...permissions: TeamPermission[]) => SetMetadata(PERMISSIONS_KEY, permissions);
