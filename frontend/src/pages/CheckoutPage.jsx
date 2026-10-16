import { useEffect, useState, useMemo } from "react";
import { useParams, Link } from "react-router-dom";
import {
  ShieldCheck,
  Lock,
  CreditCard,
  QrCode,
  Building2,
  Sparkles,
  CheckCircle2,
  XCircle,
  Copy,
  Check,
  Printer,
  RefreshCw,
  ExternalLink,
  ArrowRight,
  AlertCircle,
  Smartphone,
  ChevronRight,
  Info
} from "lucide-react";
import {
  getCheckoutSession,
  verifyCheckoutPayment,
  simulateCheckoutPayment,
  ApiError
} from "../lib/api.js";
import { formatMoney, formatDateTime, shortId } from "../lib/format.js";
import { PAYMENT_STATUS_STYLES, statusStyle } from "../lib/constants.js";
import { LoadingBlock } from "../components/ui/Spinner.jsx";
import Button from "../components/ui/Button.jsx";

// Top Indian netbanking options
const NETBANKING_OPTIONS = [
  { id: "HDFC", name: "HDFC Bank", code: "HDFC", color: "bg-blue-600" },
  { id: "ICICI", name: "ICICI Bank", code: "ICIC", color: "bg-orange-600" },
  { id: "SBI", name: "State Bank of India", code: "SBIN", color: "bg-sky-600" },
  { id: "AXIS", name: "Axis Bank", code: "UTIB", color: "bg-purple-700" },
  { id: "KOTAK", name: "Kotak Mahindra", code: "KKBK", color: "bg-red-600" },
  { id: "PNB", name: "Punjab National", code: "PUNB", color: "bg-amber-700" },
];

