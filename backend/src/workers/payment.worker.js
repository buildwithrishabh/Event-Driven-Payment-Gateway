import { Worker } from "bullmq";
import { redisClient } from "../config/redis.js";
import { Payment } from "../modules/payments/payment.model.js";
import { createOrder } from "../modules/processors/razorpay.processor.js";
import { webhookQueue } from "../queues/webhook.queue.js";
import os from "os";
import { paymentCounter } from "../config/metrics.js";
import { logger } from "../config/logger.js";

const workerId = `worker_${os.hostname()}_${process.pid}`;

export const paymentWorker = new Worker(
  "payment-process",
  async (job) => {
    const { paymentId, amount, currency } = job.data;
    logger.info(`[${workerId}] Processing payment: ${paymentId}`);

    // Lock TTL: allow reclaiming stale locks from workers that died midway (> 2 mins ago)
    const twoMinutesAgo = new Date(Date.now() - 2 * 60 * 1000);

    // 1. ATOMIC CLAIM: Claim if status is 'CREATED', or if previous worker crashed in 'PROCESSING' without upstream order
    const payment = await Payment.findOneAndUpdate(
      {
        _id: paymentId,
        $or: [
          { status: "CREATED" },
          {
            status: "PROCESSING",
            razorpayOrderId: null,
            "processingLock.lockedAt": { $lt: twoMinutesAgo },
          },
        ],
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

      const maxAttempts = job.opts?.attempts || 3;
      const isLastAttempt = job.attemptsMade + 1 >= maxAttempts;

      if (isLastAttempt) {
        // Terminal failure: retries exhausted -> mark FAILED permanently to prevent stuck payment
        payment.status = "FAILED";
        payment.processingLock = null;
        payment.failureReason = `Exhausted retries: ${err.message}`;
        await payment.save();

        logger.warn(
          `[${workerId}] Payment ${paymentId} permanently marked FAILED after ${maxAttempts} attempts`,
        );

        // Notify merchant webhook
        if (webhookQueue) {
          await webhookQueue.add("send-webhook", {
            merchantId: payment.merchantId.toString(),
            paymentId: payment._id,
            eventType: "payment.failed",
            payload: {
              event: "payment.failed",
              data: {
                paymentId: payment._id,
                status: "FAILED",
                failureReason: payment.failureReason,
                amount: payment.amount,
                currency: payment.currency,
              },
            },
          });
        }
      } else {
        // Transient failure: release lock and return to CREATED for BullMQ retry
        payment.status = "CREATED";
        payment.processingLock = null;
        payment.failureReason = err.message;
        await payment.save();
      }

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
