import mongoose from "mongoose";

const ledgerEntrySchema = new mongoose.Schema(
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
    refundId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Refund",
      default: null,
      index: true,
    },
    type: {
      type: String,
      enum: ["CREDIT", "DEBIT"],
      required: true,
    },
    amount: {
      type: Number,
      required: true,
      min: 1,
    },
    currency: {
      type: String,
      required: true,
      uppercase: true,
      default: "USD",
    },
    description: {
      type: String,
      required: true,
    },
  },
  {
    timestamps: { createdAt: true, updatedAt: false }, // No UpdatedAt because entries can Never be changed!
  },
);

// 1. Ek paymentId ka sirf ek hi credit ho sakta hai
ledgerEntrySchema.index(
  { paymentId: 1, type: 1 },
  { unique: true, partialFilterExpression: { type: "CREDIT" } },
);

// 2. Ek refundId ka sirf ek hi debit ho sakta hai
ledgerEntrySchema.index(
  { refundId: 1, type: 1 },
  {
    unique: true,
    partialFilterExpression: { refundId: { $type: "objectId" } },
  },
);

// Prevent updating or deleting ledger records at the Mongoose middleware level
ledgerEntrySchema.pre(
  ["updateOne", "updateMany", "findOneAndUpdate", "deleteOne", "deleteMany"],
  function () {
    throw new Error(
      "LEDGER_IMMUTABILITY_VIOLATION: Ledger entries cannot be modified or deleted.",
    );
  },
);

export const LedgerEntry = mongoose.model("LedgerEntry", ledgerEntrySchema);
