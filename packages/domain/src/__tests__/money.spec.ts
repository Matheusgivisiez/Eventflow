import { Money } from "../money";

describe("Money", () => {
  it("should create from cents", () => {
    const money = Money.fromCents(10050);
    expect(money.getCents()).toBe(10050);
    expect(money.toReal()).toBe(100.5);
    expect(money.toString()).toBe("R$ 100,50");
  });

  it("should create from real", () => {
    const money = Money.fromReal(99.99);
    expect(money.getCents()).toBe(9999);
  });

  it("should add", () => {
    const a = Money.fromCents(1000);
    const b = Money.fromCents(2000);
    expect(a.add(b).getCents()).toBe(3000);
  });

  it("should subtract", () => {
    const a = Money.fromCents(3000);
    const b = Money.fromCents(500);
    expect(a.subtract(b).getCents()).toBe(2500);
  });

  it("should multiply", () => {
    const a = Money.fromCents(1000);
    expect(a.multiply(3).getCents()).toBe(3000);
    expect(a.multiply(0.5).getCents()).toBe(500);
  });

  it("should reject non-integer cents", () => {
    expect(() => Money.fromCents(10.5)).toThrow("Money must be an integer amount in cents");
  });
});
