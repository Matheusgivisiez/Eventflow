import { IsEmail, IsString } from "class-validator";

export class CreateTransferDto {
  @IsString()
  ticketId!: string;

  @IsEmail()
  receiverEmail!: string;

  @IsString()
  confirmation!: string;
}

export class ResolveTransferRecipientDto {
  @IsEmail()
  receiverEmail!: string;
}
