import { IsEmail, IsString, MinLength, ValidateIf } from "class-validator";

export class CreateTransferDto {
  @IsString()
  ticketId!: string;

  @ValidateIf((dto: CreateTransferDto) => !dto.receiverCpf)
  @IsEmail()
  receiverEmail?: string;

  @ValidateIf((dto: CreateTransferDto) => !dto.receiverEmail)
  @IsString()
  receiverCpf?: string;

  @IsString()
  @MinLength(8)
  password!: string;
}

export class ResolveTransferRecipientDto {
  @ValidateIf((dto: ResolveTransferRecipientDto) => !dto.receiverCpf)
  @IsEmail()
  receiverEmail?: string;

  @ValidateIf((dto: ResolveTransferRecipientDto) => !dto.receiverEmail)
  @IsString()
  receiverCpf?: string;
}
