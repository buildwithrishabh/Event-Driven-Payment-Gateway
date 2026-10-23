import crypto from "crypto";
import { Merchant } from "./merchant.model.js";
import { logger } from "../../config/logger.js";
import { validateWebhookUrl } from "../../utils/ssrfValidator.js";

// Helper function to hash raw string using sha-256
export function hashKey(rawKey) {
  return crypto.createHash("sha256").update(rawKey).digest("hex");
}

// POST /v1/merchants
export async function registerMerchant(req, res) {
  try {
    const { name, email, webhookUrl } = req.body;

    if (!name || !email) {
      return res.status(400).json({ error: "name and email are required" });
    }

    if (webhookUrl) {
      try {
        await validateWebhookUrl(webhookUrl);
      } catch (validationErr) {
        return res
          .status(400)
          .json({ error: `Invalid webhookUrl: ${validationErr.message}` });
      }
    }

    const existing = await Merchant.findOne({ email });

    if (existing) {
      return res
        .status(409)
        .json({ error: "Merchant with this email already exists" });
    }

    // Generate raw secure API key and webhook secret
    const rawApiKey = `key_${crypto.randomBytes(24).toString("hex")}`;
    const rawWebhookSecret = `whsec_${crypto.randomBytes(24).toString("hex")}`;
    const apiKeyHash = hashKey(rawApiKey);

    const merchant = await Merchant.create({
      name,
      email,
      apiKeyHash,
      webhookUrl: webhookUrl || null,
      webhookSecret: rawWebhookSecret,
      status: "ACTIVE",
    });

    // Important: return rawApiKey only once during creation!
    return res.status(201).json({
      message:
        "Merchant registered successfully. Save your API key now; it will not be shown again.",
      merchantId: merchant._id,
      name: merchant.name,
      email: merchant.email,
      apiKey: rawApiKey,
      webhookSecret: rawWebhookSecret,
    });
  } catch (error) {
    logger.error("Merchant registration failed", {
      email: req.body?.email,
      error: error.message,
      code: error.code,
    });
    return res.status(500).json({ error: "Internal Server Error" });
  }
}

// GET /v1/merchants/me (Protected route)
export async function getMerchantProfile(req, res) {
  return res.json({
    merchantId: req.merchant._id,
    name: req.merchant.name,
    email: req.merchant.email,
    webhookUrl: req.merchant.webhookUrl,
    status: req.merchant.status,
  });
}
