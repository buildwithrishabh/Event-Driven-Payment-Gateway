import client from "prom-client";
import { paymentQueue } from "../queues/payment.queue.js";
import { refundQueue } from "../queues/refund.queue.js";
import { webhookQueue } from "../queues/webhook.queue.js";

export const register = new client.Registry();

// 1. Collect standard Node.js runtime metrics (CPU , Heap , Event Loop lag)
client.collectDefaultMetrics({ register, prefix: "payment_gw_" });

// 2. HTTP Request Duration and Count
export const httpRequestDuration = new client.Histogram({
  name: "payment_gw_http_request_duration_seconds",
  help: "Duration of HTTP requests in seconds",
  labelNames: ["method", "route", "status_code"],
  buckets: [0.05, 0.1, 0.25, 0.5, 1, 2.5, 5],
  registers: [register],
});

// 3. Payment Business Metrics
export const paymentCounter = new client.Counter({
  name: "payment_gw_payments_total",
  help: "Total count of processed payments",
  labelNames: ["status", "currency"],
  registers: [register],
});

export const refundCounter = new client.Counter({
  name: "payment_gw_refunds_total",
  help: "Total count of processed refunds",
  labelNames: ["status"],
  registers: [register],
});

// 4. BullMQ / Queue Metrics Gauge
export const queueJobGauge = new client.Gauge({
  name: "payment_gw_queue_jobs",
  help: "Number of Jobs in Queue by status",
  labelNames: ["queue", "status"],
  registers: [register],
});

// 5. Outbox Relay Lag Gauge
export const outboxLagGauge = new client.Gauge({
  name: "payment_gw_outbox_pending_events",
  help: "Number of unpublished events remaining in the Outbox collection",
  registers: [register],
});

// 6. Webhook Delivery Metrics
export const webhookCounter = new client.Counter({
  name: "payment_gw_webhooks_total",
  help: "Total count of dispatched merchant webhooks",
  labelNames: ["status"],
  registers: [register],
});

// Helper to refresh BullMQ job stats before scraping
export async function updateQueueMetrics() {
  const queues = [
    { name: "payment-process", instance: paymentQueue },
    { name: "refund-processing-queue", instance: refundQueue },
    { name: "webhook-delivery", instance: webhookQueue },
  ];

  for (const { name, instance } of queues) {
    try {
      const counts = await instance.getJobCounts(
        "waiting",
        "active",
        "completed",
        "failed",
        "delayed"
      );
      for (const [status, count] of Object.entries(counts)) {
        queueJobGauge.set({ queue: name, status }, count);
      }
    } catch {
      // Silently ignore if Redis connection is not established yet
    }
  }
}



