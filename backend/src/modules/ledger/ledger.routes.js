import { Router } from "express";
import { getBalance, getLedgerEntries } from "./ledger.service.js";
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

router.get("/entries", authenticateApiKey, async (req, res) => {
  try {
    const result = await getLedgerEntries(req.merchant._id, req.query);
    return res.json(result);
  } catch (error) {
    console.error("Failed to get ledger entries:", error);
    return res.status(500).json({ error: "Failed to fetch ledger entries" });
  }
});

export default router;
