import { IsString, MinLength } from "class-validator";

export class RequestRefundDto {
  @IsString()
  @MinLength(8)
  password!: string;
}
