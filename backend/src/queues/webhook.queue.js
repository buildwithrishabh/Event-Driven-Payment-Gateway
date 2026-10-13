import { Queue } from "bullmq";
import { redisClient } from "../config/redis.js";

export const webhookQueue = new Queue("webhook-delivery", {
  connection: redisClient,
  defaultJobOptions: {
    attempts: 5,
    backoff: {
      type: "exponential",
      delay: 3000,
    },
    removeOnComplete: 1000,
    removeOnFail: 5000,
  },
});
