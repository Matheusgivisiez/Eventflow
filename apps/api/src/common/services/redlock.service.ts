import { Injectable, Logger, OnModuleDestroy } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import Redis from "ioredis";

@Injectable()
export class RedlockService implements OnModuleDestroy {
  private readonly logger = new Logger(RedlockService.name);
  private readonly redis: Redis;
  private redisAvailable = true;

  constructor(config: ConfigService) {
    this.redis = new Redis(config.get<string>("REDIS_URL") ?? "redis://localhost:6379", {
      enableReadyCheck: false,
      lazyConnect: true,
      maxRetriesPerRequest: 3,
      retryStrategy: (times) => Math.min(times * 50, 2000)
    });
    this.redis.connect().catch(() => this.logger.warn("Redis indisponivel para Redlock."));
  }

  async acquire(resource: string, ttlMs: number): Promise<string | null> {
    if (!this.isRedisReady()) return null;

    const token = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const key = `lock:${resource}`;
    const result = await this.withRedisFallback("acquire", () => this.redis.set(key, token, "PX", ttlMs, "NX"));
    return result === "OK" ? token : null;
  }

  async release(resource: string, token: string): Promise<boolean> {
    if (!this.isRedisReady()) return false;

    const key = `lock:${resource}`;
    const script = `
      if redis.call("get", KEYS[1]) == ARGV[1] then
        return redis.call("del", KEYS[1])
      else
        return 0
      end
    `;
    const result = await this.withRedisFallback("release", () => this.redis.eval(script, 1, key, token));
    return result === 1;
  }

  async extend(resource: string, token: string, ttlMs: number): Promise<boolean> {
    if (!this.isRedisReady()) return false;

    const key = `lock:${resource}`;
    const script = `
      if redis.call("get", KEYS[1]) == ARGV[1] then
        return redis.call("pexpire", KEYS[1], ARGV[2])
      else
        return 0
      end
    `;
    const result = await this.withRedisFallback("extend", () => this.redis.eval(script, 1, key, token, String(ttlMs)));
    return result === 1;
  }

  async withLock<T>(resource: string, ttlMs: number, fn: () => Promise<T>): Promise<T> {
    const token = await this.acquire(resource, ttlMs);
    if (!token) {
      this.logger.warn(`Redlock indisponivel para ${resource}; executando sem lock distribuido.`);
      return fn();
    }
    try {
      return await fn();
    } finally {
      await this.release(resource, token).catch(() => undefined);
    }
  }

  async onModuleDestroy() {
    await this.redis.quit().catch(() => undefined);
  }

  private isRedisReady() {
    return this.redisAvailable && this.redis.status === "ready";
  }

  private async withRedisFallback<T>(operation: string, action: () => Promise<T>): Promise<T | null> {
    try {
      return await action();
    } catch (error) {
      this.redisAvailable = false;
      const message = error instanceof Error ? error.message : String(error);
      this.logger.warn(`Redis falhou em Redlock ${operation}; locks distribuidos desativados. ${message}`);
      return null;
    }
  }
}
