export type DocumentType = "CPF" | "CNPJ";

export class Document {
  private constructor(
    private readonly value: string,
    private readonly type: DocumentType
  ) {
    Object.freeze(this);
  }

  static create(value: string): Document {
    const digits = value.replace(/\D/g, "");
    if (digits.length === 11) {
      return Document.cpf(digits);
    }
    if (digits.length === 14) {
      return Document.cnpj(digits);
    }
    throw new Error(`Invalid document length: ${digits.length}. Expected 11 (CPF) or 14 (CNPJ).`);
  }

  static cpf(digits: string): Document {
    if (!Document.isValidCpf(digits)) {
      throw new Error(`Invalid CPF: ${digits}`);
    }
    return new Document(digits, "CPF");
  }

  static cnpj(digits: string): Document {
    if (!Document.isValidCnpj(digits)) {
      throw new Error(`Invalid CNPJ: ${digits}`);
    }
    return new Document(digits, "CNPJ");
  }

  getValue(): string {
    return this.value;
  }

  getType(): DocumentType {
    return this.type;
  }

  isCpf(): boolean {
    return this.type === "CPF";
  }

  isCnpj(): boolean {
    return this.type === "CNPJ";
  }

  formatted(): string {
    if (this.type === "CPF") {
      return this.value.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
    }
    return this.value.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, "$1.$2.$3/$4-$5");
  }

  equals(other: Document): boolean {
    return this.value === other.value && this.type === other.type;
  }

  toString(): string {
    return this.formatted();
  }

  private static isValidCpf(cpf: string): boolean {
    if (cpf.length !== 11 || /^(\d)\1{10}$/.test(cpf)) return false;
    const calc = (digits: string, factor: number) =>
      digits
        .slice(0, factor - 1)
        .split("")
        .reduce((sum, digit, index) => sum + Number(digit) * (factor - index), 0);
    const rest = (sum: number) => (sum * 10) % 11;
    const first = rest(calc(cpf, 10));
    if (first !== Number(cpf[9])) return false;
    const second = rest(calc(cpf, 11));
    return second === Number(cpf[10]);
  }

  private static isValidCnpj(cnpj: string): boolean {
    if (cnpj.length !== 14 || /^(\d)\1{13}$/.test(cnpj)) return false;
    const calc = (digits: string, multipliers: number[]) =>
      digits
        .slice(0, multipliers.length)
        .split("")
        .reduce((sum, digit, index) => sum + Number(digit) * multipliers[index], 0);
    const first = calc(cnpj, [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]) % 11;
    if ((first < 2 ? 0 : 11 - first) !== Number(cnpj[12])) return false;
    const second = calc(cnpj, [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]) % 11;
    return (second < 2 ? 0 : 11 - second) === Number(cnpj[13]);
  }
}