export default function CheckoutPage() {
  const { id } = useParams();

  const [payment, setPayment] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [refreshing, setRefreshing] = useState(false);

  // Active payment tab: "simulator" | "upi" | "card" | "netbanking"
  const [activeTab, setActiveTab] = useState("simulator");

  // Form states
  const [vpa, setVpa] = useState("");
  const [cardNumber, setCardNumber] = useState("");
  const [cardExpiry, setCardExpiry] = useState("");
  const [cardCvv, setCardCvv] = useState("");
  const [cardName, setCardName] = useState("");
  const [selectedBank, setSelectedBank] = useState("HDFC");

  // Processing state for submission
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [copiedId, setCopiedId] = useState(false);

  // Fetch session details
  const fetchSession = async (isBackground = false) => {
    if (!id) return;
    if (!isBackground) setLoading(true);
    else setRefreshing(true);
    setSubmitError("");

    try {
      const res = await getCheckoutSession(id);
      // Backend may return res.data or res directly
      const data = res?.data || res;
      setPayment(data);
      setError(null);
    } catch (err) {
      console.error("Checkout fetch failed:", err);
      // If error is 404 or backend route not ready, display structured error
      setError(
        err.message ||
          "Unable to load checkout session. Please check if the payment ID is valid or backend is running."
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchSession();
  }, [id]);

  // Real-time polling while status is CREATED or PROCESSING
  useEffect(() => {
    if (!payment || payment.status === "SUCCEEDED" || payment.status === "FAILED") {
      return;
    }
    const interval = setInterval(() => {
      fetchSession(true);
    }, 3000);
    return () => clearInterval(interval);
  }, [id, payment?.status]);

  const handleCopyPaymentId = () => {
    if (!payment?._id && !payment?.paymentId) return;
    const pid = payment.paymentId || payment._id;
    navigator.clipboard.writeText(pid);
    setCopiedId(true);
    setTimeout(() => setCopiedId(false), 2000);
  };

  // Card brand detection
  const cardBrand = useMemo(() => {
    const clean = cardNumber.replace(/\s+/g, "");
    if (/^4/.test(clean)) return "Visa";
    if (/^5[1-5]/.test(clean)) return "Mastercard";
    if (/^60|^65|^8[12]/.test(clean)) return "RuPay";
    if (/^3[47]/.test(clean)) return "Amex";
    return null;
  }, [cardNumber]);

  // Card number input formatter
  const handleCardNumberChange = (e) => {
    const val = e.target.value.replace(/\D/g, "").slice(0, 16);
    const formatted = val.match(/.{1,4}/g)?.join(" ") || val;
    setCardNumber(formatted);
  };

  // Card expiry input formatter
  const handleExpiryChange = (e) => {
    const val = e.target.value.replace(/\D/g, "").slice(0, 4);
    if (val.length >= 2) {
      setCardExpiry(`${val.slice(0, 2)}/${val.slice(2)}`);
    } else {
      setCardExpiry(val);
    }
  };

  // Simulate payment (Success or Failure)
  const handleSimulate = async (targetStatus, reason = null) => {
    setSubmitting(true);
    setSubmitError("");
    try {
      const paymentId = payment.paymentId || payment._id || id;
      const res = await simulateCheckoutPayment({
        paymentId,
        status: targetStatus,
        failureReason: reason,
      });
      const data = res?.data || res;
      setPayment((prev) => ({
        ...prev,
        ...data,
        status: targetStatus,
        failureReason: reason || (targetStatus === "FAILED" ? "Simulated test failure" : null),
      }));
    } catch (err) {
      console.error("Simulation error:", err);
      // Fallback: if backend /simulate is returning error, show helpful message
      setSubmitError(
        err.message || "Simulation failed. Please verify backend simulation route."
      );
    } finally {
      setSubmitting(false);
    }
  };

  // Standard generic payment attempt (works as instant test authorization)
  const handleGenericPay = async (methodName) => {
    setSubmitting(true);
    setSubmitError("");
    try {
      const paymentId = payment.paymentId || payment._id || id;
      const res = await simulateCheckoutPayment({
        paymentId,
        status: "SUCCEEDED",
      });
      const data = res?.data || res;
      setPayment((prev) => ({
        ...prev,
        ...data,
        status: "SUCCEEDED",
        methodUsed: methodName,
      }));
    } catch (err) {
      console.error("Payment execution error:", err);
      setSubmitError(
        err.message || "Payment submission failed. Check backend checkout service."
      );
    } finally {
      setSubmitting(false);
    }
  };

  const status = statusStyle(PAYMENT_STATUS_STYLES, payment?.status);
  const paymentId = payment?.paymentId || payment?._id || id;
  const merchantName = payment?.merchant?.name || "ClearLedger Merchant";

  // Loading Screen
  if (loading && !payment) {
    return (
      <div className="min-h-screen bg-slate-900 grid place-items-center p-4">
        <div className="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-950/80 p-8 text-center backdrop-blur-xl shadow-2xl">
          <LoadingBlock label="Initializing secure checkout session…" />
        </div>
      </div>
    );
  }

  // Error Screen
  if (error && !payment) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-200 flex flex-col justify-center items-center p-4">
        <div className="w-full max-w-lg rounded-2xl border border-rose-900/50 bg-rose-950/20 p-8 backdrop-blur-xl shadow-2xl text-center">
          <div className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-2xl bg-rose-900/40 text-rose-400 border border-rose-800/60">
            <XCircle className="h-7 w-7" />
          </div>
          <h2 className="text-xl font-bold text-white">Checkout Session Not Found</h2>
          <p className="mt-2 text-sm text-slate-400">
            {error}
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <Button variant="secondary" onClick={() => fetchSession()}>
              <RefreshCw className="h-4 w-4" /> Try Again
            </Button>
            <Link
              to="/payments"
              className="inline-flex h-9 items-center rounded-lg bg-indigo-600 px-4 text-xs font-semibold text-white hover:bg-indigo-500"
            >
              Back to Merchant Console
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950/40 text-slate-100 flex flex-col selection:bg-indigo-500/30">
      {/* Top Navbar */}
      <header className="border-b border-slate-800/80 bg-slate-950/60 backdrop-blur-md sticky top-0 z-30">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-gradient-to-tr from-indigo-600 to-violet-500 grid place-items-center text-white font-bold shadow-md shadow-indigo-500/20">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="font-semibold text-sm text-white tracking-tight">
                  {merchantName}
                </span>
                <span className="inline-flex items-center gap-0.5 text-[10px] bg-indigo-500/20 text-indigo-300 font-medium px-1.5 py-0.5 rounded-full border border-indigo-500/30">
                  <CheckCircle2 className="h-2.5 w-2.5 text-indigo-400" /> Verified
                </span>
              </div>
              <p className="text-[11px] text-slate-400">ClearLedger Hosted Checkout</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="hidden sm:flex items-center gap-1.5 text-xs text-emerald-400 font-medium bg-emerald-950/40 border border-emerald-800/40 px-2.5 py-1 rounded-full">
              <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
              256-bit Encrypted
            </div>
            <Link
              to="/"
              className="text-xs text-slate-400 hover:text-slate-200 transition-colors"
            >
              Merchant Portal →
            </Link>
          </div>
        </div>
      </header>

      {/* Main Checkout Container */}
      <main className="flex-1 max-w-5xl w-full mx-auto p-4 sm:p-6 lg:p-8 flex flex-col justify-center">
        {/* Test Mode Banner */}
        <div className="mb-6 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-2.5 flex items-center justify-between text-xs text-amber-300">
          <div className="flex items-center gap-2">
            <span className="inline-block px-1.5 py-0.5 rounded bg-amber-500/20 text-[10px] font-bold uppercase tracking-wider text-amber-200 border border-amber-500/40">
              Test Mode
            </span>
            <span>Use the instant simulator or test payment options to test ledger entries.</span>
          </div>
          <button
            onClick={() => fetchSession(true)}
            className="flex items-center gap-1 hover:text-white transition-colors"
            title="Refresh status"
          >
            <RefreshCw className={`h-3 w-3 ${refreshing ? "animate-spin" : ""}`} />
            Refresh
          </button>
        </div>

        <div className="grid lg:grid-cols-12 gap-8 items-start">
          {/* LEFT COLUMN: Order Summary & Info (5 cols) */}
          <div className="lg:col-span-5 space-y-5">
            <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6 backdrop-blur-xl shadow-xl space-y-6">
              <div>
                <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">
                  Amount Due
                </span>
                <div className="mt-1 flex items-baseline gap-2">
                  <span className="text-4xl font-extrabold text-white tracking-tight">
                    {formatMoney(payment.amount, payment.currency)}
                  </span>
                  <span className="text-sm font-semibold text-slate-400 uppercase">
                    {payment.currency || "INR"}
                  </span>
                </div>
              </div>

              {/* Order breakdown */}
              <div className="rounded-xl border border-slate-800/80 bg-slate-950/40 p-4 space-y-2.5 text-xs">
                <div className="flex justify-between text-slate-400">
                  <span>Subtotal</span>
                  <span className="text-slate-200 font-medium">
                    {formatMoney(payment.amount, payment.currency)}
                  </span>
                </div>
                <div className="flex justify-between text-slate-400">
                  <span>Gateway & Processing Fee</span>
                  <span className="text-emerald-400 font-medium">₹0.00 (Waived)</span>
                </div>
                <div className="pt-2 border-t border-slate-800 flex justify-between font-semibold text-slate-200">
                  <span>Total Amount</span>
                  <span className="text-white">
                    {formatMoney(payment.amount, payment.currency)}
                  </span>
                </div>
              </div>

              {/* Customer & Transaction details */}
              <div className="space-y-3 text-xs border-t border-slate-800/80 pt-5">
                <div className="flex justify-between items-center text-slate-400">
                  <span>Payment Status</span>
                  <span className={`chip text-[11px] ${status.className}`}>
                    {status.label}
                  </span>
                </div>

                <div className="flex justify-between items-center text-slate-400">
                  <span>Customer Email</span>
                  <span className="text-slate-200 font-medium truncate max-w-[180px]">
                    {payment.customerEmail || "customer@example.com"}
                  </span>
                </div>

                {payment.customerPhone && (
                  <div className="flex justify-between items-center text-slate-400">
                    <span>Phone</span>
                    <span className="text-slate-200 font-medium">{payment.customerPhone}</span>
                  </div>
                )}

                <div className="flex justify-between items-center text-slate-400">
                  <span>Payment ID</span>
                  <button
                    onClick={handleCopyPaymentId}
                    className="flex items-center gap-1.5 font-mono text-[11px] text-indigo-300 hover:text-white transition-colors bg-indigo-950/50 px-2 py-0.5 rounded border border-indigo-800/40"
                    title="Click to copy Payment ID"
                  >
                    <span>{shortId(paymentId)}</span>
                    {copiedId ? (
                      <Check className="h-3 w-3 text-emerald-400" />
                    ) : (
                      <Copy className="h-3 w-3 text-slate-400" />
                    )}
                  </button>
                </div>

                {payment.razorpayOrderId && (
                  <div className="flex justify-between items-center text-slate-400">
                    <span>Razorpay Order</span>
                    <span className="font-mono text-[11px] text-slate-300">
                      {payment.razorpayOrderId}
                    </span>
                  </div>
                )}
              </div>

              {/* Ledger Security Badges */}
              <div className="pt-3 border-t border-slate-800/80 flex items-center justify-around text-center text-[10px] text-slate-400">
                <div className="flex flex-col items-center gap-1">
                  <Lock className="h-4 w-4 text-indigo-400" />
                  <span>256-bit SSL</span>
                </div>
                <div className="h-5 w-px bg-slate-800" />
                <div className="flex flex-col items-center gap-1">
                  <ShieldCheck className="h-4 w-4 text-emerald-400" />
                  <span>Double-Entry Settled</span>
                </div>
                <div className="h-5 w-px bg-slate-800" />
                <div className="flex flex-col items-center gap-1">
                  <Sparkles className="h-4 w-4 text-violet-400" />
                  <span>PCI-DSS Ready</span>
                </div>
              </div>
            </div>
          </div>

          {/* RIGHT COLUMN: Payment Processing Area (7 cols) */}
          <div className="lg:col-span-7">
            {/* SUCCESS STATE */}
            {payment.status === "SUCCEEDED" ? (
              <div className="rounded-2xl border border-emerald-500/40 bg-gradient-to-b from-emerald-950/30 via-slate-900/90 to-slate-950 p-8 backdrop-blur-xl shadow-2xl text-center space-y-6">
                <div className="relative mx-auto grid h-20 w-20 place-items-center rounded-3xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/50 shadow-lg shadow-emerald-500/20">
                  <CheckCircle2 className="h-10 w-10 text-emerald-400" />
                </div>

                <div>
                  <span className="inline-block px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 mb-2">
                    Payment Verified & Settled
                  </span>
                  <h2 className="text-2xl font-bold text-white tracking-tight">
                    Payment Successful!
                  </h2>
                  <p className="mt-1 text-sm text-slate-400">
                    A receipt has been recorded and credited to the merchant's ledger.
                  </p>
                </div>

                {/* Receipt Card */}
                <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-5 text-left text-xs space-y-3">
                  <div className="flex justify-between border-b border-slate-800/80 pb-2.5">
                    <span className="text-slate-400">Amount Paid</span>
                    <span className="text-white font-bold text-base">
                      {formatMoney(payment.amount, payment.currency)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Payment Reference</span>
                    <span className="font-mono text-slate-200">{paymentId}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Payment Method</span>
                    <span className="text-slate-200 font-medium">
                      {payment.methodUsed || "Instant Gateway Capture"}
                    </span>
                  </div>
                  {payment.razorpayPaymentId && (
                    <div className="flex justify-between">
                      <span className="text-slate-400">Processor Reference</span>
                      <span className="font-mono text-slate-200">{payment.razorpayPaymentId}</span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span className="text-slate-400">Timestamp</span>
                    <span className="text-slate-300">
                      {formatDateTime(payment.updatedAt || new Date().toISOString())}
                    </span>
                  </div>
                </div>

                <div className="flex flex-wrap justify-center gap-3 pt-2">
                  <Button
                    variant="secondary"
                    onClick={() => window.print()}
                    className="border-slate-700 bg-slate-800/80 hover:bg-slate-700 text-slate-200"
                  >
                    <Printer className="h-4 w-4" /> Print Receipt
                  </Button>
                  <Link
                    to={`/payments/${paymentId}`}
                    className="inline-flex h-9 items-center rounded-lg bg-indigo-600 px-4 text-xs font-semibold text-white hover:bg-indigo-500 shadow-md shadow-indigo-600/30"
                  >
                    View in Merchant Dashboard →
                  </Link>
                </div>
              </div>
            ) : payment.status === "FAILED" ? (
              /* FAILED STATE */
              <div className="rounded-2xl border border-rose-500/40 bg-gradient-to-b from-rose-950/30 via-slate-900/90 to-slate-950 p-8 backdrop-blur-xl shadow-2xl text-center space-y-6">
                <div className="mx-auto grid h-20 w-20 place-items-center rounded-3xl bg-rose-500/20 text-rose-400 border border-rose-500/50 shadow-lg shadow-rose-500/20">
                  <XCircle className="h-10 w-10 text-rose-400" />
                </div>

                <div>
                  <span className="inline-block px-3 py-1 rounded-full text-xs font-semibold bg-rose-500/20 text-rose-300 border border-rose-500/30 mb-2">
                    Payment Failed
                  </span>
                  <h2 className="text-2xl font-bold text-white tracking-tight">
                    Transaction Declined
                  </h2>
                  <p className="mt-1 text-sm text-slate-400">
                    {payment.failureReason || "The issuing bank declined this transaction."}
                  </p>
                </div>

                <div className="flex flex-wrap justify-center gap-3 pt-2">
                  <Button
                    variant="secondary"
                    onClick={() => setPayment((prev) => ({ ...prev, status: "CREATED" }))}
                    className="border-slate-700 bg-slate-800/80 hover:bg-slate-700 text-slate-200"
                  >
                    <RefreshCw className="h-4 w-4" /> Try Different Method
                  </Button>
                  <Link
                    to="/payments"
                    className="inline-flex h-9 items-center rounded-lg bg-slate-800 border border-slate-700 px-4 text-xs font-semibold text-slate-300 hover:text-white"
                  >
                    Cancel & Return
                  </Link>
                </div>
              </div>
            ) : (
              /* PAYMENT OPTIONS CONTAINER (CREATED / PROCESSING) */
              <div className="rounded-2xl border border-slate-800 bg-slate-900/80 backdrop-blur-xl shadow-2xl overflow-hidden">
                {/* Method Navigation Tabs */}
                <div className="border-b border-slate-800/80 bg-slate-950/40 p-2 flex gap-1.5 overflow-x-auto no-scrollbar">
                  <button
                    onClick={() => setActiveTab("simulator")}
                    className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold transition-all whitespace-nowrap ${
                      activeTab === "simulator"
                        ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/30"
                        : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/50"
                    }`}
                  >
                    <Sparkles className="h-3.5 w-3.5" />
                    Instant Simulator
                  </button>

                  <button
                    onClick={() => setActiveTab("upi")}
                    className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold transition-all whitespace-nowrap ${
                      activeTab === "upi"
                        ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/30"
                        : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/50"
                    }`}
                  >
                    <QrCode className="h-3.5 w-3.5" />
                    UPI & QR
                  </button>

                  <button
                    onClick={() => setActiveTab("card")}
                    className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold transition-all whitespace-nowrap ${
                      activeTab === "card"
                        ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/30"
                        : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/50"
                    }`}
                  >
                    <CreditCard className="h-3.5 w-3.5" />
                    Cards
                  </button>

                  <button
                    onClick={() => setActiveTab("netbanking")}
                    className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold transition-all whitespace-nowrap ${
                      activeTab === "netbanking"
                        ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/30"
                        : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/50"
                    }`}
                  >
                    <Building2 className="h-3.5 w-3.5" />
                    Net Banking
                  </button>
                </div>

                <div className="p-6">
                  {submitError && (
                    <div className="mb-5 rounded-xl border border-rose-500/40 bg-rose-500/10 p-3.5 text-xs text-rose-300 flex items-start gap-2.5">
                      <AlertCircle className="h-4 w-4 shrink-0 mt-0.5 text-rose-400" />
                      <div>
                        <p className="font-semibold">Payment failed</p>
                        <p className="mt-0.5 text-rose-400/90">{submitError}</p>
                      </div>
                    </div>
                  )}

                  {/* TAB 1: INSTANT SIMULATOR (DEV/TEST) */}
                  {activeTab === "simulator" && (
                    <div className="space-y-5">
                      <div className="rounded-xl border border-indigo-500/30 bg-indigo-500/10 p-4 text-xs text-indigo-300 space-y-1.5">
                        <div className="flex items-center gap-1.5 font-semibold text-white">
                          <Sparkles className="h-4 w-4 text-indigo-400" />
                          <span>Event-Driven Gateway Simulator</span>
                        </div>
                        <p className="text-slate-300 leading-relaxed">
                          This environment allows you to simulate upstream processor callbacks. Simulating success triggers atomic payment confirmation, produces double-entry ledger credits, and issues outbox events.
                        </p>
                      </div>

                      <div className="grid sm:grid-cols-2 gap-3 pt-2">
                        <button
                          disabled={submitting}
                          onClick={() => handleSimulate("SUCCEEDED")}
                          className="flex flex-col items-start gap-2 rounded-xl border border-emerald-500/40 bg-emerald-950/20 hover:bg-emerald-900/30 p-4 text-left transition-all hover:scale-[1.01] active:scale-[0.99] group disabled:opacity-60"
                        >
                          <div className="h-9 w-9 rounded-lg bg-emerald-500/20 border border-emerald-500/40 grid place-items-center text-emerald-400 group-hover:bg-emerald-500/30">
                            <CheckCircle2 className="h-5 w-5" />
                          </div>
                          <div>
                            <span className="font-semibold text-sm text-emerald-300">
                              Simulate Success
                            </span>
                            <p className="mt-0.5 text-[11px] text-slate-400">
                              Simulate instant bank capture & trigger ledger credit.
                            </p>
                          </div>
                        </button>

                        <button
                          disabled={submitting}
                          onClick={() =>
                            handleSimulate("FAILED", "Simulated insufficient funds at bank")
                          }
                          className="flex flex-col items-start gap-2 rounded-xl border border-rose-500/40 bg-rose-950/20 hover:bg-rose-900/30 p-4 text-left transition-all hover:scale-[1.01] active:scale-[0.99] group disabled:opacity-60"
                        >
                          <div className="h-9 w-9 rounded-lg bg-rose-500/20 border border-rose-500/40 grid place-items-center text-rose-400 group-hover:bg-rose-500/30">
                            <XCircle className="h-5 w-5" />
                          </div>
                          <div>
                            <span className="font-semibold text-sm text-rose-300">
                              Simulate Failure
                            </span>
                            <p className="mt-0.5 text-[11px] text-slate-400">
                              Simulate bank decline & failure event state.
                            </p>
                          </div>
                        </button>
                      </div>

                      <div className="pt-2 border-t border-slate-800 text-[11px] text-slate-400 flex items-center justify-between">
                        <span>Current Session Status: <strong className="text-slate-200">{payment.status}</strong></span>
                        <span className="flex items-center gap-1 text-slate-400">
                          <Lock className="h-3 w-3" /> Ledger Engine Connected
                        </span>
                      </div>
                    </div>
                  )}

                  {/* TAB 2: UPI & QR CODE */}
                  {activeTab === "upi" && (
                    <div className="space-y-6">
                      <div className="grid md:grid-cols-2 gap-6 items-center">
                        {/* Dynamic QR Code display */}
                        <div className="rounded-xl border border-slate-800 bg-slate-950 p-4 flex flex-col items-center text-center">
                          <div className="relative p-3 bg-white rounded-xl shadow-md">
                            {/* SVG generated QR preview */}
                            <svg
                              className="w-40 h-40 text-slate-950"
                              viewBox="0 0 100 100"
                              fill="currentColor"
                            >
                              <rect width="28" height="28" x="6" y="6" rx="4" />
                              <rect width="16" height="16" x="12" y="12" fill="white" rx="2" />
                              <rect width="8" height="8" x="16" y="16" />

                              <rect width="28" height="28" x="66" y="6" rx="4" />
                              <rect width="16" height="16" x="72" y="12" fill="white" rx="2" />
                              <rect width="8" height="8" x="76" y="16" />

                              <rect width="28" height="28" x="6" y="66" rx="4" />
                              <rect width="16" height="16" x="12" y="72" fill="white" rx="2" />
                              <rect width="8" height="8" x="16" y="76" />

                              {/* Matrix dots */}
                              <rect width="6" height="6" x="40" y="10" />
                              <rect width="6" height="6" x="50" y="16" />
                              <rect width="6" height="6" x="42" y="24" />
                              <rect width="6" height="6" x="12" y="44" />
                              <rect width="6" height="6" x="24" y="48" />
                              <rect width="6" height="6" x="44" y="42" />
                              <rect width="6" height="6" x="54" y="48" />
                              <rect width="6" height="6" x="66" y="42" />
                              <rect width="6" height="6" x="80" y="48" />
                              <rect width="6" height="6" x="44" y="66" />
                              <rect width="6" height="6" x="56" y="74" />
                              <rect width="6" height="6" x="72" y="68" />
                              <rect width="6" height="6" x="82" y="80" />
                            </svg>
                            <div className="absolute inset-0 grid place-items-center pointer-events-none">
                              <div className="h-8 w-8 rounded-lg bg-indigo-600 text-white grid place-items-center shadow font-bold text-[10px]">
                                UPI
                              </div>
                            </div>
                          </div>
                          <span className="mt-3 text-xs font-medium text-slate-300">
                            Scan to pay with any UPI App
                          </span>
                          <span className="text-[11px] text-slate-500">
                            GPay, PhonePe, Paytm, BHIM, CRED
                          </span>
                        </div>

                        {/* UPI ID entry */}
                        <div className="space-y-4">
                          <div>
                            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                              Enter UPI ID / VPA
                            </label>
                            <div className="relative">
                              <Smartphone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
                              <input
                                type="text"
                                placeholder="name@okaxis or mobile@upi"
                                value={vpa}
                                onChange={(e) => setVpa(e.target.value)}
                                className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-slate-700 bg-slate-950 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                              />
                            </div>
                          </div>

                          <div className="flex flex-wrap gap-2">
                            {["@okhdfcbank", "@okaxis", "@paytm", "@ybl"].map((handle) => (
                              <button
                                key={handle}
                                type="button"
                                onClick={() => setVpa((prev) => (prev.split("@")[0] || "user") + handle)}
                                className="px-2 py-1 rounded bg-slate-800 text-[11px] text-slate-300 hover:text-white hover:bg-slate-700 transition"
                              >
                                {handle}
                              </button>
                            ))}
                          </div>

                          <Button
                            size="lg"
                            className="w-full bg-indigo-600 hover:bg-indigo-500"
                            loading={submitting}
                            onClick={() => handleGenericPay("UPI / VPA")}
                          >
                            Pay {formatMoney(payment.amount, payment.currency)}
                          </Button>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* TAB 3: CARDS */}
                  {activeTab === "card" && (
                    <div className="space-y-5">
                      {/* Virtual Card Preview */}
                      <div className="rounded-xl bg-gradient-to-tr from-slate-950 via-slate-900 to-indigo-900/60 p-4 border border-slate-700/80 shadow-lg text-white space-y-3">
                        <div className="flex justify-between items-center text-xs">
                          <span className="font-semibold text-slate-400">Card Preview</span>
                          <span className="font-bold text-indigo-400 tracking-wider uppercase text-xs">
                            {cardBrand || "Credit / Debit"}
                          </span>
                        </div>
                        <div className="font-mono text-base tracking-widest text-slate-200 py-1">
                          {cardNumber || "•••• •••• •••• ••••"}
                        </div>
                        <div className="flex justify-between items-center text-[11px] text-slate-400">
                          <div>
                            <span className="block text-[9px] uppercase">Cardholder</span>
                            <span className="font-medium text-slate-200">
                              {cardName || "YOUR NAME"}
                            </span>
                          </div>
                          <div>
                            <span className="block text-[9px] uppercase">Expires</span>
                            <span className="font-medium text-slate-200">
                              {cardExpiry || "MM/YY"}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Card Inputs */}
                      <div className="space-y-3">
                        <div>
                          <label className="block text-xs font-semibold text-slate-300 mb-1">
                            Card Number
                          </label>
                          <input
                            type="text"
                            inputMode="numeric"
                            placeholder="4111 2222 3333 4444"
                            value={cardNumber}
                            onChange={handleCardNumberChange}
                            className="w-full px-3 py-2.5 rounded-xl border border-slate-700 bg-slate-950 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 font-mono"
                          />
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="block text-xs font-semibold text-slate-300 mb-1">
                              Expiry (MM/YY)
                            </label>
                            <input
                              type="text"
                              placeholder="MM/YY"
                              maxLength={5}
                              value={cardExpiry}
                              onChange={handleExpiryChange}
                              className="w-full px-3 py-2.5 rounded-xl border border-slate-700 bg-slate-950 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 font-mono"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-semibold text-slate-300 mb-1">
                              CVV
                            </label>
                            <input
                              type="password"
                              maxLength={4}
                              placeholder="•••"
                              value={cardCvv}
                              onChange={(e) => setCardCvv(e.target.value.slice(0, 4))}
                              className="w-full px-3 py-2.5 rounded-xl border border-slate-700 bg-slate-950 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 font-mono"
                            />
                          </div>
                        </div>

                        <div>
                          <label className="block text-xs font-semibold text-slate-300 mb-1">
                            Cardholder Name
                          </label>
                          <input
                            type="text"
                            placeholder="John Doe"
                            value={cardName}
                            onChange={(e) => setCardName(e.target.value)}
                            className="w-full px-3 py-2.5 rounded-xl border border-slate-700 bg-slate-950 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                          />
                        </div>
                      </div>

                      <Button
                        size="lg"
                        className="w-full bg-indigo-600 hover:bg-indigo-500"
                        loading={submitting}
                        onClick={() => handleGenericPay(`Card (${cardBrand || "Credit Card"})`)}
                      >
                        <Lock className="h-4 w-4" /> Pay {formatMoney(payment.amount, payment.currency)}
                      </Button>
                    </div>
                  )}

                  {/* TAB 4: NET BANKING */}
                  {activeTab === "netbanking" && (
                    <div className="space-y-5">
                      <p className="text-xs text-slate-400">
                        Choose your preferred bank to complete direct debit:
                      </p>

                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                        {NETBANKING_OPTIONS.map((bank) => (
                          <button
                            key={bank.id}
                            type="button"
                            onClick={() => setSelectedBank(bank.id)}
                            className={`p-3 rounded-xl border text-left flex flex-col justify-between h-20 transition-all ${
                              selectedBank === bank.id
                                ? "border-indigo-500 bg-indigo-950/40 text-white shadow-md shadow-indigo-500/20"
                                : "border-slate-800 bg-slate-950/60 text-slate-400 hover:border-slate-700 hover:text-slate-200"
                            }`}
                          >
                            <span className="font-semibold text-xs text-white truncate">
                              {bank.name}
                            </span>
                            <span className="text-[10px] text-slate-500 font-mono">
                              {bank.code}
                            </span>
                          </button>
                        ))}
                      </div>

                      <Button
                        size="lg"
                        className="w-full bg-indigo-600 hover:bg-indigo-500"
                        loading={submitting}
                        onClick={() => handleGenericPay(`Net Banking (${selectedBank})`)}
                      >
                        Proceed with {selectedBank}
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-800/80 bg-slate-950/40 py-6 mt-12 text-center text-xs text-slate-500">
        <div className="max-w-5xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-emerald-400" />
            <span>Secured by ClearLedger Gateway</span>
          </div>
          <p className="text-[11px]">
            Double-Entry Ledger Verified · Immutable Transaction Audit
          </p>
        </div>
      </footer>
    </div>
  );
}
