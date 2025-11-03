import { createClient, RedisClientType } from 'redis';

let redisClient: RedisClientType | null = null;

/**
 * Initialize Redis client
 */
export async function initRedis(): Promise<RedisClientType> {
  if (redisClient) {
    return redisClient;
  }

  const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
  
  redisClient = createClient({
    url: redisUrl
  });

  redisClient.on('error', (err) => {
    console.error('Redis Client Error:', err);
  });

  await redisClient.connect();
  console.log('Redis connected');
  
  return redisClient;
}

/**
 * Get cached value by key
 */
export async function getCache(key: string): Promise<string | null> {
  if (!redisClient) {
    return null;
  }
  
  try {
    return await redisClient.get(key);
  } catch (error) {
    console.error('Redis get error:', error);
    return null;
  }
}

/**
 * Set cache value with expiration (default 7 days)
 */
export async function setCache(key: string, value: string, expirySeconds: number = 604800): Promise<void> {
  if (!redisClient) {
    return;
  }
  
  try {
    await redisClient.setEx(key, expirySeconds, value);
  } catch (error) {
    console.error('Redis set error:', error);
  }
}

/**
 * Close Redis connection
 */
export async function closeRedis(): Promise<void> {
  if (redisClient) {
    await redisClient.quit();
    redisClient = null;
  }
}
