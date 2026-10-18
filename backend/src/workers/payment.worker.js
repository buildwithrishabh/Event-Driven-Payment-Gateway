import { Worker } from "bullmq";
import { redisClient } from "../config/redis.js";
import { Payment } from "../modules/payments/payment.model.js";
import { createOrder } from "../modules/processors/razorpay.processor.js";
import os from "os";
import { paymentCounter } from "../config/metrics.js";
import { logger } from "../config/logger.js";

const workerId = `worker_${os.hostname()}_${process.pid}`;

export const paymentWorker = new Worker(
  "payment-process",
  async (job) => {
    const { paymentId, amount, currency } = job.data;
    logger.info(`[${workerId}] Processing payment: ${paymentId}`);

    // 1. ATOMIC CLAIM: Only claim if status is still 'CREATED'
    const payment = await Payment.findOneAndUpdate(
      {
        _id: paymentId,
        status: "CREATED",
      },
      {
        status: "PROCESSING",
        processingLock: {
          workerId: workerId,
          lockedAt: new Date(),
        },
      },
      {
        returnDocument: "after",
      },
    );

    if (!payment) {
      logger.info(
        `[${workerId}] Payment ${paymentId} already claimed or processed. Skipping.`,
      );
      return;
    }

    try {
      // Call Razorpay API to generate real upstream order
      const razorpayOrder = await createOrder({
        amount,
        currency,
        receipt: paymentId,
        notes: {
          gatewayPaymentId: paymentId,
          merchantId: payment.merchantId.toString(),
        },
      });

      // 3. Link Razorpay order ID and release worker lock
      payment.razorpayOrderId = razorpayOrder.orderId;
      payment.failureReason = null;
      payment.processingLock = null;
      await payment.save();

      // Razorpay Order create hone ke baad (Real success)
      paymentCounter.inc({ status: "SUCCESS", currency });

      logger.info(
        `[${workerId}] Razorpay Order created: ${razorpayOrder.orderId} for Payment ${paymentId}`,
      );
    } catch (err) {
      
      // Error aane par:
      paymentCounter.inc({ status: "FAILED", currency: currency || "INR" });

      logger.error(
        `[${workerId}] Razorpay call failed for payment ${paymentId}: ${err.message}`,
      );

      // Release lock for BullMQ retry
      payment.status = "CREATED";
      payment.processingLock = null;
      payment.failureReason = err.message;
      await payment.save();
      throw err; // Re-Throw trigger BullMq exponential backoff
    }
  },
  {
    connection: redisClient,
    concurrency: 5, // Handle up to 5 concurrent payments simultaneously
  },
);

paymentWorker.on("completed", (job) => {
  logger.info(`✅ Job ${job.id} completed`);
});

paymentWorker.on("failed", (job, err) => {
  logger.error(`❌ Job ${job?.id} failed: ${err.message}`);
});
