import { Router } from "express";
import { getBalance, getLedgerEntries } from "./ledger.service.js";
import { authenticateApiKey } from "../../middleware/auth.js";
import { validate } from "../../middleware/validate.middleware.js";
import { listLedgerEntriesQuerySchema } from "../../validations/index.js";
import { logger } from "../../config/logger.js";

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
    logger.error("Failed to compute ledger balance", {
      merchantId: req.merchant?._id,
      error: error.message,
    });
    return res.status(500).json({ error: "Failed to compute balance" });
  }
});

router.get("/entries", authenticateApiKey, validate(listLedgerEntriesQuerySchema), async (req, res) => {
  try {
    const result = await getLedgerEntries(req.merchant._id, req.query);
    return res.json(result);
  } catch (error) {
    logger.error("Failed to fetch ledger entries", {
      merchantId: req.merchant?._id,
      error: error.message,
    });
    return res.status(500).json({ error: "Failed to fetch ledger entries" });
  }
});

export default router;
