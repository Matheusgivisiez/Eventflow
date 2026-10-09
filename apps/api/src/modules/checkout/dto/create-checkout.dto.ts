import { PaymentMethod } from "@prisma/client";
import { Type } from "class-transformer";
import { IsArray, IsEmail, IsEnum, IsInt, IsNotEmpty, IsOptional, IsString, Matches, Min, ValidateNested } from "class-validator";
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
  @ApiPropertyOptional({ description: "Origem do site para retorno após o pagamento; validada pelo servidor" })
  @IsOptional()
  @IsString()
  returnOrigin?: string;

  @ApiProperty({ description: "Nome do comprador" })
  @IsString()
  @IsNotEmpty()
  buyerName!: string;

  @ApiPropertyOptional({ description: "Ignorado: o pedido usa sempre o e-mail da conta logada. Aceito só por compatibilidade." })
  @IsOptional()
  @IsEmail()
  buyerEmail?: string;

  @ApiProperty({ description: "Documento (CPF/CNPJ) do comprador" })
  @IsString()
  @IsNotEmpty()
  @Matches(/^\D*(\d\D*){11}$|^\D*(\d\D*){14}$/, { message: "Informe um CPF ou CNPJ válido." })
  buyerDocument!: string;

  @ApiProperty({ description: "Telefone do comprador" })
  @IsString()
  @IsNotEmpty()
  @Matches(/^\D*(\d\D*){10,11}$/, { message: "Informe um telefone com DDD." })
  buyerPhone!: string;

  @ApiPropertyOptional({ description: "Código do cupom de desconto" })
  @IsOptional()
  @IsString()
  couponCode?: string;

  @ApiPropertyOptional({ description: "Código do link de afiliado" })
  @IsOptional()
  @IsString()
  affiliateCode?: string;

  @ApiPropertyOptional({ description: "Código do link de promoter" })
  @IsOptional()
  @IsString()
  promoterCode?: string;

  @ApiPropertyOptional({ description: "Token do convite para evento privado" })
  @IsOptional()
  @IsString()
  inviteToken?: string;

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
