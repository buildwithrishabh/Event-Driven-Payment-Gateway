import { Router } from "express";
import { handleRazorpayWebhook } from "./razorpay.webhook.js";

const router = Router();

// Razorpay sends webhooks to this endpoint
router.post("/razorpay", handleRazorpayWebhook);

export default router;
