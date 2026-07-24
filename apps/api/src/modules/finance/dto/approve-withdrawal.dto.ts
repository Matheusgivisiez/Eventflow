import { IsString, IsNotEmpty } from "class-validator";

export class ApproveWithdrawalDto {
  @IsString()
  @IsNotEmpty()
  pixKey!: string;
}
