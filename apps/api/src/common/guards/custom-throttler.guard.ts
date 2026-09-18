import { ExecutionContext, HttpException, HttpStatus, Injectable } from "@nestjs/common";
import { ThrottlerGuard, ThrottlerLimitDetail, ThrottlerRequest } from "@nestjs/throttler";
import { createHash, createHmac, timingSafeEqual } from "crypto";

@Injectable()
export class CustomThrottlerGuard extends ThrottlerGuard {
  private static readonly BYPASS_PATHS = new Set(["/health", "/api/health", "/metrics", "/api/metrics"]);

  /**
   * A chave do contador nunca pode ser algo que o cliente escolhe livremente.
   *
   * 1. Rotas de credencial sao limitadas pelo ALVO (e-mail da conta, token de
   *    reset). Trocar de IP, de proxy ou de token nao abre um balde novo, entao
   *    forca bruta contra uma conta continua limitada.
   * 2. Um usuario so e identificado por um token com ASSINATURA VALIDA. Ler o
   *    `sub` de um JWT nao verificado permitia enviar um sub aleatorio por
   *    requisicao e zerar o contador a cada tentativa.
   * 3. O IP e o ultimo recurso: `x-forwarded-for` e escrito pelo cliente e
   *    nenhuma rota sensivel depende so dele.
   */
  protected async getTracker(req: Record<string, any>): Promise<string> {
    const path: string = req.path || req.url || "";

    const credentialTracker = this.credentialTracker(path, req.body);
    if (credentialTracker) {
      return credentialTracker;
    }

    const userId = req.user?.id ?? req.user?.sub ?? this.verifiedSubject(req.headers?.authorization);
    if (userId) {
      return `user:${userId}`;
    }

    return `ip:${this.trackerIp(req)}`;
  }

  /**
   * Limite por alvo nas rotas que manipulam credenciais. O valor bruto nunca
   * entra na chave (ela vai para o Redis e para logs), so o hash.
   */
  private credentialTracker(path: string, body: unknown): string | undefined {
    const payload = (body ?? {}) as Record<string, unknown>;
    const email = typeof payload.email === "string" ? payload.email.trim().toLowerCase() : undefined;
    const token = typeof payload.token === "string" ? payload.token.trim() : undefined;

    if (email && path.endsWith("/auth/login")) {
      return `login:${this.hashTrackerValue(email)}`;
    }
    if (email && path.endsWith("/auth/forgot-password")) {
      return `forgot-password:${this.hashTrackerValue(email)}`;
    }
    if (email && path.endsWith("/auth/resend-verification")) {
      return `resend-verification:${this.hashTrackerValue(email)}`;
    }
    if (token && path.endsWith("/auth/reset-password")) {
      return `reset-password:${this.hashTrackerValue(token)}`;
    }

    return undefined;
  }

  /**
   * Devolve o `sub` apenas quando a assinatura HS256 do token confere com
   * JWT_ACCESS_SECRET e o token nao expirou. Qualquer outra coisa e tratada
   * como requisicao anonima.
   */
  private verifiedSubject(authorization: unknown): string | undefined {
    if (typeof authorization !== "string" || !authorization.startsWith("Bearer ")) {
      return undefined;
    }

    const secret = process.env.JWT_ACCESS_SECRET;
    if (!secret) {
      return undefined;
    }

    const parts = authorization.slice(7).trim().split(".");
    if (parts.length !== 3) {
      return undefined;
    }

    try {
      const header = JSON.parse(Buffer.from(parts[0], "base64url").toString("utf8")) as { alg?: string };
      if (header?.alg !== "HS256") {
        return undefined;
      }

      const expected = createHmac("sha256", secret).update(`${parts[0]}.${parts[1]}`).digest();
      const received = Buffer.from(parts[2], "base64url");
      if (expected.length !== received.length || !timingSafeEqual(expected, received)) {
        return undefined;
      }

      const payload = JSON.parse(Buffer.from(parts[1], "base64url").toString("utf8")) as {
        sub?: unknown;
        exp?: unknown;
      };
      if (typeof payload?.exp === "number" && payload.exp * 1000 <= Date.now()) {
        return undefined;
      }

      return typeof payload?.sub === "string" && payload.sub ? payload.sub : undefined;
    } catch {
      return undefined;
    }
  }

