import { OutboxEvent } from "../modules/payments/outbox.model.js";
import { paymentQueue } from "../queues/payment.queue.js";
import { refundQueue } from "../queues/refund.queue.js";
import { outboxLagGauge } from "../config/metrics.js";
import { logger } from "../config/logger.js";

let isRunning = false;

export async function processOutboxBatch() {
  if (isRunning) return;
  isRunning = true;

  try {
    // Update Prometheus Outbox lag Gauge
    const pendingCount = await OutboxEvent.countDocuments({
      status: "PENDING",
    });
    outboxLagGauge.set(pendingCount);

    const events = await OutboxEvent.find({ status: "PENDING" })
      .sort({ createdAt: 1 })
      .limit(20);

    for (const event of events) {
      try {
        if (event.eventType === "PAYMENT_CREATED") {
          await paymentQueue.add(
            "process-payment",
            {
              paymentId: event.payload.paymentId,
              merchantId: event.payload.merchantId,
              amount: event.payload.amount,
              currency: event.payload.currency,
              customerEmail: event.payload.customerEmail,
            },
            {
              jobId: `pay_${event.payload.paymentId}`, // Deduplication key in BullMq
            },
          );
          event.status = "PROCESSED";
          await event.save();
        } else if (event.eventType === "REFUND_CREATED") {
          await refundQueue.add(
            "process-refund",
            { refundId: event.payload.refundId },
            { jobId: `refund_${event.payload.refundId}` },
          );
          event.status = "PROCESSED";
          await event.save();
        }
      } catch (eventError) {
        logger.error(
          `Failed to relay event ${event._id}: ${eventError.message}`,
        );
        event.retryCount = (event.retryCount || 0) + 1;
        if (event.retryCount >= 3) {
          event.status = "FAILED";
        }
        await event.save();
      }
    }
  } catch (error) {
    logger.error(`Outbox Relay polling error: ${error.message || error}`);
  } finally {
    isRunning = false;
  }
}

export function startOutboxRelay(intervalMs = 1500) {
  logger.info("📬 Outbox Relay started (polling every 1.5s)");
  return setInterval(processOutboxBatch, intervalMs);
}
