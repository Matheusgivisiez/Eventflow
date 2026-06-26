import { IsBoolean, IsDateString, IsInt, IsNotEmpty, IsOptional, IsString, Max, Min } from "class-validator";

export class CreateCouponDto {
  @IsString()
  @IsNotEmpty()
  code!: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  discountPercent?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  discountFixedCents?: number;

  @IsInt()
  @Min(0)
  maxUses!: number; // 0 = unlimited

  @IsDateString()
  validFrom!: string;

  @IsDateString()
  validUntil!: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
