import { IsInt, Min } from "class-validator";

export class RequestWithdrawalDto {
  @IsInt()
  @Min(100)
  amountCents!: number;
}
