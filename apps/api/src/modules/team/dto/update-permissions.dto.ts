import { TeamPermission } from "@prisma/client";
import { IsArray, IsBoolean, IsEnum, IsString } from "class-validator";

export class UpdatePermissionsDto {
  @IsArray()
  @IsEnum(TeamPermission, { each: true })
  permissions!: TeamPermission[];

  @IsBoolean()
  allEvents!: boolean;

  @IsArray()
  @IsString({ each: true })
  eventIds!: string[];
}
