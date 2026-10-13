import { Router } from "express";
import { getBalance } from "./ledger.service.js";
import { authenticateApiKey } from "../../middleware/auth.js";

const router = Router();

// GET /v1/ledger/balance
router.get("/balance", authenticateApiKey, async (req, res) => {
  try {
    const balance = await getBalance(req.merchant._id);
    return res.json({
      merchantId: req.merchant._id,
      balance,
    });
  } catch (error) {
    console.error("Failed to get ledger balance:", error);
    return res.status(500).json({ error: "Failed to compute balance" });
  }
});

export default router;
