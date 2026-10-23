import { Router } from "express";
import {
  createPayment,
  getPayment,
  getPaymentById,
  verifyPayment,
} from "./payment.controller.js";
import { authenticateApiKey } from "../../middleware/auth.js";
import { idempotency } from "../../middleware/idempotency.js";
import { validate } from "../../middleware/validate.middleware.js";
import {
  createPaymentSchema,
  verifyPaymentSchema,
  getPaymentByIdSchema,
  listPaymentsQuerySchema,
} from "../../validations/index.js";

const router = Router();

// Require authentication AND validation on routes
router.get("/", authenticateApiKey, validate(listPaymentsQuerySchema), getPayment);
router.post(
  "/",
  authenticateApiKey,
  validate(createPaymentSchema),
  idempotency(),
  createPayment,
);
router.post("/verify", authenticateApiKey, validate(verifyPaymentSchema), verifyPayment);
router.get("/:id", authenticateApiKey, validate(getPaymentByIdSchema), getPaymentById);

export default router;