import { Document } from "../document";

describe("Document", () => {
  it("should create valid CPF", () => {
    const doc = Document.create("529.982.247-25");
    expect(doc.getType()).toBe("CPF");
    expect(doc.isCpf()).toBe(true);
    expect(doc.formatted()).toBe("529.982.247-25");
  });

  it("should create valid CNPJ", () => {
    const doc = Document.create("11.444.444/0001-51");
    expect(doc.getType()).toBe("CNPJ");
    expect(doc.isCnpj()).toBe(true);
  });

  it("should reject invalid CPF", () => {
    expect(() => Document.create("111.111.111-11")).toThrow("Invalid CPF");
    expect(() => Document.create("123.456.789-00")).toThrow("Invalid CPF");
  });

  it("should reject invalid CNPJ", () => {
    expect(() => Document.create("11.111.111/1111-11")).toThrow("Invalid CNPJ");
  });

  it("should reject invalid length", () => {
    expect(() => Document.create("12345")).toThrow("Invalid document length");
  });

  it("should compare equality", () => {
    const a = Document.create("529.982.247-25");
    const b = Document.create("52998224725");
    expect(a.equals(b)).toBe(true);
  });
});
