import { Queue } from "bullmq";
import { redisClient } from "../config/redis.js";

export const REFUND_QUEUE_NAME = "refund-processing-queue";

export const refundQueue = new Queue(REFUND_QUEUE_NAME, {
  connection: redisClient,
  defaultJobOptions: {
    attempts: 5,
    backoff: {
      type: "exponential",
      delay: 3000,
    },
    removeOnComplete: true,
    removeOnFail: false,
  },
});
