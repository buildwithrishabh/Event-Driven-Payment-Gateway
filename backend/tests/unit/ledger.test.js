import { describe, it, expect, beforeEach, vi } from "vitest";

// Mock LedgerEntry model before importing ledger.service
vi.mock("../../src/modules/ledger/ledger.model.js", () => ({
  LedgerEntry: {
    findOne: vi.fn(),
    create: vi.fn(),
    aggregate: vi.fn(),
    find: vi.fn(),
    countDocuments: vi.fn(),
  },
}));

import {
  recordCredit,
  recordDebit,
  getBalance,
  getLedgerEntries,
} from "../../src/modules/ledger/ledger.service.js";
import { LedgerEntry } from "../../src/modules/ledger/ledger.model.js";

describe("Ledger Engine Unit Tests", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("recordCredit", () => {
    it("should return existing credit entry if already recorded (idempotency)", async () => {
      const existingEntry = {
        _id: "ledger_entry_1",
        paymentId: "pay_123",
        type: "CREDIT",
        amount: 5000,
        currency: "INR",
      };

      LedgerEntry.findOne.mockResolvedValue(existingEntry);

      const result = await recordCredit({
        merchantId: "m_1",
        paymentId: "pay_123",
        amount: 5000,
        currency: "INR",
      });

      expect(result).toEqual(existingEntry);
      expect(LedgerEntry.findOne).toHaveBeenCalledWith({
        paymentId: "pay_123",
        type: "CREDIT",
      });
      expect(LedgerEntry.create).not.toHaveBeenCalled();
    });

    it("should create new credit entry when none exists", async () => {
      LedgerEntry.findOne.mockResolvedValue(null);

      const createdEntry = {
        _id: "ledger_entry_new",
        merchantId: "m_1",
        paymentId: "pay_456",
        type: "CREDIT",
        amount: 2500,
        currency: "INR",
        description: "Payment collected for pay_456",
      };

      LedgerEntry.create.mockResolvedValue(createdEntry);

      const result = await recordCredit({
        merchantId: "m_1",
        paymentId: "pay_456",
        amount: 2500,
        currency: "INR",
      });

      expect(result).toEqual(createdEntry);
      expect(LedgerEntry.create).toHaveBeenCalledWith({
        merchantId: "m_1",
        paymentId: "pay_456",
        type: "CREDIT",
        amount: 2500,
        currency: "INR",
        description: "Payment collected for pay_456",
      });
    });
  });

  describe("recordDebit", () => {
    it("should return existing debit entry if already recorded (idempotency)", async () => {
      const existingDebit = {
        _id: "ledger_debit_1",
        refundId: "ref_123",
        type: "DEBIT",
        amount: 1000,
      };

      LedgerEntry.findOne.mockResolvedValue(existingDebit);

      const result = await recordDebit({
        merchantId: "m_1",
        paymentId: "pay_123",
        refundId: "ref_123",
        amount: 1000,
        currency: "INR",
      });

      expect(result).toEqual(existingDebit);
      expect(LedgerEntry.findOne).toHaveBeenCalledWith({
        refundId: "ref_123",
        type: "DEBIT",
      });
      expect(LedgerEntry.create).not.toHaveBeenCalled();
    });

    it("should create new debit entry when none exists", async () => {
      LedgerEntry.findOne.mockResolvedValue(null);

      const newDebit = {
        _id: "ledger_debit_new",
        merchantId: "m_1",
        paymentId: "pay_123",
        refundId: "ref_456",
        type: "DEBIT",
        amount: 1500,
        currency: "INR",
        description: "Customer requested partial refund",
      };

      LedgerEntry.create.mockResolvedValue(newDebit);

      const result = await recordDebit({
        merchantId: "m_1",
        paymentId: "pay_123",
        refundId: "ref_456",
        amount: 1500,
        currency: "INR",
        description: "Customer requested partial refund",
      });

      expect(result).toEqual(newDebit);
      expect(LedgerEntry.create).toHaveBeenCalledWith({
        merchantId: "m_1",
        paymentId: "pay_123",
        refundId: "ref_456",
        type: "DEBIT",
        amount: 1500,
        currency: "INR",
        description: "Customer requested partial refund",
      });
    });
  });

  describe("getBalance", () => {
    it("should return aggregated balance when entries exist", async () => {
      const aggregateResult = [
        {
          currency: "INR",
          availableBalance: 8500,
          totalCredits: 10000,
          totalDebits: 1500,
        },
      ];

      LedgerEntry.aggregate.mockResolvedValue(aggregateResult);

      const balance = await getBalance("507f1f77bcf86cd799439011");

      expect(balance).toEqual(aggregateResult[0]);
      expect(LedgerEntry.aggregate).toHaveBeenCalledTimes(1);
    });

    it("should return fallback zero balance when no entries exist", async () => {
      LedgerEntry.aggregate.mockResolvedValue([]);

      const balance = await getBalance("507f1f77bcf86cd799439011");

      expect(balance).toEqual({
        currency: "INR",
        availableBalance: 0,
        totalCredits: 0,
        totalDebits: 0,
      });
    });
  });

  describe("getLedgerEntries pagination", () => {
    it("should calculate correct pagination metadata", async () => {
      const mockQueryChain = {
        populate: vi.fn().mockReturnThis(),
        sort: vi.fn().mockReturnThis(),
        skip: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        lean: vi.fn().mockResolvedValue([{ _id: "e1" }, { _id: "e2" }]),
      };

      LedgerEntry.find.mockReturnValue(mockQueryChain);
      LedgerEntry.countDocuments.mockResolvedValue(25);

      const result = await getLedgerEntries("m_1", { page: 2, limit: 10 });

      expect(result.pagination).toEqual({
        total: 25,
        page: 2,
        limit: 10,
        totalPages: 3,
      });
      expect(mockQueryChain.skip).toHaveBeenCalledWith(10);
      expect(mockQueryChain.limit).toHaveBeenCalledWith(10);
    });
  });
});
