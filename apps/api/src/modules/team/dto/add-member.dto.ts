import { TeamPermission } from "@prisma/client";
import { IsArray, IsEmail, IsEnum } from "class-validator";

export class AddMemberDto {
  @IsEmail()
  email!: string;

  @IsArray()
  @IsEnum(TeamPermission, { each: true })
  permissions!: TeamPermission[];
}
