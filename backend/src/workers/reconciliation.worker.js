import { Payment } from "../modules/payments/payment.model.js";
import { recordCredit } from "../modules/ledger/ledger.service.js";
import { webhookQueue } from "../queues/webhook.queue.js";
import { fetchOrderPayments } from "../modules/processors/razorpay.processor.js";

export async function runReconciliationSweep() {
  console.log("🔍 Running Reconciliation sweep for stuck payments...");

  const threeMinutesAgo = new Date(Date.now() - 3 * 60 * 1000);

  const stuckPayments = await Payment.find({
    status: "PROCESSING",
    razorpayOrderId: { $ne: null },
    updatedAt: { $lt: threeMinutesAgo },
  });

  if (stuckPayments.length === 0) {
    console.log("✅ No stuck payments found.");
    return;
  }

  console.log(
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
        console.log(
          `💡 Razorpay verified payment ${successfulCharge.id} is captured! Reconciling to SUCCEEDED.`,
        );

        payment.status = "SUCCEEDED";
        payment.razorpayPaymentId = successfulCharge.id;
        payment.failureReason = null;
        payment.processingLock = null;
        await payment.save();

        // Record credit in Ledger
        await recordCredit({
          merchantId: payment.merchantId,
          paymentId: payment._id,
          amount: payment.amount,
          currency: payment.currency,
        });

        // Dispatch Webhook to merchant
        await webhookQueue.add("send-webhook", {
          merchantId: payment.merchantId,
          paymentId: payment._id,
          eventType: "payment.succeeded",
          payload: {
            event: "payment.succeeded",
            data: payment,
          },
        });
      } else {
        // check if there are only failed attempts older than 10 minutes
        const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);
        if (payment.updatedAt < tenMinutesAgo) {
          console.log(
            `⌛ Payment ${payment._id} expired without successful capture. Marking as FAILED.`,
          );
          payment.status = "FAILED";
          payment.failureReason = "Payment window expired without capture";
          payment.processingLock = null;
          await payment.save();

          await webhookQueue.add("send-webhook", {
            merchantId: payment.merchantId,
            paymentId: payment._id,
            eventType: "payment.failed",
            payload: {
              event: "payment.failed",
              data: payment,
            },
          });
        }
      }
    } catch (error) {
      console.error(
        `Failed to reconcile payment ${payment._id}:`,
        error.message,
      );
    }
  }
}

export function startReconciliationWorker(intervalMs = 60000) {
  console.log(`⏱️ Reconciliation worker active (running every ${intervalMs / 1000}s)`);
  return setInterval(runReconciliationSweep, intervalMs);
}
