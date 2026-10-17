import { useState, useEffect } from "react";
import {
  RotateCcw,
  X,
  AlertCircle,
  CheckCircle2,
  HelpCircle,
  RefreshCw,
  ShieldCheck,
  CreditCard,
} from "lucide-react";
import { createRefund } from "../../lib/api.js";
import { formatMoney, generateIdempotencyKey, shortId, toMinorUnits } from "../../lib/format.js";
import { useAuth } from "../../context/AuthContext.jsx";
import { useToast } from "../../context/ToastContext.jsx";
import Button from "../ui/Button.jsx";
import Input from "../ui/Input.jsx";
import Select from "../ui/Select.jsx";

const PRESET_REASONS = [
  { value: "requested_by_customer", label: "Customer requested return / refund" },
  { value: "duplicate_charge", label: "Duplicate transaction" },
  { value: "fraudulent", label: "Fraudulent or unauthorized transaction" },
  { value: "product_dissatisfaction", label: "Product or service dissatisfaction" },
  { value: "other", label: "Other / Custom reason" },
];

export default function RefundModal({
  isOpen,
  onClose,
  payment = null,
  onSuccess,
}) {
  const { apiKey } = useAuth();
  const toast = useToast();

  const [paymentId, setPaymentId] = useState("");
  const [refundMode, setRefundMode] = useState("full"); // "full" or "partial"
  const [customAmount, setCustomAmount] = useState("");
  const [reasonCategory, setReasonCategory] = useState("requested_by_customer");
  const [customNote, setCustomNote] = useState("");
  const [idempotencyKey, setIdempotencyKey] = useState(() => generateIdempotencyKey("rfn"));
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState({});

  // Reset or initialize state whenever modal opens or payment changes
  useEffect(() => {
    if (isOpen) {
      const activeId = payment?.paymentId || payment?._id || "";
      setPaymentId(activeId);
      setRefundMode("full");
      setCustomAmount("");
      setReasonCategory("requested_by_customer");
      setCustomNote("");
      setIdempotencyKey(generateIdempotencyKey("rfn"));
      setErrors({});
    }
  }, [isOpen, payment]);

  // Close on Escape key
  useEffect(() => {
    function handleKeyDown(e) {
      if (e.key === "Escape" && isOpen && !submitting) {
        onClose();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, submitting, onClose]);

  if (!isOpen) return null;

  const totalAmount = payment?.amount || 0;
  const refundedAmount = payment?.refundedAmount || 0;
  const currency = payment?.currency || "INR";
  const remainingRefundable = Math.max(0, totalAmount - refundedAmount);

  // Remaining refundable in major units (for placeholder / presets)
  const remainingMajor = (remainingRefundable / 100).toFixed(2);

  // Calculate refund amount in minor units
  const minorAmount =
    refundMode === "full"
      ? remainingRefundable
      : toMinorUnits(customAmount, currency);

  function handlePresetPercent(percent) {
    setRefundMode("partial");
    const amountInMinor = Math.round((remainingRefundable * percent) / 100);
    setCustomAmount((amountInMinor / 100).toFixed(2));
    setErrors((prev) => ({ ...prev, amount: undefined }));
  }

  function validate() {
    const nextErrors = {};

    const targetId = (paymentId || payment?._id || payment?.paymentId || "").trim();
    if (!targetId) {
      nextErrors.paymentId = "Payment ID is required.";
    }

    if (payment && payment.status !== "SUCCEEDED") {
      nextErrors.general = `Cannot refund payment with status: ${payment.status}. Only SUCCEEDED payments can be refunded.`;
    }

    if (payment && remainingRefundable <= 0) {
      nextErrors.general = "This payment has already been fully refunded.";
    }

    if (refundMode === "partial") {
      if (!customAmount || isNaN(Number(customAmount)) || Number(customAmount) <= 0) {
        nextErrors.amount = "Please enter a valid refund amount.";
      } else if (!Number.isFinite(minorAmount) || minorAmount <= 0) {
        nextErrors.amount = "Refund amount must be greater than zero.";
      } else if (payment && minorAmount > remainingRefundable) {
        nextErrors.amount = `Amount cannot exceed remaining refundable balance (${formatMoney(remainingRefundable, currency)}).`;
      }
    }

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!validate() || submitting) return;

    setSubmitting(true);
    try {
      const finalPaymentId = (paymentId || payment?._id || payment?.paymentId || "").trim();
      const finalReason =
        reasonCategory === "other"
          ? customNote.trim() || "other"
          : customNote.trim()
          ? `${reasonCategory}: ${customNote.trim()}`
          : reasonCategory;

      const payload = {
        paymentId: finalPaymentId,
        ...(refundMode === "partial" ? { amount: minorAmount } : payment ? { amount: remainingRefundable } : {}),
        reason: finalReason,
      };

      const { data, idempotentReplay } = await createRefund(
        payload,
        apiKey,
        idempotencyKey
      );

      if (idempotentReplay) {
        toast.warning(
          "Existing refund replayed",
          `Refund ${shortId(data.refund?._id || data._id)} was already initiated.`
        );
      } else {
        toast.success(
          "Refund initiated",
          `Successfully enqueued refund of ${formatMoney(minorAmount, currency)}.`
        );
      }

      if (onSuccess) {
        onSuccess(data.refund || data);
      }
      onClose();
    } catch (err) {
      setErrors((prev) => ({
        ...prev,
        general: err.message || "Failed to initiate refund.",
      }));
      toast.error("Refund failed", err.message || "An error occurred.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto p-4 sm:p-6 md:p-10 flex items-center justify-center animate-fade-in">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-ink-950/50 backdrop-blur-xs transition-opacity"
        onClick={() => {
          if (!submitting) onClose();
        }}
        aria-hidden="true"
      />

      {/* Modal Dialog */}
      <div className="relative w-full max-w-lg overflow-hidden rounded-2xl border border-ink-200 bg-white shadow-2xl transition-all">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-ink-100 px-6 py-4 bg-ink-50/40">
          <div className="flex items-center gap-2.5">
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-rose-50 text-rose-600 border border-rose-200">
              <RotateCcw className="h-4 w-4" />
            </span>
            <div>
              <h2 className="text-base font-bold text-ink-950">Issue Refund</h2>
              <p className="text-xs text-ink-500">
                Reverse captured funds and credit ledger accounts.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="rounded-lg p-1.5 text-ink-400 hover:bg-ink-100 hover:text-ink-700 transition"
            aria-label="Close modal"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {/* General Error Banner */}
          {errors.general && (
            <div className="flex items-start gap-2.5 rounded-xl border border-rose-200 bg-rose-50/70 p-3.5 text-xs text-rose-800">
              <AlertCircle className="h-4 w-4 shrink-0 text-rose-600 mt-0.5" />
              <div className="flex-1">{errors.general}</div>
            </div>
          )}

          {/* Payment Context Card */}
          {payment ? (
            <div className="rounded-xl border border-ink-200/80 bg-ink-50/60 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-ink-600">Target Payment</span>
                <span className="font-mono text-xs font-medium text-ink-800">
                  {shortId(payment.paymentId || payment._id)}
                </span>
              </div>
              <div className="grid grid-cols-3 gap-2 border-t border-ink-200/60 pt-2.5 text-xs">
                <div>
                  <p className="text-[11px] text-ink-400">Total Charged</p>
                  <p className="font-semibold text-ink-900">
                    {formatMoney(totalAmount, currency)}
                  </p>
                </div>
                <div>
                  <p className="text-[11px] text-ink-400">Refunded</p>
                  <p className="font-semibold text-ink-700">
                    {formatMoney(refundedAmount, currency)}
                  </p>
                </div>
                <div>
                  <p className="text-[11px] text-emerald-700 font-medium">Refundable</p>
                  <p className="font-bold text-emerald-800">
                    {formatMoney(remainingRefundable, currency)}
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <Input
              label="Payment ID"
              placeholder="e.g. 671146869b8fa588ca752f92"
              value={paymentId}
              onChange={(e) => {
                setPaymentId(e.target.value);
                setErrors((prev) => ({ ...prev, paymentId: undefined }));
              }}
              error={errors.paymentId}
              required
            />
          )}

          {/* Refund Type Selection */}
          <div className="space-y-2">
            <label className="block text-xs font-semibold text-ink-700">
              Refund Amount
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => {
                  setRefundMode("full");
                  setErrors((prev) => ({ ...prev, amount: undefined }));
                }}
                className={`flex flex-col items-start rounded-xl border p-3 text-left transition ${
                  refundMode === "full"
                    ? "border-brand-500 bg-brand-50/50 ring-2 ring-brand-500/20"
                    : "border-ink-200 hover:border-ink-300 hover:bg-ink-50/50"
                }`}
              >
                <span className="text-xs font-bold text-ink-900">Full Refund</span>
                <span className="mt-0.5 text-[11px] text-ink-500">
                  {payment ? formatMoney(remainingRefundable, currency) : "Entire remaining balance"}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setRefundMode("partial")}
                className={`flex flex-col items-start rounded-xl border p-3 text-left transition ${
                  refundMode === "partial"
                    ? "border-brand-500 bg-brand-50/50 ring-2 ring-brand-500/20"
                    : "border-ink-200 hover:border-ink-300 hover:bg-ink-50/50"
                }`}
              >
                <span className="text-xs font-bold text-ink-900">Partial Refund</span>
                <span className="mt-0.5 text-[11px] text-ink-500">
                  Specify custom amount
                </span>
              </button>
            </div>
          </div>

          {/* Partial Amount Input & Quick Chips */}
          {refundMode === "partial" && (
            <div className="space-y-2.5 rounded-xl border border-ink-200/80 bg-ink-50/40 p-3.5">
              <Input
                label={`Amount to refund (${currency})`}
                type="number"
                inputMode="decimal"
                min="0.01"
                step="0.01"
                placeholder={remainingMajor}
                value={customAmount}
                onChange={(e) => {
                  setCustomAmount(e.target.value);
                  setErrors((prev) => ({ ...prev, amount: undefined }));
                }}
                error={errors.amount}
                required
              />

              {payment && remainingRefundable > 0 && (
                <div className="flex items-center gap-1.5 pt-1">
                  <span className="text-[11px] font-medium text-ink-400 mr-1">Presets:</span>
                  {[25, 50, 75, 100].map((pct) => (
                    <button
                      key={pct}
                      type="button"
                      onClick={() => handlePresetPercent(pct)}
                      className="rounded-lg border border-ink-200 bg-white px-2 py-0.5 text-[11px] font-semibold text-ink-700 hover:bg-ink-50 hover:border-ink-300 transition"
                    >
                      {pct === 100 ? "Max" : `${pct}%`}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Reason Selection */}
          <div className="space-y-3">
            <Select
              label="Reason for refund"
              value={reasonCategory}
              onChange={(e) => setReasonCategory(e.target.value)}
            >
              {PRESET_REASONS.map((r) => (
                <option key={r.value} value={r.value}>
                  {r.label}
                </option>
              ))}
            </Select>

            <Input
              label="Notes or memo (optional)"
              placeholder="e.g. Customer returned damaged parcel on Oct 17"
              value={customNote}
              onChange={(e) => setCustomNote(e.target.value)}
            />
          </div>

          {/* Idempotency Protection Collapsible */}
          <details className="group rounded-xl border border-ink-200/80 bg-ink-50/40 p-3 text-xs">
            <summary className="flex cursor-pointer items-center justify-between font-semibold text-ink-600 select-none">
              <span className="flex items-center gap-1.5">
                <ShieldCheck className="h-3.5 w-3.5 text-brand-600" />
                <span>Idempotency Key</span>
              </span>
              <span className="text-ink-400 group-open:rotate-180 transition">▾</span>
            </summary>
            <div className="mt-2.5 space-y-2 text-ink-500">
              <p className="text-[11px]">
                Guarantees this refund will never be double-charged or processed twice.
              </p>
              <div className="flex items-center gap-2">
                <code className="min-w-0 flex-1 truncate rounded-lg border border-ink-200 bg-white px-2.5 py-1.5 font-mono text-[11px] text-ink-800">
                  {idempotencyKey}
                </code>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => setIdempotencyKey(generateIdempotencyKey("rfn"))}
                >
                  <RefreshCw className="h-3 w-3" />
                </Button>
              </div>
            </div>
          </details>

          {/* Notice */}
          <div className="rounded-xl border border-amber-200/60 bg-amber-50/50 p-3 text-[11px] text-amber-800 flex items-start gap-2">
            <HelpCircle className="h-3.5 w-3.5 text-amber-600 shrink-0 mt-0.5" />
            <span>
              Executing this refund triggers the upstream Razorpay refund API, records an immutable <strong>DEBIT</strong> ledger entry, and emits a webhook.
            </span>
          </div>

          {/* Modal Actions */}
          <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-ink-100">
            <Button
              type="button"
              variant="secondary"
              onClick={onClose}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="danger"
              loading={submitting}
              disabled={payment && remainingRefundable <= 0}
            >
              <RotateCcw className="h-3.5 w-3.5" />
              <span>
                Process Refund {minorAmount > 0 ? `(${formatMoney(minorAmount, currency)})` : refundMode === "full" ? "(Full)" : ""}
              </span>
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
