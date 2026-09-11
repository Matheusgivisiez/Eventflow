import { Transform } from "class-transformer";
import { IsEmail, IsNotEmpty, IsOptional, IsString, Matches, MinLength } from "class-validator";

export class RegisterDto {
  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(8)
  password!: string;

  @IsOptional()
  @IsString()
  companyName?: string;

  @IsString()
  @IsNotEmpty()
  @Transform(({ value }) => typeof value === "string" ? value.replace(/\D/g, "") : value)
  @Matches(/^\d{10,11}$/, { message: "Informe um telefone com DDD." })
  phone!: string;

  @IsString()
  @IsNotEmpty()
  @Transform(({ value }) => typeof value === "string" ? value.replace(/\D/g, "") : value)
  @Matches(/^\d{11}$/, { message: "Informe um CPF valido com 11 digitos." })
  cpf!: string;
}
