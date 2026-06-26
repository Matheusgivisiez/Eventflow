export class Money {
  private constructor(private readonly cents: number) {
    if (!Number.isInteger(cents)) {
      throw new Error(`Money must be an integer amount in cents: ${cents}`);
    }
    Object.freeze(this);
  }

  static fromCents(cents: number): Money {
    return new Money(cents);
  }

  static fromReal(value: number): Money {
    const cents = Math.round(value * 100);
    return new Money(cents);
  }

  getCents(): number {
    return this.cents;
  }

  toReal(): number {
    return this.cents / 100;
  }

  add(other: Money): Money {
    return new Money(this.cents + other.cents);
  }

  subtract(other: Money): Money {
    return new Money(this.cents - other.cents);
  }

  multiply(factor: number): Money {
    return new Money(Math.round(this.cents * factor));
  }

  equals(other: Money): boolean {
    return this.cents === other.cents;
  }

  toString(): string {
    const formatted = (this.cents / 100).toFixed(2);
    return `R$ ${formatted}`;
  }
}
