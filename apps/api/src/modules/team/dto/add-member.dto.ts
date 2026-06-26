import { TeamPermission } from "@prisma/client";
import { IsArray, IsEmail, IsEnum, IsNotEmpty, IsString } from "class-validator";

export class AddMemberDto {
  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsEmail()
  email!: string;

  @IsArray()
  @IsEnum(TeamPermission, { each: true })
  permissions!: TeamPermission[];
}
