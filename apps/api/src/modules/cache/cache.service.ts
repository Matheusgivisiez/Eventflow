import { Injectable, Logger, OnModuleDestroy } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import Redis from "ioredis";

@Injectable()
export class CacheService implements OnModuleDestroy {
  private readonly logger = new Logger(CacheService.name);
  private readonly memory = new Map<string, { value: string; expiresAt: number }>();
  private readonly redis?: Redis;

  constructor(config: ConfigService) {
    const url = config.get<string>("REDIS_URL");
    if (url) {
      this.redis = new Redis(url, { lazyConnect: true, maxRetriesPerRequest: 1 });
      this.redis.connect().catch(() => this.logger.warn("Redis indisponivel. Usando cache em memoria."));
    }
  }

  async get<T>(key: string): Promise<T | null> {
    const value = this.redis?.status === "ready" ? await this.redis.get(key) : this.getMemory(key);
    return value ? (JSON.parse(value) as T) : null;
  }

  async set(key: string, value: unknown, ttlSeconds = 60) {
    const serialized = JSON.stringify(value);
    if (this.redis?.status === "ready") {
      await this.redis.set(key, serialized, "EX", ttlSeconds);
      return;
    }
    this.memory.set(key, { value: serialized, expiresAt: Date.now() + ttlSeconds * 1000 });
  }

  async del(key: string) {
    if (this.redis?.status === "ready") {
      await this.redis.del(key);
    }
    this.memory.delete(key);
  }

  async delByPattern(pattern: string) {
    if (this.redis?.status === "ready") {
      const stream = this.redis.scanStream({ match: pattern, count: 100 });
      for await (const keys of stream) {
        if (keys.length > 0) {
          await this.redis.del(...keys);
        }
      }
    }
    for (const key of this.memory.keys()) {
      if (key.includes(pattern.replace("*", ""))) {
        this.memory.delete(key);
      }
    }
  }

  async increment(key: string, ttlSeconds: number) {
    if (this.redis?.status === "ready") {
      const value = await this.redis.incr(key);
      if (value === 1) {
        await this.redis.expire(key, ttlSeconds);
      }
      return value;
    }

    const current = Number(this.getMemory(key) ?? 0) + 1;
    this.memory.set(key, { value: String(current), expiresAt: Date.now() + ttlSeconds * 1000 });
    return current;
  }

  async onModuleDestroy() {
    await this.redis?.quit().catch(() => undefined);
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
}
