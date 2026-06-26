import { IsString } from "class-validator";
import { ApiProperty } from "@nestjs/swagger";

export class ValidateTicketDto {
  @ApiProperty({ description: "Código do ingresso (UUID ou JSON com assinatura)" })
  @IsString()
  code!: string;
}
