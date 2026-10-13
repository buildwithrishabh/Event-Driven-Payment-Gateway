import Redis from "ioredis";
import { logger } from "./logger.js";

const redishost = process.env.REDIS_HOST || "127.0.0.1";
const redisPort = parseInt(process.env.REDIS_PORT || "6379", 10);

export const redisClient = new Redis({
  host: redishost,
  port: redisPort,
  maxRetriesPerRequest: null,
});

redisClient.on("connect", () => {
  logger.info("Redis Connected");
});

redisClient.on("error", (error) => {
  logger.error(`Redis Error: ${error.message}`);
});

export default redisClient;
