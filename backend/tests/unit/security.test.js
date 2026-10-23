import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import crypto from "crypto";
import { hashKey } from "../../src/modules/merchants/merchant.controller.js";
import { verifyPaymentSignature } from "../../src/modules/processors/razorpay.processor.js";

describe("Security & Signature Verification Unit Tests", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv, RAZORPAY_KEY_SECRET: "test_secret_123" };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe("API Key Hashing (hashKey)", () => {
    it("should generate a consistent SHA-256 hex digest for a given raw key", () => {
      const rawKey = "key_live_abcdef123456";
      const expectedHash = crypto
        .createHash("sha256")
        .update(rawKey)
        .digest("hex");

      const result = hashKey(rawKey);

      expect(result).toBe(expectedHash);
      expect(result).toHaveLength(64);
    });

    it("should generate distinct hashes for different raw keys", () => {
      const hashA = hashKey("key_merchant_A");
      const hashB = hashKey("key_merchant_B");

      expect(hashA).not.toBe(hashB);
    });
  });

  describe("Razorpay Payment Signature Verification (verifyPaymentSignature)", () => {
    it("should return true when signature matches HMAC SHA-256 digest", () => {
      const orderId = "order_xyz123";
      const paymentId = "pay_abc456";
      const text = `${orderId}|${paymentId}`;
      const validSignature = crypto
        .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
        .update(text)
        .digest("hex");

      const isValid = verifyPaymentSignature({
        orderId,
        paymentId,
        signature: validSignature,
      });

      expect(isValid).toBe(true);
    });

    it("should return false when signature is invalid or tampered with", () => {
      const orderId = "order_xyz123";
      const paymentId = "pay_abc456";
      const invalidSignature = "invalid_tampered_signature_hex";

      const isValid = verifyPaymentSignature({
        orderId,
        paymentId,
        signature: invalidSignature,
      });

      expect(isValid).toBe(false);
    });

    it("should return false if orderId does not match the signature payload", () => {
      const orderId = "order_xyz123";
      const paymentId = "pay_abc456";
      const validSignature = crypto
        .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
        .update(`${orderId}|${paymentId}`)
        .digest("hex");

      const isValid = verifyPaymentSignature({
        orderId: "order_different789",
        paymentId,
        signature: validSignature,
      });

      expect(isValid).toBe(false);
    });
  });

  describe("SSRF Webhook Validation (validateWebhookUrl & isPrivateOrReservedIP)", () => {
    it("should identify private and link-local IP addresses", async () => {
      const { isPrivateOrReservedIP } = await import(
        "../../src/utils/ssrfValidator.js"
      );

      expect(isPrivateOrReservedIP("127.0.0.1")).toBe(true);
      expect(isPrivateOrReservedIP("10.0.0.5")).toBe(true);
      expect(isPrivateOrReservedIP("172.16.0.1")).toBe(true);
      expect(isPrivateOrReservedIP("192.168.1.100")).toBe(true);
      expect(isPrivateOrReservedIP("169.254.169.254")).toBe(true);
      expect(isPrivateOrReservedIP("8.8.8.8")).toBe(false);
      expect(isPrivateOrReservedIP("104.26.14.234")).toBe(false);
    });

    it("should reject localhost and internal hostnames", async () => {
      const { validateWebhookUrl } = await import(
        "../../src/utils/ssrfValidator.js"
      );

      await expect(
        validateWebhookUrl("http://localhost/webhook"),
      ).rejects.toThrow(/Local\/Internal hostnames/);
      await expect(
        validateWebhookUrl("http://service.local/api"),
      ).rejects.toThrow(/Local\/Internal hostnames/);
      await expect(
        validateWebhookUrl("http://db.internal/api"),
      ).rejects.toThrow(/Local\/Internal hostnames/);
    });

    it("should reject private and cloud metadata IP addresses", async () => {
      const { validateWebhookUrl } = await import(
        "../../src/utils/ssrfValidator.js"
      );

      await expect(
        validateWebhookUrl("http://127.0.0.1:8000/webhook"),
      ).rejects.toThrow(/Private or loopback IP/);
      await expect(
        validateWebhookUrl("http://169.254.169.254/latest/meta-data/"),
      ).rejects.toThrow(/Private or loopback IP/);
      await expect(
        validateWebhookUrl("http://10.0.0.1/hook"),
      ).rejects.toThrow(/Private or loopback IP/);
    });

    it("should reject invalid protocols and URLs with embedded credentials", async () => {
      const { validateWebhookUrl } = await import(
        "../../src/utils/ssrfValidator.js"
      );

      await expect(
        validateWebhookUrl("ftp://example.com/webhook"),
      ).rejects.toThrow(/Invalid protocol/);
      await expect(
        validateWebhookUrl("https://admin:secret@webhook.site/test"),
      ).rejects.toThrow(/Credentials in webhook URL are forbidden/);
    });
  });
});
