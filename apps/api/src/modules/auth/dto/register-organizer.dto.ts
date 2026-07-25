import { IsEmail, IsNotEmpty, IsOptional, IsString, Matches, MinLength } from "class-validator";

export class RegisterOrganizerDto {
  // ─── Dados do Responsável ─────────────────────────────────────
  @IsString()
  @IsNotEmpty({ message: "Informe o nome completo." })
  name!: string;

  @IsEmail({}, { message: "Informe um e-mail válido." })
  email!: string;

  @IsString()
  @MinLength(8, { message: "A senha deve ter pelo menos 8 caracteres." })
  password!: string;

  @IsString()
  @IsNotEmpty({ message: "Informe o telefone." })
  phone!: string;

  // ─── Dados da Empresa ─────────────────────────────────────────
  @IsString()
  @IsNotEmpty({ message: "Informe o CNPJ." })
  @Matches(/^\d{14}$/, { message: "CNPJ deve conter exatamente 14 dígitos numéricos." })
  cnpj!: string;

  @IsString()
  @IsNotEmpty({ message: "Informe o nome da empresa." })
  companyName!: string;

  @IsString()
  @IsNotEmpty({ message: "Informe a cidade." })
  city!: string;

  @IsString()
  @IsNotEmpty({ message: "Informe o estado (UF)." })
  @Matches(/^[A-Z]{2}$/, { message: "Estado deve ser a sigla de 2 letras em maiúsculo (ex: MG)." })
  state!: string;

  @IsOptional()
  @IsString()
  website?: string;

  @IsOptional()
  @IsString()
  instagram?: string;
}
