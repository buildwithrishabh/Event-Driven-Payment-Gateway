import mongoose from "mongoose";

const merchantSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    apiKeyHash: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    webhookUrl: {
      type: String,
      default: null,
    },
    webhookSecret: {
      type: String,
      required: true,
    },
    status: {
      type: String,
      enum: ["ACTIVE", "SUSPENDED"],
      default: "ACTIVE",
    },
  },
  {
    timestamps: true,
  }
);

export const Merchant = mongoose.model("Merchant", merchantSchema);
