import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsNotEmpty, IsOptional, IsString, MaxLength } from "class-validator";

export class PreviewCouponDto {
  @ApiProperty({ description: "Código do cupom digitado pelo comprador" })
  @IsString()
  @IsNotEmpty()
  @MaxLength(40)
  code!: string;

  @ApiPropertyOptional({ description: "Token do convite, obrigatório para evento privado" })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  inviteToken?: string;
}
