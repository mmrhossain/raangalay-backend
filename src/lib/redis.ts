import Redis from "ioredis";
import { env } from "../config/env.ts";
import { logger } from "../common/utils/logger.ts";

const globalForRedis = globalThis as unknown as {
  redis: Redis | null | undefined;
};

function isRedisUrl(value: string): boolean {
  return value.startsWith("redis://") || value.startsWith("rediss://");
}

function createRedisClient(): Redis | null {
  const url = env.REDIS_URL;

  if (!url || !isRedisUrl(url)) {
    if (url) {
      logger.warn("REDIS_URL is not a redis:// or rediss:// URL; Redis disabled");
    }
    return null;
  }

  try {
    const client = new Redis(url, {
      maxRetriesPerRequest: 1,
      enableOfflineQueue: false,
      retryStrategy: (times) =>
        times > 5 ? null : Math.min(times * 200, 2000),
      lazyConnect: true,
    });

    client.on("error", (err) => {
      logger.warn(`Redis connection error: ${err.message}`);
    });

    return client;
  } catch (err) {
    logger.warn(`Redis client creation failed: ${(err as Error).message}`);
    return null;
  }
}

export const redis = (() => {
  if (globalForRedis.redis === undefined) {
    globalForRedis.redis = createRedisClient();
  }
  return globalForRedis.redis;
})();

export async function redisGet(key: string): Promise<string | null> {
  if (!redis) return null;
  try {
    return await redis.get(key);
  } catch (err) {
    logger.warn(`Redis get failed (${key}): ${(err as Error).message}`);
    return null;
  }
}

export async function redisSet(
  key: string,
  value: string,
  ttlSeconds: number
): Promise<void> {
  if (!redis) return;
  try {
    await redis.set(key, value, "EX", ttlSeconds);
  } catch (err) {
    logger.warn(`Redis set failed (${key}): ${(err as Error).message}`);
  }
}
