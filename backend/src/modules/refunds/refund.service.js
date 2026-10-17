import mongoose from "mongoose";
import { Payment } from "../payments/payment.model.js";
import { Refund } from "./refund.model.js";
import { OutboxEvent } from "../payments/outbox.model.js";
import { refundQueue } from "../../queues/refund.queue.js";

// Request a refund and persist outbox event
export async function createRefund({ merchantId, paymentId, amount, reason }) {
  // 1. Fetch payment
  const payment = await Payment.findOne({
    _id: paymentId,
    merchantId,
  });

  if (!payment) {
    throw { statusCode: 404, message: "Payment not found" };
  }

  if (payment.status !== "SUCCEEDED") {
    throw {
      statusCode: 400,
      message: `Cannot refund payment with status: ${payment.status}. Only SUCCEEDED payments can be refunded.`,
    };
  }

  const processorPaymentId =
    payment.razorpayPaymentId || payment.processorPaymentId;
  if (!processorPaymentId) {
    throw {
      statusCode: 400,
      message: "Payment does not have an upstream processor transaction ID.",
    };
  }

  // Default to full refund if amount is not specified
  const currentRefunded = payment.refundedAmount || 0;
  const refundAmount = amount
    ? Number(amount)
    : payment.amount - currentRefunded;

  if (refundAmount <= 0) {
    throw {
      statusCode: 400,
      message: "Refund amount must be greater than zero.",
    };
  }

  const remainingRefundable = payment.amount - currentRefunded;

  if (refundAmount > remainingRefundable) {
    throw {
      statusCode: 400,
      message: `Refund amount exceeds refundable balance. Remaining refundable: ${remainingRefundable}`,
    };
  }

  // 2. Create refund record in pending state
  const refund = await Refund.create({
    merchantId,
    paymentId: payment._id,
    processorPaymentId,
    amount: refundAmount,
    currency: payment.currency,
    reason: reason || "requested_by_customer",
    status: "PENDING",
  });

  // 3. Update Payment refunded amount and status
  const newTotalRefunded = currentRefunded + refundAmount;
  payment.refundedAmount = newTotalRefunded;
  payment.refundStatus =
    newTotalRefunded === payment.amount ? "FULL" : "PARTIAL";
  await payment.save();

  // 4. Record OutBox Event
  await OutboxEvent.create({
    aggregateType: "REFUND",
    aggregateId: refund._id.toString(),
    eventType: "REFUND_CREATED",
    payload: {
      refundId: refund._id.toString(),
      paymentId: payment._id.toString(),
      amount: refundAmount,
      processorPaymentId: refund.processorPaymentId,
    },
    status: "PENDING",
  });

  // 5. Enqueue BullMQ Job
  await refundQueue.add(
    "process-refund",
    { refundId: refund._id.toString() },
    { jobId: `refund_${refund._id}` },
  );

  return refund;
}

export async function getRefundById(refundId, merchantId) {
  return await Refund.findOne({ _id: refundId, merchantId });
}

export async function getRefundsForPayment(paymentId, merchantId) {
  return await Refund.find({ paymentId, merchantId }).sort({ createdAt: -1 });
}
