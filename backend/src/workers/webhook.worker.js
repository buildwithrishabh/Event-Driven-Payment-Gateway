import { Worker } from "bullmq";
import { redisClient } from "../config/redis.js";
import { Merchant } from "../modules/merchants/merchant.model.js";
import { WebhookDelivery } from "../modules/webhooks/webhook.model.js";
import crypto from "crypto";

export const webhookWorker = new Worker(
  "webhook-delivery",
  async (job) => {
    const { merchantId, paymentId, eventType, payload } = job.data;

    const merchant = await Merchant.findById(merchantId);
    if (!merchant || !merchant.webhookUrl) {
      console.log(
        `Merchant ${merchantId} has no webhook URL configured. Skipping.`,
      );
      return;
    }

    if (!merchant.webhookSecret) {
      console.warn(
        `Merchant ${merchantId} has no webhookSecret configured. Skipping.`,
      );
      return;
    }

    const payloadString = JSON.stringify(payload);

    // Compute HMAC-SHA256 signature using merchant's private secret
    const signature = crypto
      .createHmac("sha256", merchant.webhookSecret)
      .update(payloadString)
      .digest("hex");

    const headers = {
      "Content-Type": "application/json",
      "x-signature": `sha256=${signature}`,
      "x-event": eventType,
    };

    console.log(
      `🚀 Sending webhook [${eventType}] to ${merchant.webhookUrl} (Attempt ${job.attemptsMade + 1})`,
    );

    let responseStatus = null;
    let responseText = null;

    try {
      const response = await fetch(merchant.webhookUrl, {
        method: "POST",
        headers,
        body: payloadString,
        signal: AbortSignal.timeout(5000), // 5s timeout
      });

      responseStatus = response.status;
      responseText = await response.text();

      await WebhookDelivery.create({
        merchantId,
        paymentId,
        eventType,
        payload,
        webhookUrl: merchant.webhookUrl,
        responseStatus,
        responseBody: responseText.slice(0, 500),
        attemptNumber: job.attemptsMade + 1,
        status: response.ok ? "SUCCESS" : "FAILED",
      });

      if (!response.ok) {
        throw new Error(
          `Merchant webhook responded with HTTP ${response.status}`,
        );
      }

      console.log(
        `✅ Webhook delivered successfully to ${merchant.webhookUrl}`,
      );
    } catch (err) {
      if (responseStatus === null) {
        try {
          await WebhookDelivery.create({
            merchantId,
            paymentId,
            eventType,
            payload,
            webhookUrl: merchant.webhookUrl,
            responseStatus: null,
            responseBody: null,
            errorMessage: err.message,
            attemptNumber: job.attemptsMade + 1,
            status: "FAILED",
          });
        } catch (dbErr) {
          console.error("Failed to record webhook delivery error in DB:", dbErr);
        }
      }

      console.error(
        `❌ Webhook delivery error (Attempt ${job.attemptsMade + 1}):`,
        err.message,
      );
      throw err; // BullMQ retries automatically with exponential backoff
    }
  },
  {
    connection: redisClient,
    concurrency: 10,
  },
);

webhookWorker.on("completed", (job) => {
  console.log(`✅ Webhook job ${job.id} completed successfully`);
});

webhookWorker.on("failed", (job, err) => {
  console.error(`❌ Webhook job ${job?.id} failed:`, err.message);
});
