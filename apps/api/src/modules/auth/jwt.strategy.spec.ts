import { UnauthorizedException } from "@nestjs/common";
import { UserRole } from "@prisma/client";
import { JwtStrategy } from "./jwt.strategy";

function createStrategy() {
  const config = { getOrThrow: jest.fn().mockReturnValue("test-secret") };
  const prisma = {
    user: {
      findUnique: jest.fn()
    }
  };
  const strategy = new JwtStrategy(config as any, prisma as any);
  return { strategy, prisma };
}

describe("JwtStrategy", () => {
  it("accepts tokens with the current user token version", async () => {
    const { strategy, prisma } = createStrategy();
    prisma.user.findUnique.mockResolvedValue({
      id: "user-1",
      tenantId: "tenant-1",
      email: "user@example.com",
      role: UserRole.CUSTOMER,
      tokenVersion: 2
    });

    await expect(strategy.validate({ sub: "user-1", tokenVersion: 2 })).resolves.toEqual({
      id: "user-1",
      tenantId: "tenant-1",
      email: "user@example.com",
      role: UserRole.CUSTOMER
    });
  });

  it("rejects access tokens issued before a password reset", async () => {
    const { strategy, prisma } = createStrategy();
    prisma.user.findUnique.mockResolvedValue({
      id: "user-1",
      tenantId: null,
      email: "user@example.com",
      role: UserRole.CUSTOMER,
      tokenVersion: 3
    });

    await expect(strategy.validate({ sub: "user-1", tokenVersion: 2 })).rejects.toThrow(UnauthorizedException);
  });
});
