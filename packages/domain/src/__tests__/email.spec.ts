import { Email } from "../email";

describe("Email", () => {
  it("should create a valid email", () => {
    const email = Email.create("Test@Example.com");
    expect(email.toString()).toBe("test@example.com");
  });

  it("should reject invalid email", () => {
    expect(() => Email.create("invalid")).toThrow("Invalid email");
    expect(() => Email.create("")).toThrow("Invalid email");
    expect(() => Email.create("test@")).toThrow("Invalid email");
  });

  it("should compare equality", () => {
    const a = Email.create("foo@bar.com");
    const b = Email.create("foo@bar.com");
    const c = Email.create("other@bar.com");
    expect(a.equals(b)).toBe(true);
    expect(a.equals(c)).toBe(false);
  });
});
