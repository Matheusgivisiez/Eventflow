import { TeamPermission } from "@prisma/client";
import { IsArray, IsBoolean, IsEmail, IsEnum, IsString } from "class-validator";

export class AddMemberDto {
  @IsEmail()
  email!: string;

  @IsArray()
  @IsEnum(TeamPermission, { each: true })
  permissions!: TeamPermission[];

  @IsBoolean()
  allEvents!: boolean;

  @IsArray()
  @IsString({ each: true })
  eventIds!: string[];
}
