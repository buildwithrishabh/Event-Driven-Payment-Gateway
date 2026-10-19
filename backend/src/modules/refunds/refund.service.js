import mongoose from "mongoose";
import { Payment } from "../payments/payment.model.js";
import { Refund } from "./refund.model.js";
import { OutboxEvent } from "../payments/outbox.model.js";
import { refundQueue } from "../../queues/refund.queue.js";
import { logger } from "../../config/logger.js";

// Request a refund and persist outbox event
export async function createRefund({ merchantId, paymentId, amount, reason }) {
  // 1. Pre-validation checks
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

  // 2. Transaction Session Start
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    // 3. ATOMIC CONDITIONAL UPDATE: Sirf tabhi increment karo jab (refundedAmount + refundAmount <= amount)
    // Ye parallel duplicate refunds ko mathematically block karta hai
    const updatedPayment = await Payment.findOneAndUpdate(
      {
        _id: paymentId,
        merchantId,
        status: "SUCCEEDED",
        $expr: {
          $lte: [{ $add: ["$refundedAmount", refundAmount] }, "$amount"],
        },
      },
      {
        $inc: { refundedAmount: refundAmount },
      },
      { session, new: true }
    );

    if (!updatedPayment) {
      throw {
        statusCode: 400,
        message:
          "Refund amount exceeds remaining refundable balance or concurrent refund in progress.",
      };
    }

    // Status update (FULL vs PARTIAL)
    updatedPayment.refundStatus =
      updatedPayment.refundedAmount === updatedPayment.amount
        ? "FULL"
        : "PARTIAL";
    await updatedPayment.save({ session });

    // 4. Create refund record inside session
    const [refund] = await Refund.create(
      [
        {
          merchantId,
          paymentId: payment._id,
          processorPaymentId,
          amount: refundAmount,
          currency: payment.currency,
          reason: reason || "requested_by_customer",
          status: "PENDING",
        },
      ],
      { session }
    );

    // 5. Create Outbox Event inside session
    await OutboxEvent.create(
      [
        {
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
        },
      ],
      { session }
    );

    // 6. Commit transaction
    await session.commitTransaction();

    // 7. Fast-path BullMQ Job (Session commit hone ke baad trigger karo)
    refundQueue
      .add(
        "process-refund",
        { refundId: refund._id.toString() },
        { jobId: `refund_${refund._id}` }
      )
      .catch((err) => {
        // Outbox relay fallback is available even if this fails
        logger.warn("Direct queue add failed for refund, outbox relay will pick it up", {
          refundId: refund._id.toString(),
          error: err.message,
        });
      });

    return refund;
  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    session.endSession();
  }
}

export async function getRefundById(refundId, merchantId) {
  if (mongoose.Types.ObjectId.isValid(refundId)) {
    return await Refund.findOne({ _id: refundId, merchantId });
  }
  return await Refund.findOne({ processorRefundId: refundId, merchantId });
}

export async function getRefundsForPayment(paymentId, merchantId) {
  return await Refund.find({ paymentId, merchantId }).sort({ createdAt: -1 });
}

export async function getAllRefunds(
  merchantId,
  { status, page = 1, limit = 20, search } = {},
) {
  const query = { merchantId };
  if (status) {
    query.status = status.toUpperCase();
  }
  if (search) {
    const s = search.trim();
    if (mongoose.Types.ObjectId.isValid(s)) {
      query.$or = [{ _id: s }, { paymentId: s }];
    } else {
      query.$or = [
        { processorRefundId: { $regex: s, $options: "i" } },
        { processorPaymentId: { $regex: s, $options: "i" } },
        { reason: { $regex: s, $options: "i" } },
      ];
    }
  }

  const pageNum = Math.max(1, parseInt(page, 10));
  const limitNum = Math.min(50, Math.max(1, parseInt(limit, 10)));
  const skip = (pageNum - 1) * limitNum;

  const [refunds, total] = await Promise.all([
    Refund.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitNum)
      .lean(),
    Refund.countDocuments(query),
  ]);

  return {
    data: refunds,
    pagination: {
      total,
      page: pageNum,
      limit: limitNum,
      totalPages: Math.ceil(total / limitNum),
    },
  };
}
