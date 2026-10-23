import { Router } from "express";
import {
  createRefund,
  getRefund,
  listPaymentRefunds,
  listRefunds,
} from "./refund.controller.js";
import { authenticateApiKey } from "../../middleware/auth.js";
import { idempotency } from "../../middleware/idempotency.js";
import { validate } from "../../middleware/validate.middleware.js";
import {
  createRefundSchema,
  getRefundByIdSchema,
  listPaymentRefundsSchema,
  listRefundsQuerySchema,
} from "../../validations/index.js";

const router = Router();

// List all refunds with pagination & search
router.get("/", authenticateApiKey, validate(listRefundsQuerySchema), listRefunds);

// Create Refund (Requires API Key & Idempotency Header)
router.post(
  "/",
  authenticateApiKey,
  idempotency(),
  validate(createRefundSchema),
  createRefund,
);

// Get all refunds for a specific payment (must come before /:id)
router.get(
  "/payment/:paymentId",
  authenticateApiKey,
  validate(listPaymentRefundsSchema),
  listPaymentRefunds,
);

// Get single refund by ID
router.get("/:id", authenticateApiKey, validate(getRefundByIdSchema), getRefund);

export default router;
