import mongoose, { mongo } from "mongoose";
import { Payment } from "./payment.model.js";
import { OutboxEvent } from "./outbox.model.js";
import { verifyPaymentSignature } from "../processors/razorpay.processor.js";
import { recordCredit } from "../ledger/ledger.service.js";

// POST /v1/payments
export async function createPayment(req, res) {
  const { amount, currency, customerEmail, customerPhone } = req.body;

  if (!amount || typeof amount !== "number" || amount < 100) {
    return res.status(400).json({
      error:
        "amount is required, must be a number, and minimum 100 minor units (e.g., 100 paise = 1 INR)",
    });
  }

  if (!customerEmail) {
    return res.status(400).json({
      error: "customerEmail is required",
    });
  }

  // Session Start
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    // 1. Payment create karo
    const [payment] = await Payment.create(
      [
        {
          merchantId: req.merchant._id,
          amount,
          currency: (currency || "INR").toUpperCase(),
          customerEmail,
          customerPhone: customerPhone || null,
          status: "CREATED",
        },
      ],
      { session },
    );

    // 2. Outbox Event create karo (taaki worker process kar sake)
    await OutboxEvent.create(
      [
        {
          aggregateType: "PAYMENT",
          aggregateId: payment._id.toString(),
          eventType: "PAYMENT_CREATED",
          payload: {
            paymentId: payment._id.toString(),
            merchantId: req.merchant._id,
            amount: payment.amount,
            currency: payment.currency,
            customerEmail: payment.customerEmail,
          },
          status: "PENDING",
        },
      ],
      { session },
    );

    // 3. Dono documents safely DB me commit
    await session.commitTransaction();

    return res.status(201).json({
      paymentId: payment._id,
      merchantId: payment.merchantId,
      amount: payment.amount,
      currency: payment.currency,
      status: payment.status,
      createdAt: payment.createdAt,
    });
  } catch (error) {
    // Agar koi bhi error aaye to transaction rollback karo
    await session.abortTransaction();
    console.error("Failed to create payment:", error);

    if (error.name === "ValidationError") {
      return res.status(400).json({ error: error.message });
    }

    return res
      .status(500)
      .json({ error: "Failed to initiate payment transaction" });
  } finally {
    // Session ko close karo taaki connection leak na ho
    session.endSession();
  }
}

// GET /v1/payments/:id
export async function getPaymentById(req, res) {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ error: "Invalid payment ID format" });
    }

    const payment = await Payment.findOne({
      _id: req.params.id,
      merchantId: req.merchant._id,
    });

    if (!payment) {
      return res.status(404).json({ error: "Payment not found" });
    }

    return res.json(payment);
  } catch (error) {
    console.error("Failed to retrieve payment:", error);
    return res.status(500).json({ error: "Failed to retrieve payment" });
  }
}

// POST /v1/payments/verify
export async function verifyPayment(req, res) {
  const { paymentId, razorpayOrderId, razorpayPaymentId, razorpaySignature } =
    req.body;

  if (
    !paymentId ||
    !razorpayOrderId ||
    !razorpayPaymentId ||
    !razorpaySignature
  ) {
    return res.status(400).json({
      error:
        "paymentId, razorpayOrderId, razorpayPaymentId, and razorpaySignature are required",
    });
  }

  try {
    // 1. Signature Verify karo
    const isvalid = verifyPaymentSignature({
      orderId: razorpayOrderId,
      paymentId: razorpayPaymentId,
      signature: razorpaySignature,
    });

    if (!isvalid) {
      return res.status(400).json({ error: "Invalid Payment Signature" });
    }

    // 2. Payment fetch karo
    const payment = await Payment.findOne({
      _id: paymentId,
      merchantId: req.merchant._id,
    });

    if (!payment) {
      return res.status(404).json({ error: "Payment not found" });
    }

    // 3. Status update aur ledger entry (idempotent)
    if (payment.status !== "SUCCEEDED") {
      payment.status = "SUCCEEDED";
      payment.razorpayPaymentId = razorpayPaymentId;
      payment.failureReason = null;
      await payment.save();

      // Record credit in ledger
      await recordCredit({
        merchantId: payment.merchantId,
        paymentId: payment._id,
        amount: payment.amount,
        currency: payment.currency,
      });
    }
    return res.json({
      success: true,
      message: "Payment verified and recorded successfully",
      paymentId: payment._id,
      status: payment.status,
    });
  } catch (error) {
    console.error("Payment verification failed:", error);
    return res.status(500).json({ error: "Failed to verify payment" });
  }
}

// GET /v1/payments
export async function getPayment(req, res) {
  try {
    const { status, search, page = 1, limit = 20 } = req.query;
    const query = { merchantId: req.merchant._id };

    // Status filter (e.g. SUCCEEDED . CREATED , FAILED)
    if (status) {
      query.status = status.toUpperCase();
    }

    // search by customer email
    if (search) {
      query.customerEmail = { $regex: search.trim(), $options: "i" };
    }

    const pageNum = Math.max(1, parseInt(page, 10));
    const limitNum = Math.min(50, Math.max(1, parseInt(limit, 10)));

    const skip = (pageNum - 1) * limitNum;

    const [payments, total] = await Promise.all([
      Payment.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum)
        .lean(),
      Payment.countDocuments(query),
    ]);

    return res.json({
      data: payments,
      pagination: {
        total,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(total / limitNum),
      },
    });
  } catch (error) {
    console.error("Failed to list payments:", error);
    return res.status(500).json({ error: "Failed to retrieve payments" });
  }
}
