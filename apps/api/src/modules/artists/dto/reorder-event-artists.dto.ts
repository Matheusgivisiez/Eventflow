import { ApiProperty } from "@nestjs/swagger";
import { ArrayMinSize, IsArray, IsString } from "class-validator";
export class ReorderEventArtistsDto {
  @ApiProperty({ type: [String] }) @IsArray() @ArrayMinSize(1) @IsString({ each: true }) artistIds!: string[];
}
