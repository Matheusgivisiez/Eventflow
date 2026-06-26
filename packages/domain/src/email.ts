export class Email {
  private constructor(private readonly value: string) {
    Object.freeze(this);
  }

  static create(email: string): Email {
    const sanitized = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(sanitized)) {
      throw new Error(`Invalid email: ${email}`);
    }
    return new Email(sanitized);
  }

  toString(): string {
    return this.value;
  }

  equals(other: Email): boolean {
    return this.value === other.value;
  }
}
