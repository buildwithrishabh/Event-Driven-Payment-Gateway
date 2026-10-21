import { describe, it, expect, beforeEach, vi } from "vitest";

const { mockSession } = vi.hoisted(() => ({
  mockSession: {
    startTransaction: vi.fn(),
    commitTransaction: vi.fn(),
    abortTransaction: vi.fn(),
    endSession: vi.fn(),
  },
}));

vi.mock("mongoose", () => ({
  default: {
    startSession: vi.fn().mockResolvedValue(mockSession),
    Types: {
      ObjectId: {
        isValid: vi.fn().mockReturnValue(true),
      },
    },
  },
}));

vi.mock("../../src/modules/payments/payment.model.js", () => ({
  Payment: {
    findOne: vi.fn(),
    findOneAndUpdate: vi.fn(),
  },
}));

vi.mock("../../src/modules/refunds/refund.model.js", () => ({
  Refund: {
    create: vi.fn(),
    findOne: vi.fn(),
    find: vi.fn(),
  },
}));

vi.mock("../../src/modules/payments/outbox.model.js", () => ({
  OutboxEvent: {
    create: vi.fn(),
  },
}));

vi.mock("../../src/queues/refund.queue.js", () => ({
  refundQueue: {
    add: vi.fn().mockResolvedValue({ id: "job_123" }),
  },
}));

vi.mock("../../src/config/logger.js", () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

import { createRefund } from "../../src/modules/refunds/refund.service.js";
import { Payment } from "../../src/modules/payments/payment.model.js";
import { Refund } from "../../src/modules/refunds/refund.model.js";
import { OutboxEvent } from "../../src/modules/payments/outbox.model.js";
import { refundQueue } from "../../src/queues/refund.queue.js";

describe("Refund Service Unit Tests", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("createRefund validations", () => {
    it("should throw 404 if payment does not exist", async () => {
      Payment.findOne.mockResolvedValue(null);

      await expect(
        createRefund({
          merchantId: "m_1",
          paymentId: "p_non_existent",
          amount: 500,
        })
      ).rejects.toMatchObject({
        statusCode: 404,
        message: "Payment not found",
      });
    });

    it("should throw 400 if payment status is not SUCCEEDED", async () => {
      Payment.findOne.mockResolvedValue({
        _id: "p_1",
        merchantId: "m_1",
        status: "PENDING",
      });

      await expect(
        createRefund({
          merchantId: "m_1",
          paymentId: "p_1",
          amount: 500,
        })
      ).rejects.toMatchObject({
        statusCode: 400,
        message: expect.stringContaining("Cannot refund payment with status: PENDING"),
      });
    });

    it("should throw 400 if payment lacks an upstream processorPaymentId", async () => {
      Payment.findOne.mockResolvedValue({
        _id: "p_1",
        merchantId: "m_1",
        status: "SUCCEEDED",
        amount: 1000,
        refundedAmount: 0,
        razorpayPaymentId: null,
        processorPaymentId: null,
      });

      await expect(
        createRefund({
          merchantId: "m_1",
          paymentId: "p_1",
          amount: 500,
        })
      ).rejects.toMatchObject({
        statusCode: 400,
        message: expect.stringContaining("upstream processor transaction ID"),
      });
    });

    it("should throw 400 if refund amount is zero or negative", async () => {
      Payment.findOne.mockResolvedValue({
        _id: "p_1",
        merchantId: "m_1",
        status: "SUCCEEDED",
        amount: 1000,
        refundedAmount: 1000,
        razorpayPaymentId: "pay_rzp_123",
      });

      await expect(
        createRefund({
          merchantId: "m_1",
          paymentId: "p_1",
          amount: 0,
        })
      ).rejects.toMatchObject({
        statusCode: 400,
        message: "Refund amount must be greater than zero.",
      });
    });

    it("should throw 400 and abort transaction if refund amount exceeds available balance", async () => {
      Payment.findOne.mockResolvedValue({
        _id: "p_1",
        merchantId: "m_1",
        status: "SUCCEEDED",
        amount: 1000,
        refundedAmount: 800,
        razorpayPaymentId: "pay_rzp_123",
      });

      // Atomic conditional update returns null when condition fails
      Payment.findOneAndUpdate.mockResolvedValue(null);

      await expect(
        createRefund({
          merchantId: "m_1",
          paymentId: "p_1",
          amount: 500,
        })
      ).rejects.toMatchObject({
        statusCode: 400,
        message: expect.stringContaining("Refund amount exceeds remaining refundable balance"),
      });

      expect(mockSession.abortTransaction).toHaveBeenCalledTimes(1);
      expect(mockSession.endSession).toHaveBeenCalledTimes(1);
    });
  });

  describe("createRefund successful processing", () => {
    it("should complete partial refund, create outbox event, and enqueue worker job", async () => {
      const mockPayment = {
        _id: "p_100",
        merchantId: "m_1",
        status: "SUCCEEDED",
        amount: 2000,
        refundedAmount: 0,
        currency: "INR",
        razorpayPaymentId: "pay_rzp_100",
      };

      Payment.findOne.mockResolvedValue(mockPayment);

      const updatedPaymentMock = {
        ...mockPayment,
        refundedAmount: 500,
        refundStatus: "PARTIAL",
        save: vi.fn().mockResolvedValue(true),
      };
      Payment.findOneAndUpdate.mockResolvedValue(updatedPaymentMock);

      const createdRefund = {
        _id: "ref_100",
        merchantId: "m_1",
        paymentId: "p_100",
        processorPaymentId: "pay_rzp_100",
        amount: 500,
        currency: "INR",
        status: "PENDING",
      };
      Refund.create.mockResolvedValue([createdRefund]);
      OutboxEvent.create.mockResolvedValue([{ _id: "outbox_1" }]);

      const result = await createRefund({
        merchantId: "m_1",
        paymentId: "p_100",
        amount: 500,
        reason: "Customer dissatisfaction",
      });

      expect(result).toEqual(createdRefund);
      expect(mockSession.commitTransaction).toHaveBeenCalledTimes(1);
      expect(OutboxEvent.create).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            aggregateType: "REFUND",
            eventType: "REFUND_CREATED",
          }),
        ]),
        { session: mockSession }
      );
      expect(refundQueue.add).toHaveBeenCalledWith(
        "process-refund",
        { refundId: "ref_100" },
        { jobId: "refund_ref_100" }
      );
      expect(mockSession.endSession).toHaveBeenCalledTimes(1);
    });
  });
});
