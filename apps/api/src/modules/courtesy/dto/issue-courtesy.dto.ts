import { Type } from "class-transformer";
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsEmail,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested
} from "class-validator";

/** Teto por requisição: cada convidado vira um e-mail enviado antes da resposta. */
export const MAX_GUESTS_PER_REQUEST = 30;
export const MAX_TICKETS_PER_GUEST = 10;

export class CourtesyGuestDto {
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name!: string;

  @IsEmail()
  @MaxLength(254)
  email!: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(MAX_TICKETS_PER_GUEST)
  quantity?: number;
}

export class IssueCourtesyDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(MAX_GUESTS_PER_REQUEST)
  @ValidateNested({ each: true })
  @Type(() => CourtesyGuestDto)
  guests!: CourtesyGuestDto[];

  /** Nome que aparece no ingresso e na portaria. Ex.: "Convidado VIP", "Imprensa". */
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(60)
  label?: string;

  /** Observação interna de quem emitiu. Fica só na auditoria. */
  @IsOptional()
  @IsString()
  @MaxLength(300)
  note?: string;

  /** Padrão: envia o ingresso por e-mail para cada convidado. */
  @IsOptional()
  @IsBoolean()
  sendEmail?: boolean;
}
