import { ExecutionContext, HttpException, HttpStatus } from "@nestjs/common";
import { createHmac } from "crypto";
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
    const ACCESS_SECRET = "test-access-secret-with-32-characters";

    function signedJwt(payload: Record<string, unknown>, secret = ACCESS_SECRET) {
      const header = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url");
      const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
      const signature = createHmac("sha256", secret).update(`${header}.${body}`).digest("base64url");
      return `${header}.${body}.${signature}`;
    }

    beforeEach(() => {
      process.env.JWT_ACCESS_SECRET = ACCESS_SECRET;
    });

    it("deve priorizar o ID do usuario autenticado se req.user existir", async () => {
      const req = { user: { id: "user-123" } };
      const tracker = await (guard as any).getTracker(req);
      expect(tracker).toBe("user:user-123");
    });

    it("deve aceitar o sub de um Bearer token com assinatura valida", async () => {
      const token = signedJwt({ sub: "user-from-jwt-456", exp: Math.floor(Date.now() / 1000) + 900 });
      const req = { headers: { authorization: `Bearer ${token}` } };
      const tracker = await (guard as any).getTracker(req);
      expect(tracker).toBe("user:user-from-jwt-456");
    });

    it("deve ignorar um Bearer token sem assinatura valida e cair no IP", async () => {
      const payload = Buffer.from(JSON.stringify({ sub: "sub-forjado" })).toString("base64url");
      const req = {
        headers: {
          authorization: `Bearer header.${payload}.assinatura-invalida`,
          "x-forwarded-for": "203.0.113.195"
        }
      };
      const tracker = await (guard as any).getTracker(req);
      expect(tracker).toBe("ip:203.0.113.195");
      expect(tracker).not.toContain("sub-forjado");
    });

    it("deve ignorar um token assinado com outro segredo", async () => {
      const token = signedJwt({ sub: "sub-de-outro-segredo" }, "segredo-errado-com-32-caracteres-ok");
      const req = { headers: { authorization: `Bearer ${token}` }, ip: "127.0.0.1" };
      const tracker = await (guard as any).getTracker(req);
      expect(tracker).toBe("ip:127.0.0.1");
    });

    it("deve ignorar um token expirado", async () => {
      const token = signedJwt({ sub: "user-expirado", exp: Math.floor(Date.now() / 1000) - 10 });
      const req = { headers: { authorization: `Bearer ${token}` }, ip: "127.0.0.1" };
      const tracker = await (guard as any).getTracker(req);
      expect(tracker).toBe("ip:127.0.0.1");
    });

    it("deve utilizar o primeiro IP do x-forwarded-for caso usuario nao esteja autenticado", async () => {
      const req = { headers: { "x-forwarded-for": "203.0.113.195, 70.41.3.18" } };
      const tracker = await (guard as any).getTracker(req);
      expect(tracker).toBe("ip:203.0.113.195");
    });

    it("deve limitar o login pelo hash do e-mail alvo, sem depender do IP", async () => {
      const base = { path: "/api/auth/login", body: { email: "Buyer@Example.COM " } };
      const first = await (guard as any).getTracker({ ...base, headers: { "x-forwarded-for": "203.0.113.195" } });
      const second = await (guard as any).getTracker({ ...base, headers: { "x-forwarded-for": "198.51.100.7" } });

      expect(first).toMatch(/^login:[a-f0-9]{16}$/);
      expect(first).toBe(second);
      expect(first).not.toContain("Buyer@Example.COM");
      expect(first).not.toContain("buyer@example.com");
    });

    it("deve limitar a recuperacao de senha pelo hash do e-mail, sem depender do IP", async () => {
      const req = {
        path: "/api/auth/forgot-password",
        headers: { "x-forwarded-for": "203.0.113.195, 70.41.3.18" },
        body: { email: "Buyer@Example.COM " }
      };
      const tracker = await (guard as any).getTracker(req);
      expect(tracker).toMatch(/^forgot-password:[a-f0-9]{16}$/);
      expect(tracker).not.toContain("buyer@example.com");
    });

    it("deve limitar o reset de senha pelo hash do token", async () => {
      const req = { path: "/api/auth/reset-password", body: { token: "token-secreto", password: "12345678" } };
      const tracker = await (guard as any).getTracker(req);
      expect(tracker).toMatch(/^reset-password:[a-f0-9]{16}$/);
      expect(tracker).not.toContain("token-secreto");
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

  describe("handleRequest", () => {
    it("deve ignorar rate limit para health check", async () => {
      const mockContext = {
        switchToHttp: () => ({
          getRequest: () => ({ path: "/api/health", url: "/api/health" }),
          getResponse: () => ({ header: jest.fn() })
        })
      } as unknown as ExecutionContext;

      const result = await (guard as any).handleRequest({
        context: mockContext,
        limit: 5,
        ttl: 60000,
        throttler: { name: "default" },
        blockDuration: 0,
        getTracker: jest.fn()
      });

      expect(result).toBe(true);
      expect(mockOptions.storage.increment).not.toHaveBeenCalled();
    });

    it("deve ignorar named throttler se a rota nao foi decorada para ele", async () => {
      mockReflector.getAllAndOverride.mockReturnValue(undefined);
      const mockContext = {
        getHandler: () => ({}),
        getClass: () => ({}),
        switchToHttp: () => ({
          getRequest: () => ({ path: "/api/buyer/tickets", url: "/api/buyer/tickets" }),
          getResponse: () => ({ header: jest.fn() })
        })
      } as unknown as ExecutionContext;

      const result = await (guard as any).handleRequest({
        context: mockContext,
        limit: 10,
        ttl: 60000,
        throttler: { name: "auth" },
        blockDuration: 0,
        getTracker: jest.fn()
      });

      expect(result).toBe(true);
      expect(mockOptions.storage.increment).not.toHaveBeenCalled();
    });

    it("deve executar named throttler se a rota foi decorada para ele", async () => {
      mockReflector.getAllAndOverride.mockReturnValue(10);
      mockOptions.storage.increment.mockResolvedValue({ totalHits: 1, timeToExpire: 60000 });
      const mockContext = {
        getHandler: () => ({}),
        getClass: () => ({}),
        switchToHttp: () => ({
          getRequest: () => ({ path: "/api/auth/login", url: "/api/auth/login" }),
          getResponse: () => ({ header: jest.fn() })
        })
      } as unknown as ExecutionContext;

      const result = await (guard as any).handleRequest({
        context: mockContext,
        limit: 10,
        ttl: 60000,
        throttler: { name: "auth" },
        blockDuration: 0,
        getTracker: jest.fn().mockResolvedValue("ip:127.0.0.1")
      });

      expect(result).toBe(true);
      expect(mockOptions.storage.increment).toHaveBeenCalled();
    });
  });
});
