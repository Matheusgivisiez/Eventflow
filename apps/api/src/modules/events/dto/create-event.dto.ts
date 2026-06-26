import { EventFormat, EventStatus } from "@prisma/client";
import { IsArray, IsBoolean, IsDateString, IsEnum, IsInt, IsNotEmpty, IsOptional, IsString, IsUrl, Min } from "class-validator";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

export class CreateEventDto {
  @ApiProperty({ description: "Título do evento" })
  @IsString()
  @IsNotEmpty()
  title!: string;

  @ApiProperty({ description: "Descrição do evento" })
  @IsString()
  @IsNotEmpty()
  description!: string;

  @ApiProperty({ description: "Categoria do evento" })
  @IsString()
  @IsNotEmpty()
  category!: string;

  @ApiProperty({ description: "Data e hora de início (ISO 8601)" })
  @IsDateString()
  startsAt!: string;

  @ApiPropertyOptional({ description: "Data e hora de término (ISO 8601)" })
  @IsOptional()
  @IsDateString()
  endsAt?: string;

  @ApiPropertyOptional({ description: "URL do banner do evento" })
  @IsOptional()
  @IsUrl({ require_tld: false })
  bannerUrl?: string;

  @ApiPropertyOptional({ description: "URLs da galeria de imagens" })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  galleryUrls?: string[];

  @ApiPropertyOptional({ description: "Cidade do evento" })
  @IsOptional()
  @IsString()
  city?: string;

  @ApiPropertyOptional({ description: "Estado do evento" })
  @IsOptional()
  @IsString()
  state?: string;

  @ApiPropertyOptional({ description: "CEP do evento" })
  @IsOptional()
  @IsString()
  zipCode?: string;

  @ApiPropertyOptional({ description: "Endereço do evento" })
  @IsOptional()
  @IsString()
  address?: string;

  @ApiPropertyOptional({ description: "URL do mapa do evento" })
  @IsOptional()
  @IsString()
  mapUrl?: string;

  @ApiProperty({ description: "Formato do evento", enum: EventFormat })
  @IsEnum(EventFormat)
  format!: EventFormat;

  @ApiPropertyOptional({ description: "Status do evento", enum: EventStatus })
  @IsOptional()
  @IsEnum(EventStatus)
  status?: EventStatus;

  @ApiPropertyOptional({ description: "Título SEO" })
  @IsOptional()
  @IsString()
  seoTitle?: string;

  @ApiPropertyOptional({ description: "Descrição SEO" })
  @IsOptional()
  @IsString()
  seoDescription?: string;

  @ApiPropertyOptional({ description: "URL do evento online" })
  @IsOptional()
  @IsString()
  @IsUrl({ require_tld: false })
  onlineUrl?: string;

  @ApiPropertyOptional({ description: "FAQ do evento em JSON" })
  @IsOptional()
  faqJson?: any;

  @ApiPropertyOptional({ description: "Agenda do evento em JSON" })
  @IsOptional()
  agendaJson?: any;

  @ApiPropertyOptional({ description: "Início das vendas (ISO 8601)" })
  @IsOptional()
  @IsDateString()
  salesStartsAt?: string;

  @ApiPropertyOptional({ description: "Fim das vendas (ISO 8601)" })
  @IsOptional()
  @IsDateString()
  salesEndsAt?: string;

  @ApiPropertyOptional({ description: "Limite de ingressos por CPF" })
  @IsOptional()
  @IsInt()
  @Min(1)
  limitPerCpf?: number;

  @ApiPropertyOptional({ description: "Organizador absorve a taxa" })
  @IsOptional()
  @IsBoolean()
  feeAbsorbedByOrganizer?: boolean;
}
