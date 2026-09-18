import { IsArray, IsBoolean, IsDateString, IsInt, IsNotEmpty, IsOptional, IsString, Max, Min } from "class-validator";

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

  /**
   * IDs dos eventos aos quais este cupom fica restrito. Omitido ou vazio =
   * vale para todos os eventos do organizador (comportamento anterior).
   */
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  eventIds?: string[];
}
