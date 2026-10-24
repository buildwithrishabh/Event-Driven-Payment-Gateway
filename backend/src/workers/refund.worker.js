import { Worker } from "bullmq";
import { redisClient } from "../config/redis.js";
import { razorpayClient } from "../config/razorpay.js";
import { Refund } from "../modules/refunds/refund.model.js";
import { Payment } from "../modules/payments/payment.model.js";
import { recordDebit } from "../modules/ledger/ledger.service.js";
import { webhookQueue } from "../queues/webhook.queue.js";
import { REFUND_QUEUE_NAME } from "../queues/refund.queue.js";
import { refundCounter } from "../config/metrics.js";
import { logger } from "../config/logger.js";
import mongoose from "mongoose";

export const refundWorker = new Worker(
  REFUND_QUEUE_NAME,
  async (job) => {
    const { refundId } = job.data;
    logger.info(`💸 Processing refund job: ${refundId}`);

    // Atomically claim refund to avoid duplicate processing
    const refund = await Refund.findOneAndUpdate(
      { _id: refundId, status: { $in: ["PENDING", "PROCESSING"] } },
      { $set: { status: "PROCESSING" } },
      { new: true },
    );

    if (!refund) {
      logger.warn(`Refund ${refundId} already processed or does not exist`);
      return;
    }

    try {
      // 1. Call Razorpay API to execute refund
      // Razorpay expects: razorpay.payments.refund(paymentId, { amount, notes })
      const razorpayResponse = await razorpayClient.payments.refund(
        refund.processorPaymentId,
        {
          amount: refund.amount,
          receipt: refund._id.toString(),
          notes: {
            reason: refund.reason,
            gatewayRefundId: refund._id.toString(),
          },
        },
      );

      const session = await mongoose.startSession();
      session.startTransaction();

      try {
        // 1. Mark Refund as SUCCEEDED
        refund.status = "SUCCEEDED";
        refund.processorRefundId = razorpayResponse.id;
        await refund.save({ session });

        // 2. Record Immutable Ledger Debit entry (Reverses collected funds)
        await recordDebit(
          {
            merchantId: refund.merchantId,
            paymentId: refund.paymentId,
            refundId: refund._id,
            amount: refund.amount,
            currency: refund.currency,
            description: `Refund executed for payment ${refund.paymentId}`,
          },
          {
            session,
          },
        );

        await session.commitTransaction();
      } catch (error) {
        await session.abortTransaction();
        throw error;
      } finally {
        await session.endSession();
      }

      refundCounter.inc({ status: "SUCCEEDED" });
      logger.info(
        `✅ Refund ${refund._id} SUCCEEDED (Razorpay ID: ${razorpayResponse.id})`,
      );
      // 4. Emit Webhook event to merchant
      if (webhookQueue) {
        await webhookQueue.add("dispatch-webhook", {
          merchantId: refund.merchantId.toString(),
          paymentId: refund.paymentId,
          eventType: "refund.succeeded",
          payload: {
            event: "refund.succeeded",
            refundId: refund._id,
            paymentId: refund.paymentId,
            amount: refund.amount,
            currency: refund.currency,
            status: "SUCCEEDED",
            processorRefundId: refund.processorRefundId,
          },
        });
      }
    } catch (error) {
      logger.error(
        `❌ Refund ${refund._id} failed: ${error?.message || error}`,
      );

      const maxAttempts = job.opts?.attempts || 5;

      // check if error is non-retriable (client/validation error from Razorpay like 400 or BAD_Request)
      const isfatalClientError =
        error?.statusCode === 400 ||
        error?.error?.code === "BAD_REQUEST_ERROR" ||
        error?.error?.code === "GATEWAY_ERROR";

      const isLastAttempt =
        job.attemptsMade + 1 >= maxAttempts || isfatalClientError;

      // Rollback payment.refundedAmount in DB on terminal failure
      if (isLastAttempt) {
        refundCounter.inc({ status: "FAILED" });
        refund.status = "FAILED";
        refund.failureReason =
          error?.error?.description ||
          error?.message ||
          "Upstream processor rejected refund";
        await refund.save();

        // Decrement payment's refundedAmount since this refund permanently failed
        const updatedPayment = await Payment.findByIdAndUpdate(
          refund.paymentId,
          {
            $inc: { refundedAmount: -refund.amount },
          },
          { new: true },
        );

        if (updatedPayment) {
          const currentRefunded = updatedPayment.refundedAmount || 0;
          const newStatus =
            currentRefunded <= 0
              ? "NONE"
              : currentRefunded >= updatedPayment.amount
                ? "FULL"
                : "PARTIAL";

          updatedPayment.refundStatus = newStatus;
          await updatedPayment.save();
        }

        if (webhookQueue) {
          await webhookQueue.add("dispatch-webhook", {
            merchantId: refund.merchantId.toString(),
            paymentId: refund.paymentId,
            eventType: "refund.failed",
            payload: {
              event: "refund.failed",
              refundId: refund._id,
              paymentId: refund.paymentId,
              amount: refund.amount,
              status: "FAILED",
              reason: refund.failureReason,
            },
          });
        }

        // Fatal client error par retry throw na karein, job ko cleanly exit karein
        if (isfatalClientError) {
          return;
        }
      }

      throw error; // Let BullMQ retry according to backoff strategy
    }
  },
  {
    connection: redisClient,
    concurrency: 5,
  },
);
