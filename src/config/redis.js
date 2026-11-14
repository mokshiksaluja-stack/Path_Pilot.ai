const Redis = require('ioredis');

const REDIS_HOST = process.env.REDIS_HOST || 'localhost';
const REDIS_PORT = parseInt(process.env.REDIS_PORT || '6379', 10);

/**
 * BullMQ Connection Configuration.
 * Note: BullMQ requires maxRetriesPerRequest to be null for queue workers.
 */
const connectionConfig = {
  host: REDIS_HOST,
  port: REDIS_PORT,
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
};

/**
 * Standalone Redis Client for health checks and ad-hoc operations.
 */
const redisClient = new Redis({
  host: REDIS_HOST,
  port: REDIS_PORT,
  maxRetriesPerRequest: 3,
});

redisClient.on('connect', () => {
  console.log(`⚡ [Notification Worker] Connected to Redis broker at ${REDIS_HOST}:${REDIS_PORT}`);
});

redisClient.on('error', (err) => {
  console.error(`⚠️ [Notification Worker] Redis connection error: ${err.message}`);
});

module.exports = {
  connectionConfig,
  redisClient,
};

