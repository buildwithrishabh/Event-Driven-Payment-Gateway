import { OutboxEvent } from "../modules/payments/outbox.model.js";
import { paymentQueue } from "../queues/payment.queue.js";

let isRunning = false;

export async function processOutboxBatch() {
  if (isRunning) return;
  isRunning = true;

  try {
    const events = await OutboxEvent.find({ status: "PENDING" })
      .sort({ createdAt: 1 })
      .limit(20);

    for (const event of events) {
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
      }
    }
  } catch (error) {
    console.error("Outbox Relay polling error:", error);
  } finally {
    isRunning = false;
  }
}

export function startOutboxRelay(intervalMs = 1500) {
  console.log("📬 Outbox Relay started (polling every 1.5s)");
  setInterval(processOutboxBatch, intervalMs);
}
