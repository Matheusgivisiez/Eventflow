import { EventAccessRole } from "@prisma/client";
import { IsEnum, IsString } from "class-validator";

export class ManageEventAccessDto {
  @IsString()
  userId!: string;

  @IsEnum(EventAccessRole)
  role!: EventAccessRole;
}
