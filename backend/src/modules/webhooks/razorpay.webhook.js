import crypto from "crypto";
import { Payment } from "../payments/payment.model.js";
import { finalizePayment } from "../payments/payment.service.js";
import { webhookQueue } from "../../queues/webhook.queue.js";
import { logger } from "../../config/logger.js";

export async function handleRazorpayWebhook(req, res) {
  const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;
  const signature =
    req.headers["x-razorpay-signature"] || req.get("x-razorpay-signature");

  // 1. Verify Razorpay Signature
  const rawBody = req.rawBody || JSON.stringify(req.body);
  const expectedSignature = crypto
    .createHmac("sha256", webhookSecret || "")
    .update(rawBody)
    .digest("hex");

  if (!signature || signature !== expectedSignature) {
    logger.warn("❌ Invalid Razorpay Webhook Signature");
    return res.status(400).json({ error: "Invalid webhook signature" });
  }

  const { event, payload } = req.body;
  logger.info("📥 Received verified Razorpay event", { event });

  try {
    if (event === "payment.captured" || event === "order.paid") {
      const razorpayPayment = payload.payment?.entity;
      const orderId = razorpayPayment?.order_id || payload.order?.entity?.id;

      if (!orderId) {
        logger.warn("⚠️ No order ID found in Razorpay event payload", {
          event,
        });
        return res.status(200).json({ status: "ignored_no_order_id" });
      }

      const payment = await Payment.findOne({ razorpayOrderId: orderId });
      if (!payment) {
        logger.warn("⚠️ Payment document not found for razorpayOrderId", {
          orderId,
          event,
        });
        return res.status(200).json({ status: "ignored_payment_not_found" });
      }

      await finalizePayment({
        paymentId: payment._id,
        razorpayPaymentId: razorpayPayment?.id || null,
      });
      return res.status(200).json({ status: "processed" });
    } else if (event === "payment.failed") {
      const razorpayPayment = payload.payment?.entity;
      const orderId = razorpayPayment?.order_id;

      if (!orderId) {
        logger.warn("⚠️ No order ID found in payment.failed event payload", {
          event,
        });
        return res.status(200).json({ status: "ignored_no_order_id" });
      }

      const payment = await Payment.findOne({ razorpayOrderId: orderId });
      if (!payment) {
        logger.warn("⚠️ Payment document not found for razorpayOrderId", {
          orderId,
          event,
        });
        return res.status(200).json({ status: "ignored_payment_not_found" });
      }

      if (payment.status === "SUCCEEDED") {
        logger.warn(
          "Received payment.failed for already SUCCEEDED payment. Ignoring.",
          {
            orderId,
            paymentId: payment._id,
          },
        );

        return res.status(200).json({ status: "ignored_already_succeeded" });
      }

      if (payment.status !== "FAILED") {
        payment.status = "FAILED";
        payment.failureReason =
          razorpayPayment?.error_description || "Payment failed";
        payment.processingLock = null 
        await payment.save();

        // Enqueue merchant notification
        await webhookQueue.add("send-webhook", {
          merchantId: payment.merchantId,
          paymentId: payment._id,
          eventType: "payment.failed",
          payload: {
            event: "payment.failed",
            data: {
              paymentId: payment._id,
              status: "FAILED",
              reason: payment.failureReason,
            },
          },
        });
      }
    }

    return res.status(200).json({ status: "ok" });
  } catch (error) {
    logger.error("❌ Error processing Razorpay webhook", {
      error: error.message,
      stack: error.stack,
      event,
    });
    return res.status(500).json({ error: "Internal processing error" });
  }
}
