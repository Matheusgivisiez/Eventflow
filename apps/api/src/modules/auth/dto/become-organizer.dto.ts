import { IsNotEmpty, IsOptional, IsString, Matches } from "class-validator";

export class BecomeOrganizerDto {
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
