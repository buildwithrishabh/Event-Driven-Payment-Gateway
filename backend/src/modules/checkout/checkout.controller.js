import mongoose from "mongoose";
import { Payment } from "../payments/payment.model.js";
import { verifyPaymentSignature } from "../processors/razorpay.processor.js";
import { recordCredit } from "../ledger/ledger.service.js";
import { webhookQueue } from "../../queues/webhook.queue.js";
import { logger } from "../../config/logger.js";

// GET /v1/checkout/:id
export async function getCheckoutSession(req, res) {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ error: "Invalid payment ID format" });
    }

    const payment = await Payment.findById(id).populate(
      "merchantId",
      "name  email",
    );

    if (!payment) {
      return res.status(404).json({ error: "Checkout session not found" });
    }

    return res.json({
      paymentId: payment._id,
      amount: payment.amount,
      currency: payment.currency,
      status: payment.status,
      customerEmail: payment.customerEmail,
      customerPhone: payment.customerPhone,
      razorpayOrderId: payment.razorpayOrderId,
      razorpayPaymentId: payment.razorpayPaymentId,
      razorpayKeyId: process.env.RAZORPAY_KEY_ID || null,
      failureReason: payment.failureReason,
      merchant: {
        name: payment.merchantId?.name || "Merchant Store",
        email: payment.merchantId?.email || null,
      },
      createdAt: payment.createdAt,
      updatedAt: payment.updatedAt,
    });
  } catch (error) {
    logger.error("Failed to fetch checkout session", {
      paymentId: req.params?.id,
      error: error.message,
    });
    return res
      .status(500)
      .json({ error: "Failed to retrieve checkout session" });
  }
}

// POST /v1/checkout/verify
export async function verifyCheckoutPayment(req, res) {
  const { paymentId, razorpayOrderId, razorpayPaymentId, razorpaySignature } =
    req.body;

  if (
    !paymentId ||
    !razorpayOrderId ||
    !razorpayPaymentId ||
    !razorpaySignature
  ) {
    return res.status(400).json({
      error:
        "paymentId, razorpayOrderId, razorpayPaymentId, and razorpaySignature are required",
    });
  }

  try {
    if (!mongoose.Types.ObjectId.isValid(paymentId)) {
      return res.status(400).json({ error: "Invalid payment ID format" });
    }

    // 1. Payment fetch karo
    const payment = await Payment.findById(paymentId);
    if (!payment) {
      return res.status(404).json({ error: "Payment not found" });
    }

    // 2. Check: Payment ke paas upstream orderId hona chahiye
    if (!payment.razorpayOrderId) {
      return res.status(400).json({
        error: "Payment does not have an associated upstream order yet",
      });
    }

    // 3. CRITICAL SECURITY CHECK: Kya incoming orderId database wale orderId se match karta hai?
    if (payment.razorpayOrderId !== razorpayOrderId) {
      return res.status(400).json({
        error:
          "Order ID mismatch: Provided order does not belong to this payment",
      });
    }

    // 4. Signature Verify karo
    const isValid = verifyPaymentSignature({
      orderId: razorpayOrderId,
      paymentId: razorpayPaymentId,
      signature: razorpaySignature,
    });
    if (!isValid) {
      return res.status(400).json({ error: "Invalid payment signature" });
    }

    // 5. Status update aur ledger entry
    if (payment.status !== "SUCCEEDED") {
      payment.status = "SUCCEEDED";
      payment.razorpayPaymentId = razorpayPaymentId;
      payment.razorpaySignature = razorpaySignature;
      payment.failureReason = null;
      await payment.save();
      // Record credit in ledger
      await recordCredit({
        merchantId: payment.merchantId,
        paymentId: payment._id,
        amount: payment.amount,
        currency: payment.currency,
      });

      // Dispatch webhook notification to merchant
      if (webhookQueue) {
        await webhookQueue.add("send-webhook", {
          merchantId: payment.merchantId.toString(),
          paymentId: payment._id,
          eventType: "payment.succeeded",
          payload: {
            event: "payment.succeeded",
            data: {
              paymentId: payment._id,
              razorpayOrderId: payment.razorpayOrderId,
              razorpayPaymentId: payment.razorpayPaymentId,
              amount: payment.amount,
              currency: payment.currency,
              status: "SUCCEEDED",
              createdAt: payment.createdAt,
            },
          },
        });
      }
    }
    return res.json({
      success: true,
      message: "Payment verified and recorded successfully",
      paymentId: payment._id,
      status: payment.status,
    });
  } catch (error) {
    logger.error("Checkout verification failed", {
      paymentId: req.body?.paymentId,
      error: error.message,
      stack: error.stack,
    });
    return res.status(500).json({ error: "Failed to verify checkout payment" });
  }
}
