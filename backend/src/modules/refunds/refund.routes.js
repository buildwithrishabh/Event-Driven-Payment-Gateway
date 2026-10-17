import { Router } from "express";
import {
  createRefund,
  getRefund,
  listPaymentRefunds,
} from "./refund.controller.js";
import { authenticateApiKey } from "../../middleware/auth.js";
import { idempotency } from "../../middleware/idempotency.js";

const router = Router();

// Create Refund (Requires API Key & Idempotency Header)
router.post("/", authenticateApiKey, idempotency(), createRefund);

// Get single refund by ID
router.get("/:id", authenticateApiKey, getRefund);

// Get all refunds for a specific payment
router.get("/payment/:paymentId", authenticateApiKey, listPaymentRefunds);

export default router;
