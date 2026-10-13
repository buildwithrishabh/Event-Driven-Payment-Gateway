import { redisClient } from "../config/redis.js";

export function idempotency(options = { ttlSeconds: 86400 }) {
  // default cache 24 hours
  return async (req, res, next) => {
    // only apply idempotency to mutating requests
    if (req.method !== "POST" && req.method !== "PATCH") {
      return next();
    }

    const idempotencyKey =
      req.header("idempotency-key") || req.header("x-idempotency-key");
    if (!idempotencyKey) {
      return res
        .status(400)
        .json({ error: "Missing required Idempotency-Key header" });
    }

    if (!req.merchant || !req.merchant._id) {
      return res.status(500).json({
        error: "Idempotency middleware must run AFTER authenticateApiKey",
      });
    }

    const redisKey = `idempotency:${req.merchant._id}:${idempotencyKey}`;

    try {
      // 1. Attempts to acquire an atomic lock using Redis SET NX
      // Value is "PROCESSING", lock expires in 120s to avoid deadlocks on crashes
      const lockAcquired = await redisClient.set(
        redisKey,
        JSON.stringify({ state: "PROCESSING" }),
        "EX",
        120,
        "NX"
      );

      if (!lockAcquired) {
        // Key already exists! Check whether it is still PROCESSING or already COMPLETED
        const rawCached = await redisClient.get(redisKey);
        if (!rawCached) {
          return res.status(500).json({ error: "Idempotency lookup error" });
        }

        let cached;
        try {
          cached = JSON.parse(rawCached);
        } catch {
          return res.status(500).json({ error: "Corrupted idempotency record" });
        }

        if (cached.state === "PROCESSING") {
          return res.status(409).json({
            error:
              "Conflict: A request with this Idempotency-Key is currently in-flight",
          });
        }

        if (cached.state === "COMPLETED") {
          // Replay original cached response!
          res.setHeader("x-idempotent-replay", "true");
          return res.status(cached.statusCode).json(cached.body);
        }

        return res.status(500).json({ error: "Invalid idempotency state" });
      }

      // 2. Intercept response to store result upon completion
      const originalJson = res.json.bind(res);

      res.json = (body) => {
        res.json = originalJson;

        // Cache the successful/failed response payload
        const record = {
          state: "COMPLETED",
          statusCode: res.statusCode,
          body,
        };

        redisClient
          .set(redisKey, JSON.stringify(record), "EX", options.ttlSeconds)
          .catch((error) => {
            console.error("Failed to save idempotency response to Redis:", error);
          });

        return originalJson(body);
      };

      return next();
    } catch (error) {
      console.error("Idempotency middleware error:", error);
      return next(error);
    }
  };
}
