import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsOptional, IsString, IsUrl, MaxLength } from "class-validator";

export class CreateArtistDto {
  @ApiProperty({ description: "Nome artístico" })
  @IsString() @MaxLength(120) stageName!: string;
  @ApiPropertyOptional() @IsOptional() @IsUrl({ protocols: ["http", "https"], require_protocol: true }) imageUrl?: string;
  @ApiPropertyOptional() @IsOptional() @IsUrl({ protocols: ["http", "https"], require_protocol: true }) instagramUrl?: string;
  @ApiPropertyOptional() @IsOptional() @IsUrl({ protocols: ["http", "https"], require_protocol: true }) spotifyUrl?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(1000) bio?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(80) genre?: string;
}
