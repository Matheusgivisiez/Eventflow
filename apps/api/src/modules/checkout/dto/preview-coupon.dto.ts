import { ApiProperty } from "@nestjs/swagger";
import { IsNotEmpty, IsString, MaxLength } from "class-validator";

export class PreviewCouponDto {
  @ApiProperty({ description: "Código do cupom digitado pelo comprador" })
  @IsString()
  @IsNotEmpty()
  @MaxLength(40)
  code!: string;
}
