import mongoose from "mongoose";

const paymentSchema = new mongoose.Schema({
  merchantId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Merchant",
    required: true,
    index: true,
  },
  amount: {
    type: Number,
    required: true,
    min: 100,
  },
  currency: {
    type: String,
    required: true,
    uppercase: true,
    default: "INR",
  },
  status: {
    type: String,
    enum: ["CREATED", "PROCESSING", "SUCCEEDED", "FAILED", "CANCELLED"],
    default: "CREATED",
    index: true,
  },
  customerEmail: {
    type: String,
    required: true,
  },
  customerPhone: {
    type: String,
    default: null,
  },
  // Upstream Razorpay references
  razorpayOrderId: {
    type: String,
    default: null,
    index: true,
  },
  razorpayPaymentId: {
    type: String,
    default: null,
    index: true,
  },
  razorpaySignature: {
    type: String,
    default: null,
  },
  failureReason: {
    type: String,
    default: null,
  },
  processingLock: {
    workerId: { type: String, default: null },
    lockedAt: { type: Date, default: null },
  },
}, {
    timestamps: true
});


export const Payment = mongoose.model("Payment" , paymentSchema)
