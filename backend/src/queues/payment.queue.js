import { Queue } from "bullmq";
import { redisClient } from "../config/redis.js";

export const paymentQueue = new Queue("payment-process", {
  connection: redisClient,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: "exponential",
      delay: 2000,
    },
    removeOnComplete: true,
    removeOnFail: false,
  },
});
