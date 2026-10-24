import mongoose from "mongoose";
import { LedgerEntry } from "./ledger.model.js";

export async function recordCredit(
  { merchantId, paymentId, amount, currency },
  { session } = {},
) {
  // check if entry already exists to ensure idempotency
  let query = LedgerEntry.findOne({
    paymentId,
    type: "CREDIT",
  });

  if (session && typeof query?.session === "function") {
    query = query.session(session);
  }
  
  const existingentry = await query;
  if (existingentry) {
    return existingentry;
  }

  const payload = {
    merchantId,
    paymentId,
    type: "CREDIT",
    amount,
    currency,
    description: `Payment collected for ${paymentId}`,
  };

  if (session) {
    const [entry] = await LedgerEntry.create([payload], { session });
    return entry;
  }

  return await LedgerEntry.create(payload);
}

export async function recordDebit(
  { merchantId, paymentId, refundId, amount, currency, description },
  { session } = {},
) {
  let query = LedgerEntry.findOne({
    refundId,
    type: "DEBIT",
  });
  if (session && typeof query?.session === "function") {
    query = query.session(session);
  }
  const existing = await query;

  if (existing) {
    return existing;
  }

  const payload = {
    merchantId,
    paymentId,
    refundId,
    type: "DEBIT",
    amount,
    currency,
    description: description || `Refund debit for ${paymentId}`,
  };

  if (session) {
    const [entry] = await LedgerEntry.create([payload], { session });
    return entry;
  }

  return await LedgerEntry.create(payload);
}

// Calculate current available balance using MongoDB Aggregation Pipeline
export async function getBalance(merchantId) {
  const pipeline = [
    {
      $match: {
        merchantId: new mongoose.Types.ObjectId(merchantId),
      },
    },
    {
      $group: {
        _id: "$currency",
        totalCredits: {
          $sum: {
            $cond: [{ $eq: ["$type", "CREDIT"] }, "$amount", 0],
          },
        },
        totalDebits: {
          $sum: {
            $cond: [{ $eq: ["$type", "DEBIT"] }, "$amount", 0],
          },
        },
      },
    },
    {
      $project: {
        currency: "$_id",
        availableBalance: { $subtract: ["$totalCredits", "$totalDebits"] },
        totalCredits: 1,
        totalDebits: 1,
        _id: 0,
      },
    },
  ];

  const results = await LedgerEntry.aggregate(pipeline);
  return results.length > 0
    ? results[0]
    : { currency: "INR", availableBalance: 0, totalCredits: 0, totalDebits: 0 };
}

export async function getLedgerEntries(
  merchantId,
  { page = 1, limit = 20 } = {},
) {
  const pageNum = Math.max(1, parseInt(page, 10));
  const limitNum = Math.min(50, Math.max(1, parseInt(limit, 10)));
  const skip = (pageNum - 1) * limitNum;
  const [entries, total] = await Promise.all([
    LedgerEntry.find({ merchantId })
      .populate("paymentId", "customerEmail status")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitNum)
      .lean(),
    LedgerEntry.countDocuments({ merchantId }),
  ]);
  return {
    data: entries,
    pagination: {
      total,
      page: pageNum,
      limit: limitNum,
      totalPages: Math.ceil(total / limitNum),
    },
  };
}