  private trackerIp(req: Record<string, any>) {
    const xForwardedFor = req.headers?.["x-forwarded-for"];
    if (xForwardedFor) {
      const firstIp = Array.isArray(xForwardedFor) ? xForwardedFor[0] : xForwardedFor.split(",")[0];
      if (firstIp && firstIp.trim()) {
        return firstIp.trim();
      }
    }

    const xRealIp = req.headers?.["x-real-ip"];
    if (xRealIp && typeof xRealIp === "string" && xRealIp.trim()) {
      return xRealIp.trim();
    }

    return req.ip || req.socket?.remoteAddress || "unknown";
  }

  private hashTrackerValue(value: string) {
    return createHash("sha256").update(value).digest("hex").slice(0, 16);
  }

  protected async handleRequest(requestProps: ThrottlerRequest): Promise<boolean> {
    const { context, limit, ttl, throttler, blockDuration, getTracker } = requestProps;
    const req = context.switchToHttp().getRequest();
    if (CustomThrottlerGuard.BYPASS_PATHS.has(req.path) || CustomThrottlerGuard.BYPASS_PATHS.has(req.url)) {
      return true;
    }

    const throttlerName = throttler.name ?? "default";

    // Named throttlers (auth, checkout, sensitive) must only apply to routes
    // explicitly decorated with them, not to every generic route.
    if (throttlerName !== "default") {
      const routeOrClassLimit = this.reflector.getAllAndOverride(
        `THROTTLER:LIMIT${throttlerName}`,
        [context.getHandler(), context.getClass()]
      );
      if (routeOrClassLimit === undefined) {
        return true;
      }
    }

    const res = context.switchToHttp().getResponse();
    const tracker = await getTracker(req, context);
    const key = this.generateKey(context, tracker, throttlerName);

    const { totalHits, timeToExpire } = await this.storageService.increment(
      key,
      ttl,
      limit,
      blockDuration,
      throttlerName
    );

    const remaining = Math.max(0, limit - totalHits);
    const timeToExpireSeconds = Math.max(1, Math.ceil(timeToExpire / 1000));

    if (res && typeof res.header === "function") {
      res.header("X-RateLimit-Limit", String(limit));
      res.header("X-RateLimit-Remaining", String(remaining));
      res.header("X-RateLimit-Reset", String(Math.ceil(Date.now() / 1000) + timeToExpireSeconds));
    }

    if (totalHits > limit) {
      if (res && typeof res.header === "function") {
        res.header("Retry-After", String(timeToExpireSeconds));
      }
      await this.throwThrottlingException(context, {
        limit,
        ttl,
        key,
        tracker,
        totalHits,
        timeToExpire,
        isBlocked: true,
        timeToBlockExpire: timeToExpire
      });
    }

    return true;
  }

  protected async throwThrottlingException(
    context: ExecutionContext,
    throttlerLimitDetail: ThrottlerLimitDetail
  ): Promise<void> {
    const res = context.switchToHttp().getResponse();
    const timeToExpireSeconds = Math.max(1, Math.ceil(throttlerLimitDetail.timeToExpire / 1000));
    if (res && typeof res.header === "function") {
      res.header("Retry-After", String(timeToExpireSeconds));
      res.header("X-RateLimit-Limit", String(throttlerLimitDetail.limit));
      res.header("X-RateLimit-Remaining", "0");
      res.header("X-RateLimit-Reset", String(Math.ceil(Date.now() / 1000) + timeToExpireSeconds));
    }

    throw new HttpException(
      {
        statusCode: HttpStatus.TOO_MANY_REQUESTS,
        message: "Muitas requisições. Por favor, aguarde antes de tentar novamente.",
        error: "Too Many Requests"
      },
      HttpStatus.TOO_MANY_REQUESTS
    );
  }
}
