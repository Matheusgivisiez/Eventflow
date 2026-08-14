import { ExecutionContext, HttpException, HttpStatus } from "@nestjs/common";
import { CustomThrottlerGuard } from "./custom-throttler.guard";

describe("CustomThrottlerGuard", () => {
  let guard: CustomThrottlerGuard;
  let mockReflector: any;
  let mockOptions: any;

  beforeEach(() => {
    mockReflector = {
      getAllAndOverride: jest.fn()
    };
    mockOptions = {
      throttlers: [{ name: "default", limit: 5, ttl: 60000 }],
      storage: {
        increment: jest.fn()
      }
    };
    guard = new CustomThrottlerGuard(mockOptions, mockOptions.storage, mockReflector);
  });

  it("deve ser definido", () => {
    expect(guard).toBeDefined();
  });

  describe("getTracker", () => {
    it("deve priorizar o ID do usuario autenticado se req.user existir", async () => {
      const req = { user: { id: "user-123" } };
      const tracker = await (guard as any).getTracker(req);
      expect(tracker).toBe("user:user-123");
    });

    it("deve utilizar o primeiro IP do x-forwarded-for caso usuario nao esteja autenticado", async () => {
      const req = { headers: { "x-forwarded-for": "203.0.113.195, 70.41.3.18" } };
      const tracker = await (guard as any).getTracker(req);
      expect(tracker).toBe("ip:203.0.113.195");
    });

    it("deve utilizar o x-real-ip quando fornecido e nao houver x-forwarded-for", async () => {
      const req = { headers: { "x-real-ip": "198.51.100.1" } };
      const tracker = await (guard as any).getTracker(req);
      expect(tracker).toBe("ip:198.51.100.1");
    });

    it("deve utilizar req.ip como fallback", async () => {
      const req = { ip: "127.0.0.1" };
      const tracker = await (guard as any).getTracker(req);
      expect(tracker).toBe("ip:127.0.0.1");
    });
  });

  describe("throwThrottlingException", () => {
    it("deve adicionar o header Retry-After e lancar HttpException com status 429 e mensagem padronizada", async () => {
      const setHeader = jest.fn();
      const mockContext = {
        switchToHttp: () => ({
          getResponse: () => ({ header: setHeader })
        })
      } as unknown as ExecutionContext;

      const detail = {
        limit: 5,
        ttl: 60000,
        key: "test-key",
        tracker: "ip:127.0.0.1",
        totalHits: 6,
        timeToExpire: 45000,
        isBlocked: true,
        timeToBlockExpire: 45000
      };

      try {
        await (guard as any).throwThrottlingException(mockContext, detail);
        fail("Deveria ter lancado uma excecao");
      } catch (err) {
        expect(err).toBeInstanceOf(HttpException);
        const httpErr = err as HttpException;
        expect(httpErr.getStatus()).toBe(HttpStatus.TOO_MANY_REQUESTS);
        expect(setHeader).toHaveBeenCalledWith("Retry-After", "45");
        const responseObj = httpErr.getResponse() as any;
        expect(responseObj.statusCode).toBe(429);
        expect(responseObj.message).toContain("Muitas requisições");
      }
    });
  });
});
