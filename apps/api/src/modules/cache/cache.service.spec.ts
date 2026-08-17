import { CacheService } from "./cache.service";

function createConfig(redisUrl?: string) {
  return {
    get: jest.fn((key: string) => (key === "REDIS_URL" ? redisUrl : undefined))
  };
}

describe("CacheService", () => {
  it("falls back to memory when Redis denies INCR for throttling", async () => {
    const cache = new CacheService(createConfig() as any);
    const redis = {
      status: "ready",
      incr: jest.fn().mockRejectedValue(new Error("NOPERM this user has no permissions to run the 'incr' command")),
      expire: jest.fn(),
      ttl: jest.fn(),
      quit: jest.fn()
    };
    (cache as any).redis = redis;

    await expect(cache.incrementThrottle("auth:test", 60000)).resolves.toEqual({
      totalHits: 1,
      timeToExpire: expect.any(Number)
    });
    await expect(cache.incrementThrottle("auth:test", 60000)).resolves.toEqual({
      totalHits: 2,
      timeToExpire: expect.any(Number)
    });

    expect(redis.incr).toHaveBeenCalledTimes(1);
  });
});
