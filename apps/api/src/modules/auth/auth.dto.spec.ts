import { plainToInstance } from "class-transformer";
import { validate } from "class-validator";
import { BecomeOrganizerDto } from "./dto/become-organizer.dto";
import { RegisterDto } from "./dto/register.dto";
import { RegisterOrganizerDto } from "./dto/register-organizer.dto";

describe("Auth DTO validation", () => {
  it("normalizes and accepts formatted customer phone and CPF", async () => {
    const dto = plainToInstance(RegisterDto, {
      name: "Cliente Teste",
      email: "cliente@example.com",
      password: "senha-segura",
      phone: "(11) 99999-9999",
      cpf: "123.456.789-09"
    });

    await expect(validate(dto)).resolves.toHaveLength(0);
    expect(dto.phone).toBe("11999999999");
    expect(dto.cpf).toBe("12345678909");
  });

  it("rejects dirty customer CPF and phone values", async () => {
    const dto = plainToInstance(RegisterDto, {
      name: "Cliente Teste",
      email: "cliente@example.com",
      password: "senha-segura",
      phone: "aaa",
      cpf: "123"
    });

    const errors = await validate(dto);

    expect(errors.map((error) => error.property)).toEqual(expect.arrayContaining(["phone", "cpf"]));
  });

  it("normalizes lowercase UF and formatted CNPJ before organizer validation", async () => {
    const dto = plainToInstance(RegisterOrganizerDto, {
      name: "Organizador Teste",
      email: "org@example.com",
      password: "senha-segura",
      phone: "(31) 99999-9999",
      cnpj: "12.345.678/0001-90",
      companyName: "Eventos SA",
      city: "Belo Horizonte",
      state: "mg"
    });

    await expect(validate(dto)).resolves.toHaveLength(0);
    expect(dto.cnpj).toBe("12345678000190");
    expect(dto.state).toBe("MG");
  });

  it("normalizes lowercase UF in become-organizer payloads", async () => {
    const dto = plainToInstance(BecomeOrganizerDto, {
      cnpj: "12.345.678/0001-90",
      companyName: "Eventos SA",
      city: "Belo Horizonte",
      state: "mg"
    });

    await expect(validate(dto)).resolves.toHaveLength(0);
    expect(dto.cnpj).toBe("12345678000190");
    expect(dto.state).toBe("MG");
  });
});
