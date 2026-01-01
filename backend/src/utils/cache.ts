/**
 * Caching Utilities
 * Redis-based caching with in-memory fallback
 */

import Redis from "ioredis";
import { logger } from "./logger";

// Redis configuration (Upstash compatible)
const REDIS_URL = process.env.UPSTASH_REDIS_URL || process.env.REDIS_URL;

let redis: Redis | null = null;

// In-memory cache fallback
const memoryCache = new Map<string, { value: any; expiresAt: number }>();
const MAX_MEMORY_CACHE_SIZE = 1000;

/**
 * Get Redis client (lazy initialization)
 */
function getRedis(): Redis | null {
  if (redis) return redis;
  
  if (!REDIS_URL) {
    return null;
  }

  try {
    redis = new Redis(REDIS_URL, {
      maxRetriesPerRequest: 3,
      lazyConnect: true,
      connectTimeout: 5000,
    });

    redis.on("error", (err) => {
      logger.error("Redis connection error", { error: err.message });
    });

    redis.on("connect", () => {
      logger.info("Redis connected");
    });

    return redis;
  } catch (error: any) {
    logger.warn("Redis initialization failed, using memory cache", { error: error.message });
    return null;
  }
}

/**
 * Clean up expired memory cache entries
 */
function cleanMemoryCache() {
  const now = Date.now();
  for (const [key, entry] of memoryCache) {
    if (entry.expiresAt < now) {
      memoryCache.delete(key);
    }
  }
  
  // If still too large, remove oldest entries
  if (memoryCache.size > MAX_MEMORY_CACHE_SIZE) {
    const toDelete = memoryCache.size - MAX_MEMORY_CACHE_SIZE;
    const keys = Array.from(memoryCache.keys()).slice(0, toDelete);
    keys.forEach(k => memoryCache.delete(k));
  }
}

/**
 * Get value from cache
 */
export async function cacheGet<T>(key: string): Promise<T | null> {
  const client = getRedis();
  
  if (client) {
    try {
      const value = await client.get(key);
      if (value) {
        return JSON.parse(value);
      }
      return null;
    } catch (error: any) {
      logger.warn("Cache get error", { key, error: error.message });
    }
  }

  // Fallback to memory cache
  const entry = memoryCache.get(key);
  if (entry && entry.expiresAt > Date.now()) {
    return entry.value;
  }
  memoryCache.delete(key);
  return null;
}

/**
 * Set value in cache
 */
export async function cacheSet(key: string, value: any, ttlSeconds = 300): Promise<void> {
  const client = getRedis();
  
  if (client) {
    try {
      await client.setex(key, ttlSeconds, JSON.stringify(value));
      return;
    } catch (error: any) {
      logger.warn("Cache set error", { key, error: error.message });
    }
  }

  // Fallback to memory cache
  cleanMemoryCache();
  memoryCache.set(key, {
    value,
    expiresAt: Date.now() + (ttlSeconds * 1000)
  });
}

/**
 * Delete from cache
 */
export async function cacheDel(key: string): Promise<void> {
  const client = getRedis();
  
  if (client) {
    try {
      await client.del(key);
    } catch (error: any) {
      logger.warn("Cache delete error", { key, error: error.message });
    }
  }

  memoryCache.delete(key);
}

/**
 * Delete by pattern (for cache invalidation)
 */
export async function cacheDelPattern(pattern: string): Promise<void> {
  const client = getRedis();
  
  if (client) {
    try {
      const keys = await client.keys(pattern);
      if (keys.length > 0) {
        await client.del(...keys);
      }
    } catch (error: any) {
      logger.warn("Cache pattern delete error", { pattern, error: error.message });
    }
  }

  // Memory cache pattern delete
  for (const key of memoryCache.keys()) {
    if (key.includes(pattern.replace("*", ""))) {
      memoryCache.delete(key);
    }
  }
}

/**
 * Cache wrapper function
 */
export function cached<T>(
  keyFn: (...args: any[]) => string,
  fn: (...args: any[]) => Promise<T>,
  ttlSeconds = 300
) {
  return async (...args: any[]): Promise<T> => {
    const key = keyFn(...args);
    
    const cached = await cacheGet<T>(key);
    if (cached !== null) {
      return cached;
    }

    const result = await fn(...args);
    await cacheSet(key, result, ttlSeconds);
    return result;
  };
}

/**
 * Close Redis connection
 */
export async function closeCache(): Promise<void> {
  if (redis) {
    await redis.quit();
    redis = null;
  }
}

/**
 * Check if Redis is configured
 */
export function isRedisConfigured(): boolean {
  return !!REDIS_URL;
}


