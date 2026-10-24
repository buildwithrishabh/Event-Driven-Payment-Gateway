import { Payment } from "../modules/payments/payment.model.js";
import { finalizePayment } from "../modules/payments/payment.service.js";
import { webhookQueue } from "../queues/webhook.queue.js";
import { fetchOrderPayments } from "../modules/processors/razorpay.processor.js";
import { logger } from "../config/logger.js";

export async function runReconciliationSweep() {
  logger.info("🔍 Running Reconciliation sweep for stuck payments...");

  const threeMinutesAgo = new Date(Date.now() - 3 * 60 * 1000);

  const stuckPayments = await Payment.find({
    status: "PROCESSING",
    razorpayOrderId: { $ne: null },
    updatedAt: { $lt: threeMinutesAgo },
  });

  if (stuckPayments.length === 0) {
    logger.info("✅ No stuck payments with upstream orders found.");
  } else {
    logger.warn(
      `⚠️ Found ${stuckPayments.length} stuck payments. Checking against Razorpay API...`,
    );

    for (const payment of stuckPayments) {
      try {
        // 1. Query Razorpay API for all payment attempts on this order
        const orderPayments = await fetchOrderPayments(payment.razorpayOrderId);
        const items = orderPayments.items || [];

        // Look for any captured/successful payment attempt
        const successfulCharge = items.find((p) => p.status === "captured");

        if (successfulCharge) {
          logger.info(
            `💡 Razorpay verified payment ${successfulCharge.id} is captured! Reconciling to SUCCEEDED.`,
          );

          await finalizePayment({
            paymentId: payment._id,
            razorpayPaymentId: successfulCharge.id,
          });
        } else {
          // check if there are only failed attempts older than 10 minutes
          const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);
          if (payment.updatedAt < tenMinutesAgo) {
            logger.info(
              `⌛ Payment ${payment._id} expired without successful capture. Marking as FAILED.`,
            );
            payment.status = "FAILED";
            payment.failureReason = "Payment window expired without capture";
            payment.processingLock = null;
            await payment.save();

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
        }
      } catch (error) {
        logger.error(
          `Failed to reconcile payment ${payment._id}: ${error.message}`,
        );
      }
    }
  }

  // 2. SWEEP ORPHANED PAYMENTS: Payments stuck in CREATED or PROCESSING without upstream orderId (> 5 mins)
  const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
  const orphanedPayments = await Payment.find({
    status: { $in: ["CREATED", "PROCESSING"] },
    razorpayOrderId: null,
    createdAt: { $lt: fiveMinutesAgo },
  });

  if (orphanedPayments.length > 0) {
    logger.warn(
      `⚠️ Found ${orphanedPayments.length} orphaned payments stuck without upstream order. Marking as FAILED...`,
    );

    for (const orphan of orphanedPayments) {
      try {
        orphan.status = "FAILED";
        orphan.failureReason =
          "Payment initialization timed out before upstream order creation";
        orphan.processingLock = null;
        await orphan.save();

        if (webhookQueue) {
          await webhookQueue.add("send-webhook", {
            merchantId: orphan.merchantId.toString(),
            paymentId: orphan._id,
            eventType: "payment.failed",
            payload: {
              event: "payment.failed",
              data: {
                paymentId: orphan._id,
                status: "FAILED",
                failureReason: orphan.failureReason,
                amount: orphan.amount,
                currency: orphan.currency,
              },
            },
          });
        }

        logger.info(
          `🧹 Cleaned up orphaned payment ${orphan._id} and notified merchant.`,
        );
      } catch (err) {
        logger.error(
          `Failed to sweep orphaned payment ${orphan._id}: ${err.message}`,
        );
      }
    }
  }
}

export function startReconciliationWorker(intervalMs = 60000) {
  logger.info(
    `⏱️ Reconciliation worker active (running every ${intervalMs / 1000}s)`,
  );
  return setInterval(runReconciliationSweep, intervalMs);
}
