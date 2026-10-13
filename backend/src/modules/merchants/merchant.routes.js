import { Router } from "express";
import { registerMerchant, getMerchantProfile } from "./merchant.controller.js";
import { authenticateApiKey } from "../../middleware/auth.js";

const router = Router();

router.post("/", registerMerchant);
router.get("/me", authenticateApiKey, getMerchantProfile);

export default router;
