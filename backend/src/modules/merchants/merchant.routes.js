import { Router } from "express";
import { registerMerchant, getMerchantProfile } from "./merchant.controller.js";
import { authenticateApiKey } from "../../middleware/auth.js";
import { validate } from "../../middleware/validate.middleware.js";
import { registerMerchantSchema } from "../../validations/index.js";

const router = Router();

router.post("/", validate(registerMerchantSchema), registerMerchant);
router.get("/me", authenticateApiKey, getMerchantProfile);

export default router;
