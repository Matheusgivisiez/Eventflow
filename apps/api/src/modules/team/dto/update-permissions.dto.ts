import { TeamPermission } from "@prisma/client";
import { IsArray, IsEnum } from "class-validator";

export class UpdatePermissionsDto {
  @IsArray()
  @IsEnum(TeamPermission, { each: true })
  permissions!: TeamPermission[];
}
