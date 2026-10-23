import { describe, it, expect, vi } from "vitest";
import { z } from "zod";
import { validate } from "../../src/middleware/validate.middleware.js";
import { errorHandler } from "../../src/middleware/error.middleware.js";
import {
  objectIdSchema,
  paginationQuerySchema,
  registerMerchantSchema,
  createPaymentSchema,
  verifyPaymentSchema,
  getPaymentByIdSchema,
  listPaymentsQuerySchema,
  createRefundSchema,
  getRefundByIdSchema,
  listRefundsQuerySchema,
} from "../../src/validations/index.js";

function createMockReqRes(overrides = {}) {
  const req = {
    method: "POST",
    headers: {},
    body: {},
    query: {},
    params: {},
    header: vi.fn(),
    ...overrides,
  };

  const res = {
    statusCode: 200,
    body: null,
    status: vi.fn().mockImplementation(function (code) {
      this.statusCode = code;
      return this;
    }),
    json: vi.fn().mockImplementation(function (data) {
      this.body = data;
      return this;
    }),
  };

  const next = vi.fn();
  return { req, res, next };
}

describe("Zod Validation Middleware & Schemas Unit Tests", () => {
  describe("validate() Middleware", () => {
    const testSchema = z.object({
      body: z.object({
        amount: z.number().int().min(100),
        email: z.string().email(),
      }),
      query: z.object({
        page: z.coerce.number().int().min(1).default(1),
      }),
      params: z.object({
        id: objectIdSchema,
      }),
    });

    it("should call next() and assign parsed data when input is valid", async () => {
      const { req, res, next } = createMockReqRes({
        body: { amount: 500, email: "user@example.com", maliciousExtra: "hack" },
        query: { page: "3" },
        params: { id: "507f1f77bcf86cd799439011" },
      });

      const middleware = validate(testSchema);
      await middleware(req, res, next);

      expect(next).toHaveBeenCalledTimes(1);
      expect(res.status).not.toHaveBeenCalled();
      // Sanitized: maliciousExtra should be stripped
      expect(req.body).toEqual({ amount: 500, email: "user@example.com" });
      // Coerced: page string "3" converted to number 3
      expect(req.query.page).toBe(3);
      expect(req.params.id).toBe("507f1f77bcf86cd799439011");
    });

    it("should return 400 with structured field errors when validation fails", async () => {
      const { req, res, next } = createMockReqRes({
        body: { amount: 50, email: "not-an-email" },
        params: { id: "invalid-id" },
      });

      const middleware = validate(testSchema);
      await middleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.body.error).toBe("Validation Error");
      expect(Array.isArray(res.body.details)).toBe(true);

      const fields = res.body.details.map((d) => d.field);
      expect(fields).toContain("amount");
      expect(fields).toContain("email");
      expect(fields).toContain("id");
      expect(next).not.toHaveBeenCalled();
    });

    it("should return 400 when body is missing required fields", async () => {
      const { req, res, next } = createMockReqRes({
        body: {},
        params: { id: "507f1f77bcf86cd799439011" },
      });

      const middleware = validate(testSchema);
      await middleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.body.error).toBe("Validation Error");
      expect(next).not.toHaveBeenCalled();
    });
  });

  describe("ObjectId Schema", () => {
    it("should accept valid 24-char hex strings", async () => {
      const validId = "507f1f77bcf86cd799439011";
      await expect(objectIdSchema.parseAsync(validId)).resolves.toBe(validId);
    });

    it("should reject non-hex or invalid length strings", async () => {
      await expect(objectIdSchema.parseAsync("short")).rejects.toThrow();
      await expect(objectIdSchema.parseAsync("507f1f77bcf86cd7994390zz")).rejects.toThrow();
      await expect(objectIdSchema.parseAsync("507f1f77bcf86cd7994390112233")).rejects.toThrow();
    });
  });

  describe("Payment Schemas", () => {
    it("createPaymentSchema: should validate amount >= 100, normalize currency to uppercase", async () => {
      const parsed = await createPaymentSchema.parseAsync({
        body: {
          amount: 2500,
          customerEmail: "pay@customer.com",
          currency: "inr",
        },
      });

      expect(parsed.body.amount).toBe(2500);
      expect(parsed.body.currency).toBe("INR");
      expect(parsed.body.customerEmail).toBe("pay@customer.com");
    });

    it("createPaymentSchema: should reject amount < 100 or non-integer", async () => {
      await expect(
        createPaymentSchema.parseAsync({
          body: { amount: 99, customerEmail: "pay@customer.com" },
        })
      ).rejects.toThrow();

      await expect(
        createPaymentSchema.parseAsync({
          body: { amount: 150.5, customerEmail: "pay@customer.com" },
        })
      ).rejects.toThrow();
    });

    it("verifyPaymentSchema: should require all 4 verification fields", async () => {
      const valid = {
        body: {
          paymentId: "507f1f77bcf86cd799439011",
          razorpayOrderId: "order_123",
          razorpayPaymentId: "pay_456",
          razorpaySignature: "sig_abc",
        },
      };

      await expect(verifyPaymentSchema.parseAsync(valid)).resolves.toBeDefined();

      const invalid = {
        body: {
          paymentId: "507f1f77bcf86cd799439011",
          razorpayOrderId: "order_123",
          // missing razorpayPaymentId and signature
        },
      };

      await expect(verifyPaymentSchema.parseAsync(invalid)).rejects.toThrow();
    });

    it("getPaymentByIdSchema: should validate params.id as ObjectId", async () => {
      await expect(
        getPaymentByIdSchema.parseAsync({
          params: { id: "507f1f77bcf86cd799439011" },
        })
      ).resolves.toBeDefined();

      await expect(
        getPaymentByIdSchema.parseAsync({
          params: { id: "invalid_id" },
        })
      ).rejects.toThrow();
    });

    it("listPaymentsQuerySchema: should coerce pagination and validate status enum", async () => {
      const parsed = await listPaymentsQuerySchema.parseAsync({
        query: {
          status: "SUCCEEDED",
          page: "2",
          limit: "15",
          search: "test@domain.com",
        },
      });

      expect(parsed.query.status).toBe("SUCCEEDED");
      expect(parsed.query.page).toBe(2);
      expect(parsed.query.limit).toBe(15);
      expect(parsed.query.search).toBe("test@domain.com");
    });
  });

  describe("Merchant Schemas", () => {
    it("registerMerchantSchema: should accept valid name, email, and optional webhookUrl", async () => {
      const parsed = await registerMerchantSchema.parseAsync({
        body: {
          name: "Acme Corp",
          email: "merchant@acme.com",
          webhookUrl: "https://api.acme.com/webhook",
        },
      });

      expect(parsed.body.name).toBe("Acme Corp");
      expect(parsed.body.email).toBe("merchant@acme.com");
      expect(parsed.body.webhookUrl).toBe("https://api.acme.com/webhook");
    });

    it("registerMerchantSchema: should reject invalid email format", async () => {
      await expect(
        registerMerchantSchema.parseAsync({
          body: {
            name: "Acme Corp",
            email: "invalid-email-address",
          },
        })
      ).rejects.toThrow();
    });
  });

  describe("Refund Schemas", () => {
    it("createRefundSchema: should accept valid paymentId and positive integer amount", async () => {
      const parsed = await createRefundSchema.parseAsync({
        body: {
          paymentId: "507f1f77bcf86cd799439011",
          amount: 500,
          reason: "Customer request",
        },
      });

      expect(parsed.body.paymentId).toBe("507f1f77bcf86cd799439011");
      expect(parsed.body.amount).toBe(500);
      expect(parsed.body.reason).toBe("Customer request");
    });

    it("createRefundSchema: should reject amount <= 0", async () => {
      await expect(
        createRefundSchema.parseAsync({
          body: {
            paymentId: "507f1f77bcf86cd799439011",
            amount: 0,
          },
        })
      ).rejects.toThrow();
    });

    it("listRefundsQuerySchema: should validate refund status enum", async () => {
      await expect(
        listRefundsQuerySchema.parseAsync({
          query: { status: "PROCESSED" },
        })
      ).resolves.toBeDefined();

      await expect(
        listRefundsQuerySchema.parseAsync({
          query: { status: "INVALID_STATUS" },
        })
      ).rejects.toThrow();
    });
  });

  describe("Pagination Schema", () => {
    it("should clamp or reject limit > 50 and page < 1", async () => {
      await expect(
        paginationQuerySchema.parseAsync({ page: "0" })
      ).rejects.toThrow();

      await expect(
        paginationQuerySchema.parseAsync({ limit: "100" })
      ).rejects.toThrow();
    });

    it("should use defaults (page 1, limit 20) when empty", async () => {
      const parsed = await paginationQuerySchema.parseAsync({});
      expect(parsed.page).toBe(1);
      expect(parsed.limit).toBe(20);
    });
  });

  describe("Central Error Handler with ZodError", () => {
    it("should format ZodError as 400 with details", () => {
      const { req, res, next } = createMockReqRes();

      try {
        createPaymentSchema.parse({
          body: { amount: 10, customerEmail: "invalid" },
        });
      } catch (zodErr) {
        errorHandler(zodErr, req, res, next);
        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.body.error).toBe("Validation Error");
        expect(Array.isArray(res.body.details)).toBe(true);
        expect(res.body.details.length).toBeGreaterThan(0);
      }
    });
  });
});
