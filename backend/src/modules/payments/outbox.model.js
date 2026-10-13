import mongoose from "mongoose";

const outboxSchema = new mongoose.Schema({
  aggregateType: {
    type: String,
    required: true,
    default: "PAYMENT",
  },
  aggregateId: {
    type: String,
    required: true,
    index: true,
  },
  eventType: {
    type: String,
    required: true,
  },
    payload: {
      type: Object,
      required: true,
    },
    status: {
      type: String,
      enum: ["PENDING", "PROCESSED", "FAILED"],
      default: "PENDING",
      index: true,
    },
    retryCount: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
  }
);

// Compound index to quickly fetch pending events in FIFO order
outboxSchema.index({ status: 1, createdAt: 1 });

export const OutboxEvent = mongoose.model("OutboxEvent", outboxSchema);