import { IsString } from "class-validator";

export class RequestRefundDto {
  @IsString()
  confirmation!: string;
}
