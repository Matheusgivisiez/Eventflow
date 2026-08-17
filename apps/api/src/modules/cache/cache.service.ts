import { Injectable, Logger, OnModuleDestroy } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import Redis from "ioredis";

@Injectable()
export class CacheService implements OnModuleDestroy {
  private static readonly MEMORY_CLEANUP_INTERVAL_MS = 60_000;
  private static readonly MAX_MEMORY_ENTRIES_BEFORE_CLEANUP = 10_000;

  private readonly logger = new Logger(CacheService.name);
  private readonly memory = new Map<string, { value: string; expiresAt: number }>();
  private readonly redis?: Redis;
  private lastMemoryCleanupAt = 0;
  private redisAvailable = true;

  constructor(config: ConfigService) {
    const url = config.get<string>("REDIS_URL");
    if (url) {
      this.redis = new Redis(url, { enableReadyCheck: false, lazyConnect: true, maxRetriesPerRequest: 1 });
      this.redis.connect().catch(() => this.logger.warn("Redis indisponivel. Usando cache em memoria."));
    }
  }

  async get<T>(key: string): Promise<T | null> {
    const value = this.isRedisReady() ? await this.withRedisFallback("get", () => this.redis!.get(key)) : this.getMemory(key);
    return value ? (JSON.parse(value) as T) : null;
  }

  async set(key: string, value: unknown, ttlSeconds = 60) {
    const serialized = JSON.stringify(value);
    if (this.isRedisReady()) {
      const stored = await this.withRedisFallback("set", () => this.redis!.set(key, serialized, "EX", ttlSeconds));
      if (stored) return;
    }
    this.pruneExpiredMemory();
    this.memory.set(key, { value: serialized, expiresAt: Date.now() + ttlSeconds * 1000 });
  }

  async del(key: string) {
    if (this.isRedisReady()) {
      await this.withRedisFallback("del", () => this.redis!.del(key));
    }
    this.memory.delete(key);
  }

  async delByPattern(pattern: string) {
    if (this.isRedisReady()) {
      await this.withRedisFallback("delByPattern", async () => {
        const stream = this.redis!.scanStream({ match: pattern, count: 100 });
        for await (const keys of stream) {
          if (keys.length > 0) {
            await this.redis!.del(...keys);
          }
        }
      });
    }
    this.pruneExpiredMemory(true);
    for (const key of this.memory.keys()) {
      if (key.includes(pattern.replace("*", ""))) {
        this.memory.delete(key);
      }
    }
  }

  async increment(key: string, ttlSeconds: number) {
    if (this.isRedisReady()) {
      const value = await this.withRedisFallback("increment", async () => {
        const total = await this.redis!.incr(key);
        if (total === 1) {
          await this.redis!.expire(key, ttlSeconds);
        }
        return total;
      });
      if (value !== null) {
        return value;
      }
    }

    this.pruneExpiredMemory();
    const current = Number(this.getMemory(key) ?? 0) + 1;
    this.memory.set(key, { value: String(current), expiresAt: Date.now() + ttlSeconds * 1000 });
    return current;
  }

  async incrementThrottle(key: string, ttlMs: number): Promise<{ totalHits: number; timeToExpire: number }> {
    const ttlSeconds = Math.max(1, Math.ceil(ttlMs / 1000));
    if (this.isRedisReady()) {
      const result = await this.withRedisFallback("incrementThrottle", async () => {
        const totalHits = await this.redis!.incr(key);
        if (totalHits === 1) {
          await this.redis!.expire(key, ttlSeconds);
        }
        const ttlSec = await this.redis!.ttl(key);
        const timeToExpire = ttlSec > 0 ? ttlSec * 1000 : ttlMs;
        return { totalHits, timeToExpire };
      });
      if (result) {
        return result;
      }
    }

    this.pruneExpiredMemory();
    const now = Date.now();
    const cached = this.memory.get(key);
    let totalHits = 1;
    let expiresAt = now + ttlMs;

    if (cached && cached.expiresAt > now) {
      totalHits = Number(cached.value) + 1;
      expiresAt = cached.expiresAt;
    }

    this.memory.set(key, { value: String(totalHits), expiresAt });
    return { totalHits, timeToExpire: Math.max(0, expiresAt - now) };
  }

  async onModuleDestroy() {
    await this.redis?.quit().catch(() => undefined);
  }

  private isRedisReady() {
    return this.redisAvailable && this.redis?.status === "ready";
  }

  private async withRedisFallback<T>(operation: string, action: () => Promise<T>): Promise<T | null> {
    try {
      return await action();
    } catch (error) {
      this.redisAvailable = false;
      const message = error instanceof Error ? error.message : String(error);
      this.logger.warn(`Redis falhou em ${operation}; usando cache em memoria. ${message}`);
      return null;
    }
  }

  private getMemory(key: string) {
    const cached = this.memory.get(key);
    if (!cached) return null;
    if (cached.expiresAt < Date.now()) {
      this.memory.delete(key);
      return null;
    }
    return cached.value;
  }

  private pruneExpiredMemory(force = false) {
    const now = Date.now();
    if (
      !force &&
      this.memory.size < CacheService.MAX_MEMORY_ENTRIES_BEFORE_CLEANUP &&
      now - this.lastMemoryCleanupAt < CacheService.MEMORY_CLEANUP_INTERVAL_MS
    ) {
      return;
    }

    this.lastMemoryCleanupAt = now;
    for (const [key, cached] of this.memory.entries()) {
      if (cached.expiresAt < now) {
        this.memory.delete(key);
      }
    }
  }
}
