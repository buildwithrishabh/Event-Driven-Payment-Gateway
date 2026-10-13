import mongoose from "mongoose";

const webhookDeliverySchema = new mongoose.Schema(
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
    eventType: {
      type: String,
      required: true, // e.g. "payment.successful", "payment.failed"
    },
    payload: {
      type: Object,
      required: true,
    },
    webhookUrl: {
      type: String,
      required: true,
    },
    responseStatus: {
      type: Number,
      default: null,
    },
    responseBody: {
      type: String,
      default: null,
    },
    errorMessage: {
      type: String,
      default: null,
    },
    attemptNumber: {
      type: Number,
      default: 1,
    },
    nextRetryAt: {
      type: Date,
      default: null,
    },
    status: {
      type: String,
      enum: ["PENDING", "SUCCESS", "FAILED"],
      default: "PENDING",
      index: true,
    },
  },
  {
    timestamps: true,
  },
);

// Compound index to quickly fetch pending webhooks for delivery/retries
webhookDeliverySchema.index({ status: 1, createdAt: 1 });

export const WebhookDelivery = mongoose.model(
  "WebhookDelivery",
  webhookDeliverySchema,
);

