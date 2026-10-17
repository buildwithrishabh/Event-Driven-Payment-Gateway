import { Router } from "express";
import {
  getCheckoutSession,
  verifyCheckoutPayment,
} from "./checkout.controller.js";

const router = Router();

// Public checkout routes - No merchant API key required
router.get("/:id", getCheckoutSession);
router.post("/verify", verifyCheckoutPayment);

export default router;
