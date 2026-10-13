import { Merchant } from "../modules/merchants/merchant.model.js";
import { hashKey } from "../modules/merchants/merchant.controller.js";
import { redisClient } from "../config/redis.js";

export async function authenticateApiKey(req, res, next) {
  const apiKey = req.header("x-api-key");

  if (!apiKey) {
    return res
      .status(401)
      .json({ error: "Unauthorized: Missing x-api-key header" });
  }

  const keyHash = hashKey(apiKey);
  const cacheKey = `auth:merchant:${keyHash}`;

  try {
    // 1. Check Redis Cache first
    const cachedMerchant = await redisClient.get(cacheKey);

    if (cachedMerchant) {
      req.merchant = JSON.parse(cachedMerchant);
      return next();
    }

    // 2. Query MongoDB if cache misses
    const merchant = await Merchant.findOne({
      apiKeyHash: keyHash,
      status: "ACTIVE",
    });

    if (!merchant) {
      return res
        .status(401)
        .json({ error: "Unauthorized: Invalid or inactive API key" });
    }

    // 3. Cache merchant profile in Redis for 5 minutes (300 seconds)
    const merchantData = {
      _id: merchant._id.toString(),
      name: merchant.name,
      email: merchant.email,
      webhookUrl: merchant.webhookUrl,
      webhookSecret: merchant.webhookSecret,
      status: merchant.status,
    };

    await redisClient.set(cacheKey, JSON.stringify(merchantData), "EX", 300);

    req.merchant = merchantData;
    return next();
  } catch (error) {
    console.error("Auth error:", error);
    return res.status(500).json({ error: "Authentication internal failure" });
  }
}
