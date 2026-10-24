import mongoose from "mongoose";
import { Payment } from "./payment.model.js";
import { recordCredit } from "../ledger/ledger.service.js";
import { webhookQueue } from "../../queues/webhook.queue.js";
import { logger } from "../../config/logger.js";

export async function finalizePayment({
  paymentId,
  razorpayPaymentId,
  razorpaySignature,
}) {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    // 1. Payment document fetch karna hai is session ke andar
    const payment = await Payment.findById(paymentId).session(session);
    if (!payment) {
      throw new Error("Payment not found");
    }

    // 2. Idempotency check: Agar already SUCCEEDED ho chuka hai, kuch mat karo
    if (payment.status === "SUCCEEDED") {
      await session.abortTransaction();
      return payment;
    }

    // 3. Payment Status update karo (In-transaction)
    payment.status = "SUCCEEDED";
    if (razorpayPaymentId) payment.razorpayPaymentId = razorpayPaymentId;
    if (razorpaySignature) payment.razorpaySignature = razorpaySignature;
    payment.failureReason = null;
    payment.processingLock = null;
    await payment.save({ session });

    // 4. Ledger Entry insert karo(In-Transaction with same session)
    await recordCredit(
      {
        merchantId: payment.merchantId,
        paymentId: payment._id,
        amount: payment.amount,
        currency: payment.currency,
      },
      { session },
    );

    // 5. Atmoic commit: dono change ek sath DB mein commit honge
    await session.commitTransaction();

    // 6. Webhook Notification Enqueue (CRITICAL: Commit ke BAAD hi call karna)
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

    return payment;
  } catch (error) {
    await session.abortTransaction();
    logger.error("Failed to atomically finalize payament", {
      paymentId,
      error: error.message,
    });
    throw error;
  } finally {
    await session.endSession();
  }
}
