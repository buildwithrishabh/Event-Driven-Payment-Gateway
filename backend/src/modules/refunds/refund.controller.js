import {
  createRefund as createRefundService,
  getRefundById,
  getAllRefunds,
  getRefundsForPayment,
} from "./refund.service.js";

export async function createRefund(req, res) {
  try {
    const { paymentId, amount, reason } = req.body;

    if (!paymentId) {
      return res.status(400).json({ error: "paymentId is required." });
    }

    const refund = await createRefundService({
      merchantId: req.merchant._id,
      paymentId,
      amount,
      reason,
    });

    return res.status(202).json({
      message: "Refund initiated successfully",
      refund,
    });
  } catch (error) {
    const statusCode = error.statusCode || 500;
    return res.status(statusCode).json({
      error: error.message || "Internal server error",
    });
  }
}

export async function getRefund(req, res) {
  try {
    const refund = await getRefundById(req.params.id, req.merchant._id);
    if (!refund) {
      return res.status(404).json({ error: "Refund not found" });
    }
    return res.json({ refund });
  } catch (error) {
    return res.status(500).json({ error: "Failed to retrieve refund" });
  }
}

export async function listPaymentRefunds(req, res) {
  try {
    const refunds = await getRefundsForPayment(
      req.params.paymentId,
      req.merchant._id,
    );
    return res.json({ refunds });
  } catch (error) {
    return res.status(500).json({ error: "Failed to retrieve refunds" });
  }
}


export async function listRefunds(req, res) {
  try {
    const { status, page, limit, search } = req.query;
    const result = await getAllRefunds(req.merchant._id, {
      status,
      page,
      limit,
      search,
    });
    return res.json(result);
  } catch (error) {
    return res.status(500).json({ error: "Failed to list refunds" });
  }
}
