import { UserRole } from "@prisma/client";
import { resolveClaimEmail } from "./claim-email.utils";

describe("resolveClaimEmail", () => {
  const base = { id: "user-1", tenantId: null, role: UserRole.CUSTOMER };

  it("returns the normalized e-mail for a verified account", () => {
    expect(resolveClaimEmail({ ...base, email: "Buyer@Example.COM", emailVerified: true })).toBe(
      "buyer@example.com"
    );
  });

  it("returns null for an unverified account so nothing can be claimed by e-mail", () => {
    expect(resolveClaimEmail({ ...base, email: "buyer@example.com", emailVerified: false })).toBeNull();
  });
});
