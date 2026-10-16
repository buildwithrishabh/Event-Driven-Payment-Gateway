import { Router } from "express";
import { createPayment, getPaymentById, verifyPayment } from "./payment.controller.js";
import { authenticateApiKey } from "../../middleware/auth.js";
import { idempotency } from "../../middleware/idempotency.js";


const router = Router();

// Require both authentication AND idempotency on creation 
router.post("/" , authenticateApiKey , idempotency() , createPayment);
router.post("/verify" , authenticateApiKey , verifyPayment)
router.get("/:id" , authenticateApiKey , getPaymentById);


export default router;