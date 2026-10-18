import { useMemo, useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { CheckCircle2, CreditCard, ExternalLink, RefreshCw, RotateCcw, Search, Send } from "lucide-react";
import { createPayment, getPayments } from "../lib/api.js";
import { formatDateTime, formatMoney, generateIdempotencyKey, shortId, toMinorUnits } from "../lib/format.js";
import { CURRENCIES, PAYMENT_STATUS_STYLES, PAYMENT_REFUND_STATUS_STYLES, statusStyle } from "../lib/constants.js";
import { useAuth } from "../context/AuthContext.jsx";
import { useToast } from "../context/ToastContext.jsx";
import { useFetch } from "../hooks/useFetch.js";
import { saveSessionPayment } from "../lib/paymentStore.js";
import PageHeader from "../components/ui/PageHeader.jsx";
import Button from "../components/ui/Button.jsx";
import Input from "../components/ui/Input.jsx";
import Select from "../components/ui/Select.jsx";
import CopyButton from "../components/ui/CopyButton.jsx";
import { Card, CardBody, CardHeader } from "../components/ui/Card.jsx";
import RefundModal from "../components/refunds/RefundModal.jsx";

export default function PaymentsPage() {
  const { apiKey } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const paymentsFetch = useFetch(
    () => getPayments(apiKey, { limit: 50 }),
    [apiKey],
    { enabled: Boolean(apiKey) }
  );

  const payments = (paymentsFetch.data?.data || []).map((p) => ({
    ...p,
    paymentId: p.paymentId || p._id,
  }));

  const [form, setForm] = useState({ amount: "", currency: "INR", customerEmail: "", customerPhone: "" });
  const [idempotencyKey, setIdempotencyKey] = useState(() => generateIdempotencyKey("pay"));
  const [search, setSearch] = useState("");
  const [lookupId, setLookupId] = useState("");
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [receipt, setReceipt] = useState(null);
  const [refundPayment, setRefundPayment] = useState(null);
  const minorAmount = toMinorUnits(form.amount, form.currency);

  // Live Auto-Polling if any payment is in-flight (PENDING or PROCESSING)
  const hasInFlightPayment = useMemo(() => {
    return payments.some((p) => p.status === "PENDING" || p.status === "PROCESSING");
  }, [payments]);

  useEffect(() => {
    if (!hasInFlightPayment) return;

    const interval = setInterval(() => {
      paymentsFetch.refresh();
    }, 2500);

    return () => clearInterval(interval);
  }, [hasInFlightPayment, paymentsFetch]);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    return [...payments].filter((payment) => !query || [payment.paymentId, payment.customerEmail, payment.status].some((value) => String(value || "").toLowerCase().includes(query))).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  }, [payments, search]);

  function update(field) {
    return (event) => {
      setForm((current) => ({ ...current, [field]: event.target.value }));
      setErrors((current) => ({ ...current, [field]: undefined }));
    };
  }

  function validate() {
    const next = {};
    if (!form.amount || !Number.isFinite(Number(form.amount))) next.amount = "Enter a valid amount.";
    else if (!Number.isFinite(minorAmount) || minorAmount < 100) next.amount = "Minimum payment amount is 1.00.";
    if (!form.customerEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.customerEmail)) next.customerEmail = "Enter a valid email address.";
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  async function handleSubmit(event) {
    event.preventDefault();
    if (!validate() || submitting) return;
    setSubmitting(true);
    try {
      const { data, idempotentReplay } = await createPayment({
        amount: minorAmount,
        currency: form.currency,
        customerEmail: form.customerEmail.trim(),
        ...(form.customerPhone.trim() ? { customerPhone: form.customerPhone.trim() } : {}),
      }, apiKey, idempotencyKey);
      saveSessionPayment({ ...data, customerEmail: form.customerEmail.trim(), customerPhone: form.customerPhone.trim() });
      setReceipt({ payment: data, replay: idempotentReplay });
      paymentsFetch.refresh();
      if (idempotentReplay) toast.warning("Existing payment returned", `Payment ${shortId(data.paymentId)} was already created.`);
      else toast.success("Payment created", `Payment ${shortId(data.paymentId)}`);
      setIdempotencyKey(generateIdempotencyKey("pay"));
      setForm((current) => ({ ...current, amount: "", customerEmail: "", customerPhone: "" }));
    } catch (error) {
      toast.error("Payment failed", error.message);
    } finally {
      setSubmitting(false);
    }
  }

  function handleLookup(event) {
    event.preventDefault();
    const id = lookupId.trim();
    if (id) navigate(`/payments/${encodeURIComponent(id)}`);
  }

  return (
    <div className="animate-fade-in space-y-6">
      <PageHeader
        title="Payments"
        description="Create charges, manage customer payments, and view transaction history."
      />

      {receipt && (
        <Card className="border-emerald-200 bg-emerald-50/40">
          <CardBody className="flex flex-wrap items-center justify-between gap-3 p-4">
            <div className="flex items-center gap-3">
              <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0" />
              <div>
                <p className="text-sm font-semibold text-emerald-950">
                  {receipt.replay ? "Existing payment returned (Idempotent)" : "Payment successfully created"}
                </p>
                <p className="mt-0.5 text-xs text-emerald-800">
                  {formatMoney(receipt.payment.amount, receipt.payment.currency)} ·{" "}
                  {statusStyle(PAYMENT_STATUS_STYLES, receipt.payment.status).label}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Link
                to={`/checkout/${receipt.payment.paymentId}`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white shadow-2xs hover:bg-emerald-700 transition-colors"
              >
                <ExternalLink className="h-3.5 w-3.5" /> Open Checkout UI
              </Link>
              <Link
                to={`/payments/${receipt.payment.paymentId}`}
                className="rounded-lg bg-white px-3 py-1.5 text-xs font-semibold text-brand-700 shadow-2xs hover:bg-brand-50"
              >
                View details
              </Link>
              <Button variant="ghost" size="sm" onClick={() => setReceipt(null)}>
                Dismiss
              </Button>
            </div>
          </CardBody>
        </Card>
      )}

      {/* Create Payment Card */}
      <Card>
        <CardHeader
          title="Create a payment"
          description="Initialize a new transaction with automatic double-entry ledger settlement."
        />
        <CardBody className="p-6">
          <form onSubmit={handleSubmit} className="max-w-2xl space-y-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <Input
                label="Amount"
                type="number"
                inputMode="decimal"
                min="1"
                step="0.01"
                placeholder="100.00"
                value={form.amount}
                onChange={update("amount")}
                error={errors.amount}
                required
              />
              <Select
                label="Currency"
                value={form.currency}
                onChange={update("currency")}
              >
                {CURRENCIES.map((currency) => (
                  <option key={currency} value={currency}>
                    {currency}
                  </option>
                ))}
              </Select>
              <Input
                label="Customer email"
                type="email"
                placeholder="customer@example.com"
                value={form.customerEmail}
                onChange={update("customerEmail")}
                error={errors.customerEmail}
                required
              />
              <Input
                label="Phone number (optional)"
                type="tel"
                placeholder="+91 9876543210"
                value={form.customerPhone}
                onChange={update("customerPhone")}
              />
            </div>

            {/* Advanced Idempotency Protection */}
            <details className="group rounded-xl border border-ink-200/80 bg-ink-50/50 p-3.5 transition-colors">
              <summary className="flex cursor-pointer items-center justify-between text-xs font-semibold text-ink-700 select-none">
                <span>Advanced · Idempotency protection</span>
                <span className="text-ink-400 transition group-open:rotate-180">▾</span>
              </summary>
              <div className="mt-3 space-y-2 text-xs text-ink-500">
                <p>
                  Protects against accidental double-charges if the client loses network connectivity.
                </p>
                <div className="flex flex-wrap items-center gap-2 pt-1">
                  <code className="min-w-0 flex-1 break-all rounded-lg border border-ink-200 bg-white px-2.5 py-1.5 font-mono text-[11px] text-ink-800">
                    {idempotencyKey}
                  </code>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => setIdempotencyKey(generateIdempotencyKey("pay"))}
                  >
                    Generate new
                  </Button>
                </div>
              </div>
            </details>

            <div className="flex justify-end pt-2">
              <Button type="submit" loading={submitting} size="lg">
                <Send className="h-4 w-4" /> Create payment
              </Button>
            </div>
          </form>
        </CardBody>
      </Card>

      {/* Payment History & Lookup */}
      <Card>
        <CardHeader
          title="Payment history"
          description="Recent transactions synchronized with ClearLedger database."
          action={
            <Button
              variant="secondary"
              size="sm"
              onClick={paymentsFetch.refresh}
              loading={paymentsFetch.loading}
              title="Refresh transaction history"
            >
              <RefreshCw className="h-3.5 w-3.5" /> Refresh
            </Button>
          }
        />

        {/* Unified Search & Direct Lookup */}
        <div className="border-b border-ink-100 bg-ink-50/50 p-4">
          <form onSubmit={handleLookup} className="flex flex-col gap-3 sm:flex-row">
            <div className="relative min-w-0 flex-1">
              <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />
              <input
                className="input pl-9 text-xs sm:text-sm"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Filter by payment ID, customer email, or status..."
              />
            </div>
            <div className="flex min-w-0 sm:w-72 gap-2">
              <input
                className="input text-xs sm:text-sm"
                value={lookupId}
                onChange={(event) => setLookupId(event.target.value)}
                placeholder="Direct payment ID lookup"
              />
              <Button type="submit" variant="secondary" size="md" disabled={!lookupId.trim()}>
                Find
              </Button>
            </div>
          </form>
        </div>

        <CardBody className="p-0">
          {filtered.length ? (
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr>
                    <th className="px-5 py-3">Payment</th>
                    <th className="px-5 py-3">Customer</th>
                    <th className="px-5 py-3">Amount</th>
                    <th className="px-5 py-3">Status</th>
                    <th className="px-5 py-3">Created</th>
                    <th className="px-5 py-3 text-right" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-ink-100">
                  {filtered.map((payment) => {
                    const status = statusStyle(PAYMENT_STATUS_STYLES, payment.status);
                    return (
                      <tr key={payment.paymentId} className="hover:bg-ink-50/70">
                        <td className="px-5 py-3.5">
                          <div className="flex items-center gap-1.5">
                            <Link
                              to={`/payments/${payment.paymentId}`}
                              className="font-mono text-xs font-semibold text-brand-600 hover:underline"
                            >
                              {shortId(payment.paymentId)}
                            </Link>
                            <CopyButton
                              value={payment.paymentId}
                              showLabel={false}
                              label="Copy payment ID"
                            />
                          </div>
                        </td>
                        <td className="max-w-[180px] truncate px-5 py-3.5 text-xs text-ink-600">
                          {payment.customerEmail || "—"}
                        </td>
                        <td className="whitespace-nowrap px-5 py-3.5 text-xs font-semibold text-ink-900">
                          <div>
                            <span>{formatMoney(payment.amount, payment.currency)}</span>
                            {payment.refundedAmount > 0 && (
                              <span className="block text-[10px] font-normal text-rose-600">
                                -{formatMoney(payment.refundedAmount, payment.currency)} ref
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-5 py-3.5">
                          <div className="flex flex-col items-start gap-1">
                            <span className={`chip ${status.className}`}>{status.label}</span>
                            {payment.refundStatus && payment.refundStatus !== "NONE" && (
                              <span className={`chip text-[10px] ${statusStyle(PAYMENT_REFUND_STATUS_STYLES, payment.refundStatus).className}`}>
                                {statusStyle(PAYMENT_REFUND_STATUS_STYLES, payment.refundStatus).label}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="whitespace-nowrap px-5 py-3.5 text-xs text-ink-500">
                          {formatDateTime(payment.createdAt)}
                        </td>
                        <td className="px-5 py-3.5 text-right whitespace-nowrap">
                          <div className="flex items-center justify-end gap-3">
                            {payment.status === "SUCCEEDED" &&
                              payment.amount > (payment.refundedAmount || 0) && (
                                <button
                                  type="button"
                                  onClick={() => setRefundPayment(payment)}
                                  className="inline-flex items-center gap-1 text-xs font-semibold text-rose-600 hover:text-rose-700 hover:underline"
                                  title="Issue partial or full refund"
                                >
                                  <RotateCcw className="h-3 w-3" />
                                  <span>Refund</span>
                                </button>
                              )}
                            {payment.status !== "SUCCEEDED" && (
                              <Link
                                to={`/checkout/${payment.paymentId}`}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-600 hover:text-emerald-700 hover:underline"
                                title="Open customer checkout session"
                              >
                                <span>Checkout</span>
                                <ExternalLink className="h-3 w-3" />
                              </Link>
                            )}
                            <Link
                              to={`/payments/${payment.paymentId}`}
                              className="text-xs font-semibold text-brand-600 hover:underline"
                            >
                              Details →
                            </Link>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="py-12">
              <div className="mx-auto max-w-sm text-center">
                <div className="mx-auto mb-3 grid h-10 w-10 place-items-center rounded-xl bg-ink-100 text-ink-500">
                  <CreditCard className="h-5 w-5" />
                </div>
                <h3 className="text-sm font-semibold text-ink-900">
                  {payments.length ? "No matching payments" : "No payments yet"}
                </h3>
                <p className="mt-1 text-xs text-ink-500">
                  {payments.length
                    ? "Try adjusting your search query or payment ID."
                    : "Create your first test payment above to start recording activity."}
                </p>
              </div>
            </div>
          )}
        </CardBody>
      </Card>

      {/* Refund Modal */}
      <RefundModal
        isOpen={Boolean(refundPayment)}
        onClose={() => setRefundPayment(null)}
        payment={refundPayment}
        onSuccess={() => {
          paymentsFetch.refresh();
          setTimeout(() => paymentsFetch.refresh(), 1000);
          setTimeout(() => paymentsFetch.refresh(), 3000);
        }}
      />
    </div>
  );
}
