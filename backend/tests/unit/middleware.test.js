import { describe, it, expect, beforeEach, vi } from "vitest";

// Mock dependencies before importing middleware
vi.mock("../../src/config/redis.js", () => ({
  redisClient: {
    get: vi.fn(),
    set: vi.fn(),
  },
}));

vi.mock("../../src/config/logger.js", () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

vi.mock("../../src/modules/merchants/merchant.model.js", () => ({
  Merchant: {
    findOne: vi.fn(),
  },
}));

import { authenticateApiKey } from "../../src/middleware/auth.js";
import { idempotency } from "../../src/middleware/idempotency.js";
import {
  notFoundHandler,
  errorHandler,
} from "../../src/middleware/error.middleware.js";
import { redisClient } from "../../src/config/redis.js";
import { Merchant } from "../../src/modules/merchants/merchant.model.js";

function createMockReqRes(overrides = {}) {
  const req = {
    header: vi.fn(),
    headers: {},
    method: "POST",
    originalUrl: "/test-endpoint",
    body: {},
    ...overrides,
  };

  const res = {
    statusCode: 200,
    headers: {},
    status: vi.fn().mockImplementation(function (code) {
      this.statusCode = code;
      return this;
    }),
    json: vi.fn().mockImplementation(function (data) {
      this.body = data;
      return this;
    }),
    setHeader: vi.fn().mockImplementation(function (key, val) {
      this.headers[key.toLowerCase()] = val;
      return this;
    }),
  };

  const next = vi.fn();
  return { req, res, next };
}

describe("Middleware Unit Tests", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Authentication Middleware (authenticateApiKey)", () => {
    it("should return 401 if x-api-key header is missing", async () => {
      const { req, res, next } = createMockReqRes();
      req.header.mockReturnValue(undefined);

      await authenticateApiKey(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.body).toEqual({
        error: "Unauthorized: Missing x-api-key header",
      });
      expect(next).not.toHaveBeenCalled();
    });

    it("should authenticate and call next() on Redis cache hit", async () => {
      const { req, res, next } = createMockReqRes();
      req.header.mockReturnValue("valid_api_key_123");

      const cachedMerchant = {
        _id: "merchant_id_123",
        name: "Acme Corp",
        email: "test@acme.com",
        status: "ACTIVE",
      };

      redisClient.get.mockResolvedValue(JSON.stringify(cachedMerchant));

      await authenticateApiKey(req, res, next);

      expect(req.merchant).toEqual(cachedMerchant);
      expect(next).toHaveBeenCalledTimes(1);
      expect(Merchant.findOne).not.toHaveBeenCalled();
    });

    it("should query MongoDB on cache miss and return 401 if merchant not found", async () => {
      const { req, res, next } = createMockReqRes();
      req.header.mockReturnValue("invalid_api_key");

      redisClient.get.mockResolvedValue(null);
      Merchant.findOne.mockResolvedValue(null);

      await authenticateApiKey(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.body).toEqual({
        error: "Unauthorized: Invalid or inactive API key",
      });
      expect(next).not.toHaveBeenCalled();
    });

    it("should cache merchant in Redis and call next() when valid in DB", async () => {
      const { req, res, next } = createMockReqRes();
      req.header.mockReturnValue("valid_key");

      const dbMerchant = {
        _id: { toString: () => "m_456" },
        name: "Fintech Co",
        email: "dev@fintech.co",
        webhookUrl: "https://fintech.co/webhook",
        webhookSecret: "whsec_123",
        status: "ACTIVE",
      };

      redisClient.get.mockResolvedValue(null);
      Merchant.findOne.mockResolvedValue(dbMerchant);
      redisClient.set.mockResolvedValue("OK");

      await authenticateApiKey(req, res, next);

      expect(req.merchant).toEqual({
        _id: "m_456",
        name: "Fintech Co",
        email: "dev@fintech.co",
        webhookUrl: "https://fintech.co/webhook",
        webhookSecret: "whsec_123",
        status: "ACTIVE",
      });
      expect(redisClient.set).toHaveBeenCalled();
      expect(next).toHaveBeenCalledTimes(1);
    });
  });

  describe("Idempotency Middleware", () => {
    const middleware = idempotency({ ttlSeconds: 86400 });

    it("should skip idempotency checks for non-mutating requests (e.g. GET)", async () => {
      const { req, res, next } = createMockReqRes({ method: "GET" });

      await middleware(req, res, next);

      expect(next).toHaveBeenCalledTimes(1);
      expect(redisClient.set).not.toHaveBeenCalled();
    });

    it("should return 400 if idempotency key header is missing", async () => {
      const { req, res, next } = createMockReqRes({ method: "POST" });
      req.header.mockReturnValue(undefined);

      await middleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.body).toEqual({
        error: "Missing required Idempotency-Key header",
      });
      expect(next).not.toHaveBeenCalled();
    });

    it("should return 500 if req.merchant is missing", async () => {
      const { req, res, next } = createMockReqRes({ method: "POST" });
      req.header.mockReturnValue("idem_key_1");
      req.merchant = undefined;

      await middleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.body.error).toContain("must run AFTER authenticateApiKey");
    });

    it("should acquire lock and call next() on first request", async () => {
      const { req, res, next } = createMockReqRes({ method: "POST" });
      req.header.mockReturnValue("idem_key_1");
      req.merchant = { _id: "m_123" };

      // Redis SET NX returns "OK" when acquired
      redisClient.set.mockResolvedValue("OK");

      await middleware(req, res, next);

      expect(next).toHaveBeenCalledTimes(1);
    });

    it("should return 409 Conflict if request is currently in-flight (PROCESSING)", async () => {
      const { req, res, next } = createMockReqRes({ method: "POST" });
      req.header.mockReturnValue("idem_key_in_flight");
      req.merchant = { _id: "m_123" };

      // Redis lock fails because key exists
      redisClient.set.mockResolvedValue(null);
      redisClient.get.mockResolvedValue(JSON.stringify({ state: "PROCESSING" }));

      await middleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(409);
      expect(res.body.error).toContain("currently in-flight");
      expect(next).not.toHaveBeenCalled();
    });

    it("should replay cached response if request was already COMPLETED", async () => {
      const { req, res, next } = createMockReqRes({ method: "POST" });
      req.header.mockReturnValue("idem_key_done");
      req.merchant = { _id: "m_123" };

      redisClient.set.mockResolvedValue(null);
      redisClient.get.mockResolvedValue(
        JSON.stringify({
          state: "COMPLETED",
          statusCode: 201,
          body: { paymentId: "pay_done_1" },
        })
      );

      await middleware(req, res, next);

      expect(res.setHeader).toHaveBeenCalledWith("x-idempotent-replay", "true");
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.body).toEqual({ paymentId: "pay_done_1" });
      expect(next).not.toHaveBeenCalled();
    });
  });

  describe("Error Handling Middleware", () => {
    it("notFoundHandler should return 404 with route info", () => {
      const { req, res } = createMockReqRes({
        method: "GET",
        originalUrl: "/v1/unknown",
      });

      notFoundHandler(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.body).toEqual({ error: "Route not found: GET /v1/unknown" });
    });

    it("errorHandler should format Mongoose ValidationError as 400", () => {
      const { req, res, next } = createMockReqRes();
      const valErr = {
        name: "ValidationError",
        message: "Validation failed",
        errors: {
          amount: { message: "Amount is required" },
        },
      };

      errorHandler(valErr, req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.body.error).toBe("Validation Error");
      expect(res.body.details).toContain("Amount is required");
    });

    it("errorHandler should handle SyntaxError malformed JSON as 400", () => {
      const { req, res, next } = createMockReqRes();
      const syntaxErr = new SyntaxError("Unexpected token in JSON");
      syntaxErr.status = 400;
      syntaxErr.body = "{ bad json ";

      errorHandler(syntaxErr, req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.body).toEqual({ error: "Malformed JSON in request body" });
    });
  });
});
