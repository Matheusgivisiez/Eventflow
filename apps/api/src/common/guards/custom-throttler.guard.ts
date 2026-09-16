import { ExecutionContext, HttpException, HttpStatus, Injectable } from "@nestjs/common";
import { ThrottlerGuard, ThrottlerLimitDetail, ThrottlerRequest } from "@nestjs/throttler";
import { createHash } from "crypto";

@Injectable()
export class CustomThrottlerGuard extends ThrottlerGuard {
  private static readonly BYPASS_PATHS = new Set(["/health", "/api/health", "/metrics", "/api/metrics"]);

  /**
   * The tracker decides which bucket a request counts against. It must never
   * be something the caller can pick for free, or every limit below becomes
   * "one request per invented value" instead of "N requests per client".
   *
   * `req.user` is only trusted here because it is set by JwtAuthGuard AFTER
   * the token's signature is verified. Nothing in this method may decode an
   * Authorization header itself: a JWT's payload is base64, not signed
   * verification, so trusting an unverified `sub` lets anyone mint a fresh
   * bucket on every request by changing that one field.
   *
   * The IP comes only from `req.ip`, which Express derives from
   * `app.set("trust proxy", N)` in main.ts. Reading `X-Forwarded-For` or
   * `X-Real-Ip` directly here would trust a header the client itself sends,
   * which defeats the limiter the same way an unverified JWT does.
   */
  protected async getTracker(req: Record<string, any>): Promise<string> {
    const path = req.path || req.url || "";
    const ip = this.trackerIp(req);

    if (path.endsWith("/auth/forgot-password") && typeof req.body?.email === "string") {
      return `forgot-password:${ip}:${this.hashTrackerValue(req.body.email.toLowerCase().trim())}`;
    }

    // Login is throttled per e-mail as well as per IP, so a distributed
    // credential-stuffing run against one account is still capped even when
    // it comes from many IPs.
    if (path.endsWith("/auth/login") && typeof req.body?.email === "string") {
      return `login:${this.hashTrackerValue(req.body.email.toLowerCase().trim())}`;
    }

    const user = req.user?.id || req.user?.sub;
    if (user) {
      return `user:${user}`;
    }

    return `ip:${ip}`;
  }

  private trackerIp(req: Record<string, any>) {
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
