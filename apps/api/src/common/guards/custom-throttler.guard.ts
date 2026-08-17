import { ExecutionContext, HttpException, HttpStatus, Injectable } from "@nestjs/common";
import { ThrottlerGuard, ThrottlerLimitDetail, ThrottlerRequest } from "@nestjs/throttler";

@Injectable()
export class CustomThrottlerGuard extends ThrottlerGuard {
  private static readonly BYPASS_PATHS = new Set(["/health", "/api/health", "/metrics", "/api/metrics"]);

  protected async getTracker(req: Record<string, any>): Promise<string> {
    const user = req.user?.id || req.user?.sub;
    if (user) {
      return `user:${user}`;
    }

    const xForwardedFor = req.headers?.["x-forwarded-for"];
    if (xForwardedFor) {
      const firstIp = Array.isArray(xForwardedFor) ? xForwardedFor[0] : xForwardedFor.split(",")[0];
      if (firstIp && firstIp.trim()) {
        return `ip:${firstIp.trim()}`;
      }
    }

    const xRealIp = req.headers?.["x-real-ip"];
    if (xRealIp && typeof xRealIp === "string" && xRealIp.trim()) {
      return `ip:${xRealIp.trim()}`;
    }

    const remoteAddress = req.ip || req.socket?.remoteAddress || "unknown";
    return `ip:${remoteAddress}`;
  }

  protected async handleRequest(requestProps: ThrottlerRequest): Promise<boolean> {
    const { context, limit, ttl, throttler, blockDuration, getTracker } = requestProps;
    const req = context.switchToHttp().getRequest();
    if (CustomThrottlerGuard.BYPASS_PATHS.has(req.path) || CustomThrottlerGuard.BYPASS_PATHS.has(req.url)) {
      return true;
    }

    const res = context.switchToHttp().getResponse();
    const tracker = await getTracker(req, context);
    const throttlerName = throttler.name ?? "default";
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
