import crypto from "crypto";
import { Payment } from "../payments/payment.model.js";
import { LedgerService } from "../ledger/ledger.service.js";
import { webhookQueue } from "../../queues/webhook.queue.js";

export async function handleRazorpayWebhook(req, res) {
  const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;
  const signature = req.headers["X-razorpay-signature"];

  // 1. Verify Razorpay Signature
  const rawBody = JSON.stringify(req.body);
  const expectedSignature = crypto
    .createHmac("sha256", webhookSecret || "")
    .update(rawBody)
    .digest("hex");

  if (!signature || signature !== expectedSignature) {
    console.error("Invalid Razorpay Webhook Signature!");
    return res.status(400).json({ error: "Invalid webhook signature" });
  }

  const { event, payload } = req.body;
  console.log("Received verified Razorpay event:", event);

  try {
    if (event === 'payment.captured' || event === "order.paid"){
        
    }
  } catch (error) {

  }
}
