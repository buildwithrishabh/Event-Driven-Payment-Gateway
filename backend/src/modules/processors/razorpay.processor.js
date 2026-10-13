import crypto from "crypto";
import { razorpayClient } from "../../config/razorpay.js";

export async function createOrder({ amount, currency, receipt, notes = {} }) {
  try {
    const order = await razorpayClient.orders.create({
      amount: Math.round(amount),
      currency: currency.toUpperCase(),
      receipt: String(receipt),
      notes,
    });

    return {
      success: true,
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
      status: order.status,
    };
  } catch (error) {
    console.error("Razorpay order creation error:", error);
    throw new Error(
      `Razorpay Error: ${error.error?.description || error.message}`,
    );
  }
}

// Fetch payment details from razorpay
export async function fetchPayment(paymentId) {
  return razorpayClient.payments.fetch(paymentId);
}

//  Fetch all payments for an order
export async function fetchOrderPayments(orderId) {
  return razorpayClient.orders.fetchPayments(orderId);
}

// Verify Razorpay Payment Signature
export function verifyPaymentSignature({ orderId, paymentId, signature }) {
  const text = `${orderId}|${paymentId}`;
  const expectedSignature = crypto
    .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
    .update(text)
    .digest("hex");

    return expectedSignature === signature;
}
