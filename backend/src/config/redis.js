import Redis from "ioredis";
import { logger } from "./logger.js";

const redisOptions = {
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
};

export const redisClient = process.env.REDIS_URL
  ? new Redis(process.env.REDIS_URL, redisOptions)
  : new Redis({
      host: process.env.REDIS_HOST || "127.0.0.1",
      port: parseInt(process.env.REDIS_PORT || "6379", 10),
      password: process.env.REDIS_PASSWORD || undefined,
      ...redisOptions,
    });

redisClient.on("connect", () => {
  logger.info("Redis Connected");
});

redisClient.on("error", (error) => {
  logger.error(`Redis Error: ${error.message}`);
});

export default redisClient;
