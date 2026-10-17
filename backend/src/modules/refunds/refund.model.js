import mongoose from "mongoose";

const refundSchema = new mongoose.Schema(
  {
    merchantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Merchant",
      required: true,
      index: true,
    },
    paymentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Payment",
      required: true,
      index: true,
    },
    processorPaymentId: {
      type: String, // Razorpay payment id (pay_xxx)
      required: true,
    },
    processorRefundId: {
      type: String, // Razorpay refund id (rfn_xxx)
      sparse: true,
      index: true,
    },
    amount: {
      type: Number,
      required: true,
      min: 1, // Integer is smallest currency unit (e.g paisa or cent)
    },
    currency: {
      type: String,
      required: true,
      uppercase: true,
      default: "INR",
    },
    status: {
      type: String,
      enum: ["PENDING", "PROCESSING", "SUCCEEDED", "FAILED"],
      default: "PENDING",
      index: true,
    },
    reason: {
      type: String,
      default: "requested_by_customer",
    },
    failureReason: {
      type: String,
    },
  },
  {
    timestamps: true,
  },
);

// Fast compound Lookup for merchant refund lists
refundSchema.index({ merchantId: 1, createdAt: -1 });

export const Refund = mongoose.model("Refund", refundSchema);
