import mongoose from "mongoose";
import { Payment } from "../payments/payment.model.js";
import { verifyPaymentSignature } from "../processors/razorpay.processor.js";
import { recordCredit } from "../ledger/ledger.service.js";

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
      failureReason: payment.failureReason,
      merchant: {
        name: payment.merchantId?.name || "Merchant Store",
        email: payment.merchantId?.email || null,
      },
      createdAt: payment.createdAt,
      updatedAt: payment.updatedAt,
    });
  } catch (error) {
    console.error("Failed to fetch checkout session:", error);
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
    // 1. Signature Verify karo
    const isValid = verifyPaymentSignature({
      orderId: razorpayOrderId,
      paymentId: razorpayPaymentId,
      signature: razorpaySignature,
    });
    if (!isValid) {
      return res.status(400).json({ error: "Invalid payment signature" });
    }
    // 2. Payment fetch karo
    const payment = await Payment.findById(paymentId);
    if (!payment) {
      return res.status(404).json({ error: "Payment not found" });
    }
    // 3. Status update aur ledger entry
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
    }
    return res.json({
      success: true,
      message: "Payment verified and recorded successfully",
      paymentId: payment._id,
      status: payment.status,
    });
  } catch (error) {
    console.error("Checkout verification failed:", error);
    return res.status(500).json({ error: "Failed to verify checkout payment" });
  }
}

// POST /v1/checkout/simulate
export async function simulateCheckoutPayment(req, res) {
  const { paymentId, status = "SUCCEEDED", failureReason } = req.body;

  if (!paymentId) {
    return res.status(400).json({ error: "paymentId is required" });
  }

  try {
    const payment = await Payment.findById(paymentId);
    if (!payment) {
      return res.status(404).json({ error: "Payment not found" });
    }

    if (status === "SUCCEEDED") {
      if (payment.status !== "SUCCEEDED") {
        payment.status = "SUCCEEDED";
        payment.razorpayPaymentId =
          payment.razorpayPaymentId || `pay_sim_${Date.now()}`;
        payment.failureReason = null;
        await payment.save();
        // Record credit in ledger
        await recordCredit({
          merchantId: payment.merchantId,
          paymentId: payment._id,
          amount: payment.amount,
          currency: payment.currency,
        });
      }
      return res.json({
        success: true,
        message: "Simulated payment succeeded and credited to ledger",
        paymentId: payment._id,
        status: payment.status,
      });
    } else {
      payment.status = "FAILED";
      payment.failureReason =
        failureReason || "Transaction declined by simulated issuer";
      await payment.save();
      return res.json({
        success: false,
        message: "Simulated payment marked as failed",
        paymentId: payment._id,
        status: payment.status,
        failureReason: payment.failureReason,
      });
    }
  } catch (error) {
    console.error("Checkout simulation failed:", error);
    return res
      .status(500)
      .json({ error: "Failed to simulate checkout payment" });
  }
}
