import { Router } from "express";
import {
  createRefund,
  getRefund,
  listPaymentRefunds,
  listRefunds
} from "./refund.controller.js";
import { authenticateApiKey } from "../../middleware/auth.js";
import { idempotency } from "../../middleware/idempotency.js";

const router = Router();



// List all refunds with pagination & search
router.get("/", authenticateApiKey, listRefunds);

// Create Refund (Requires API Key & Idempotency Header)
router.post("/", authenticateApiKey, idempotency(), createRefund);

// Get all refunds for a specific payment (must come before /:id)
router.get("/payment/:paymentId", authenticateApiKey, listPaymentRefunds);

// Get single refund by ID
router.get("/:id", authenticateApiKey, getRefund);

export default router;
