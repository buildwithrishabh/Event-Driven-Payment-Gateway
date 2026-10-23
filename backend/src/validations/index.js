import { z } from "zod";

/**
 * Common regex pattern for 24-character hexadecimal MongoDB ObjectIds
 */
export const OBJECT_ID_REGEX = /^[0-9a-fA-F]{24}$/;

export const objectIdSchema = z
  .string({ required_error: "ID is required" })
  .trim()
  .regex(OBJECT_ID_REGEX, "Invalid ID format: must be a 24-character hex string");

/**
 * Reusable Pagination Schema (for query params)
 */
export const paginationQuerySchema = z.object({
  page: z.coerce.number().int().min(1, "page must be >= 1").default(1),
  limit: z.coerce.number().int().min(1, "limit must be >= 1").max(50, "limit must be <= 50").default(20),
});

/* ==========================================================================
   1. MERCHANT MODULE SCHEMAS
   ========================================================================== */

export const registerMerchantSchema = z.object({
  body: z.object({
    name: z
      .string({ required_error: "name is required" })
      .trim()
      .min(2, "name must be at least 2 characters")
      .max(100, "name cannot exceed 100 characters"),
    email: z
      .string({ required_error: "email is required" })
      .trim()
      .email("Invalid email format"),
    webhookUrl: z
      .string()
      .trim()
      .url("Invalid webhook URL format")
      .optional()
      .or(z.literal("")),
  }),
});

/* ==========================================================================
   2. PAYMENT MODULE SCHEMAS
   ========================================================================== */

export const createPaymentSchema = z.object({
  body: z.object({
    amount: z
      .number({ required_error: "amount is required" })
      .int("amount must be an integer minor units (e.g., 100 paise = 1 INR)")
      .min(100, "amount is required, must be a number, and minimum 100 minor units (e.g., 100 paise = 1 INR)"),
    currency: z
      .string()
      .trim()
      .length(3, "currency must be a 3-letter ISO code")
      .default("INR")
      .transform((val) => val.toUpperCase()),
    customerName: z
      .string({ required_error: "customerName is required" })
      .trim()
      .min(2, "customerName must be at least 2 characters")
      .max(100, "customerName cannot exceed 100 characters"),
    customerEmail: z
      .string({ required_error: "customerEmail is required" })
      .trim()
      .email("Invalid customer email address"),
    customerPhone: z
      .string()
      .trim()
      .optional()
      .nullable(),
  }),
});

export const verifyPaymentSchema = z.object({
  body: z.object({
    paymentId: objectIdSchema,
    razorpayOrderId: z
      .string({ required_error: "razorpayOrderId is required" })
      .trim()
      .min(1, "razorpayOrderId is required"),
    razorpayPaymentId: z
      .string({ required_error: "razorpayPaymentId is required" })
      .trim()
      .min(1, "razorpayPaymentId is required"),
    razorpaySignature: z
      .string({ required_error: "razorpaySignature is required" })
      .trim()
      .min(1, "razorpaySignature is required"),
  }),
});

export const getPaymentByIdSchema = z.object({
  params: z.object({
    id: objectIdSchema,
  }),
});

export const listPaymentsQuerySchema = z.object({
  query: z.object({
    status: z
      .enum(["CREATED", "PROCESSING", "SUCCEEDED", "FAILED"])
      .optional(),
    search: z.string().trim().optional(),
    page: z.coerce.number().int().min(1, "page must be >= 1").default(1),
    limit: z.coerce.number().int().min(1, "limit must be >= 1").max(50, "limit must be <= 50").default(20),
  }),
});

/* ==========================================================================
   3. REFUND MODULE SCHEMAS
   ========================================================================== */

export const createRefundSchema = z.object({
  body: z.object({
    paymentId: objectIdSchema,
    amount: z
      .number()
      .int("amount must be an integer")
      .min(1, "Refund amount must be greater than zero.")
      .optional(),
    reason: z
      .string()
      .trim()
      .max(500, "reason cannot exceed 500 characters")
      .optional(),
  }),
});

export const getRefundByIdSchema = z.object({
  params: z.object({
    id: z
      .string({ required_error: "Refund ID is required" })
      .trim()
      .min(1, "Refund ID cannot be empty")
      .max(100, "Refund ID is too long"),
  }),
});

export const listPaymentRefundsSchema = z.object({
  params: z.object({
    paymentId: objectIdSchema,
  }),
});

export const listRefundsQuerySchema = z.object({
  query: z.object({
    status: z
      .enum(["PENDING", "PROCESSING", "SUCCEEDED", "FAILED"])
      .optional(),
    search: z.string().trim().optional(),
    page: z.coerce.number().int().min(1, "page must be >= 1").default(1),
    limit: z.coerce.number().int().min(1, "limit must be >= 1").max(50, "limit must be <= 50").default(20),
  }),
});

/* ==========================================================================
   4. LEDGER MODULE SCHEMAS
   ========================================================================== */

export const listLedgerEntriesQuerySchema = z.object({
  query: paginationQuerySchema,
});

/* ==========================================================================
   5. CHECKOUT MODULE SCHEMAS
   ========================================================================== */

export const getCheckoutSessionSchema = z.object({
  params: z.object({
    id: objectIdSchema,
  }),
});

export const verifyCheckoutSchema = z.object({
  body: z.object({
    paymentId: objectIdSchema,
    razorpayOrderId: z
      .string({ required_error: "razorpayOrderId is required" })
      .trim()
      .min(1, "razorpayOrderId is required"),
    razorpayPaymentId: z
      .string({ required_error: "razorpayPaymentId is required" })
      .trim()
      .min(1, "razorpayPaymentId is required"),
    razorpaySignature: z
      .string({ required_error: "razorpaySignature is required" })
      .trim()
      .min(1, "razorpaySignature is required"),
  }),
});
