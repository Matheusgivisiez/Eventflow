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

    it("NUNCA deve confiar em um JWT nao verificado no header authorization: um sub forjado deve cair no IP, nao virar uma chave nova a cada requisicao", async () => {
      const payload = Buffer.from(JSON.stringify({ sub: "user-from-jwt-456" })).toString("base64url");
      const forgedJwt = `header.${payload}.signature-nao-verificada`;
      const req = { ip: "203.0.113.195", headers: { authorization: `Bearer ${forgedJwt}` } };
      const tracker = await (guard as any).getTracker(req);
      expect(tracker).toBe("ip:203.0.113.195");
      expect(tracker).not.toContain("user-from-jwt-456");
    });

    it("NUNCA deve confiar no x-forwarded-for enviado pelo cliente: so req.ip (resolvido pelo trust proxy do Express) conta", async () => {
      const req = {
        ip: "70.41.3.18",
        headers: { "x-forwarded-for": "1.2.3.4, 70.41.3.18" }
      };
      const tracker = await (guard as any).getTracker(req);
      expect(tracker).toBe("ip:70.41.3.18");
      expect(tracker).not.toContain("1.2.3.4");
    });

    it("deve limitar recuperacao de senha por IP e hash do e-mail, sem usar o e-mail cru", async () => {
      const req = {
        path: "/api/auth/forgot-password",
        ip: "203.0.113.195",
        body: { email: "Buyer@Example.COM " }
      };
      const tracker = await (guard as any).getTracker(req);
      expect(tracker).toMatch(/^forgot-password:203\.0\.113\.195:[a-f0-9]{16}$/);
      expect(tracker).not.toContain("Buyer@Example.COM");
      expect(tracker).not.toContain("buyer@example.com");
    });

    it("deve limitar login por hash do e-mail, para que trocar de IP nao reinicie a contagem de tentativas contra a mesma conta", async () => {
      const req = {
        path: "/api/auth/login",
        ip: "203.0.113.195",
        body: { email: "Buyer@Example.COM" }
      };
      const tracker = await (guard as any).getTracker(req);
      expect(tracker).toMatch(/^login:[a-f0-9]{16}$/);
      expect(tracker).not.toContain("Buyer@Example.COM");

      const otherIp = { ...req, ip: "198.51.100.9" };
      const trackerFromOtherIp = await (guard as any).getTracker(otherIp);
      expect(trackerFromOtherIp).toBe(tracker);
    });

    it("deve utilizar req.ip como fallback quando nao ha usuario nem rota especial", async () => {
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
