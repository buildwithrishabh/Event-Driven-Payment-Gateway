import { Router } from "express";
import {
  getCheckoutSession,
  verifyCheckoutPayment,
} from "./checkout.controller.js";
import { validate } from "../../middleware/validate.middleware.js";
import {
  getCheckoutSessionSchema,
  verifyCheckoutSchema,
} from "../../validations/index.js";

const router = Router();

// Public checkout routes - No merchant API key required
router.get("/:id", validate(getCheckoutSessionSchema), getCheckoutSession);
router.post("/verify", validate(verifyCheckoutSchema), verifyCheckoutPayment);

export default router;
