import { PaymentMethod } from "@prisma/client";
import { Type } from "class-transformer";
import { IsArray, IsEmail, IsEnum, IsInt, IsNotEmpty, IsOptional, IsString, Min, ValidateNested } from "class-validator";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

export class CheckoutItemDto {
  @ApiProperty({ description: "ID do lote de ingresso" })
  @IsString()
  ticketTypeId!: string;

  @ApiProperty({ description: "Quantidade de ingressos", minimum: 1 })
  @IsInt()
  @Min(1)
  quantity!: number;

  @ApiPropertyOptional({ description: "IDs dos assentos selecionados" })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  seatIds?: string[];
}

export class CreateCheckoutDto {
  @ApiProperty({ description: "Nome do comprador" })
  @IsString()
  @IsNotEmpty()
  buyerName!: string;

  @ApiProperty({ description: "E-mail do comprador" })
  @IsEmail()
  buyerEmail!: string;

  @ApiPropertyOptional({ description: "Documento (CPF/CNPJ) do comprador" })
  @IsOptional()
  @IsString()
  buyerDocument?: string;

  @ApiPropertyOptional({ description: "Telefone do comprador" })
  @IsOptional()
  @IsString()
  buyerPhone?: string;

  @ApiPropertyOptional({ description: "Código do cupom de desconto" })
  @IsOptional()
  @IsString()
  couponCode?: string;

  @ApiPropertyOptional({ description: "Código do link de afiliado" })
  @IsOptional()
  @IsString()
  affiliateCode?: string;

  @ApiPropertyOptional({ description: "Fonte de tráfego" })
  @IsOptional()
  @IsString()
  source?: string;

  @ApiPropertyOptional({ description: "Dispositivo utilizado" })
  @IsOptional()
  @IsString()
  device?: string;

  @ApiPropertyOptional({ description: "Campanha de marketing" })
  @IsOptional()
  @IsString()
  campaign?: string;

  @ApiPropertyOptional({ description: "ID da sessão" })
  @IsOptional()
  @IsString()
  sessionId?: string;

  @ApiProperty({ description: "Método de pagamento", enum: PaymentMethod })
  @IsEnum(PaymentMethod)
  paymentMethod!: PaymentMethod;

  @ApiProperty({ description: "Itens do pedido", type: [CheckoutItemDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CheckoutItemDto)
  items!: CheckoutItemDto[];
}
