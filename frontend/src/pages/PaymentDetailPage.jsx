import { useState, useEffect } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, ExternalLink, Receipt, RefreshCw, RotateCcw } from "lucide-react";
import { ApiError, getPayment, getPaymentRefunds } from "../lib/api.js";
import { formatDateTime, formatMoney, shortId } from "../lib/format.js";
import {
  PAYMENT_STATUS_STYLES,
  REFUND_STATUS_STYLES,
  PAYMENT_REFUND_STATUS_STYLES,
  statusStyle,
} from "../lib/constants.js";
import { useAuth } from "../context/AuthContext.jsx";
import { useFetch } from "../hooks/useFetch.js";
import { saveSessionPayment } from "../lib/paymentStore.js";
import PageHeader from "../components/ui/PageHeader.jsx";
import Button from "../components/ui/Button.jsx";
import CopyButton from "../components/ui/CopyButton.jsx";
import { Card, CardBody } from "../components/ui/Card.jsx";
import { InfoRow } from "../components/ui/InfoRow.jsx";
import { LoadingBlock } from "../components/ui/Spinner.jsx";
import RefundModal from "../components/refunds/RefundModal.jsx";

export default function PaymentDetailPage() {
  const { id } = useParams();
  const { apiKey } = useAuth();
  const [refundModalOpen, setRefundModalOpen] = useState(false);

  const { data: payment, loading, error, refresh } = useFetch(
    () => getPayment(id, apiKey),
    [id, apiKey],
    { enabled: Boolean(id && apiKey) }
  );

  const refundsFetch = useFetch(
    () => getPaymentRefunds(payment?._id || id, apiKey),
    [payment?._id || id, apiKey],
    { enabled: Boolean((payment?._id || id) && apiKey) }
  );

  useEffect(() => {
    if (payment) saveSessionPayment({ ...payment, paymentId: payment.paymentId || payment._id });
  }, [payment]);

  const status = statusStyle(PAYMENT_STATUS_STYLES, payment?.status);
  const notFound = error instanceof ApiError && error.status === 404;
  const invalidId = error instanceof ApiError && error.status === 400;

  const totalAmount = payment?.amount || 0;
  const refundedAmount = payment?.refundedAmount || 0;
  const remainingRefundable = Math.max(0, totalAmount - refundedAmount);
  const canRefund = payment?.status === "SUCCEEDED" && remainingRefundable > 0;
  const refundList = refundsFetch.data?.refunds || [];
  const refundStatusStyle = statusStyle(
    PAYMENT_REFUND_STATUS_STYLES,
    payment?.refundStatus || (refundedAmount > 0 ? (remainingRefundable === 0 ? "FULL" : "PARTIAL") : "NONE")
  );

  const handleRefreshAll = () => {
    refresh();
    refundsFetch.refresh();
  };

  // Live Auto-Polling: poll if any refund is PENDING/PROCESSING or payment itself is in flight
  const hasInFlightRefund = refundList.some(
    (r) => r.status === "PENDING" || r.status === "PROCESSING"
  );
  const isInFlightPayment =
    payment?.status === "PENDING" || payment?.status === "PROCESSING";

  useEffect(() => {
    if (!hasInFlightRefund && !isInFlightPayment) return;

    const interval = setInterval(() => {
      refresh();
      refundsFetch.refresh();
    }, 2500);

    return () => clearInterval(interval);
  }, [hasInFlightRefund, isInFlightPayment]);

  return (
    <div className="animate-fade-in space-y-6">
      <PageHeader
        title="Payment details"
        description={payment ? `Reference ID ${payment._id || id}` : "Inspect transaction ledger details."}
        actions={
          <div className="flex items-center gap-2">
            {(hasInFlightRefund || isInFlightPayment) && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/10 px-2.5 py-1 text-[11px] font-medium text-amber-300 border border-amber-500/20 animate-pulse">
                <RefreshCw className="h-3 w-3 animate-spin text-amber-400" />
                Live updating...
              </span>
            )}
            {canRefund && (
              <Button
                variant="danger"
                size="sm"
                onClick={() => setRefundModalOpen(true)}
                className="gap-1.5"
              >
                <RotateCcw className="h-3.5 w-3.5" /> Issue Refund
              </Button>
            )}
            <Link
              to={`/checkout/${payment?._id || id}`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-emerald-600 px-3 text-xs font-medium text-white hover:bg-emerald-500 transition-colors"
            >
              <ExternalLink className="h-3.5 w-3.5" /> Open Checkout UI
            </Link>
            <Button variant="secondary" size="sm" onClick={handleRefreshAll} loading={loading || refundsFetch.loading}>
              <RefreshCw className="h-3.5 w-3.5" /> Refresh
            </Button>
            <Link
              to="/payments"
              className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-[#282A30] bg-[#16171A] px-3 text-xs font-medium text-[#D4D4D8] hover:bg-[#1C1D21] hover:text-[#FFFFFF] transition-colors"
            >
              <ArrowLeft className="h-3.5 w-3.5" /> All payments
            </Link>
          </div>
        }
      />

      {loading && !payment ? (
        <Card>
          <LoadingBlock label="Loading transaction details…" />
        </Card>
      ) : error ? (
        <Card>
          <CardBody className="py-14 text-center">
            <p className="text-base font-semibold text-[#F4F4F5]">
              {notFound ? "Payment not found" : invalidId ? "Invalid payment ID" : "Could not load payment"}
            </p>
            <p className="mx-auto mt-1.5 max-w-md text-xs text-[#8E8E93]">
              {notFound
                ? "This transaction may not exist in your account, or the ID may be mistyped."
                : error.message}
            </p>
            <div className="mt-5 flex justify-center gap-2">
              {!invalidId && (
                <Button variant="secondary" size="sm" onClick={handleRefreshAll}>
                  <RefreshCw className="h-3.5 w-3.5" /> Retry
                </Button>
              )}
              <Link
                to="/payments"
                className="inline-flex h-8 items-center rounded-lg bg-indigo-600 px-3.5 text-xs font-medium text-white hover:bg-indigo-500 transition-colors"
              >
                Back to payments
              </Link>
            </div>
          </CardBody>
        </Card>
      ) : payment ? (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
          {/* Main Transaction Card */}
          <div className="space-y-6">
            <Card>
              <div className="flex flex-wrap items-center justify-between border-b border-[#232529] p-6">
                <div>
                  <p className="text-xs font-medium uppercase tracking-wider text-[#71717A]">Transaction amount</p>
                  <p className="mt-1 text-3xl font-extrabold tracking-tight text-[#F4F4F5]">
                    {formatMoney(payment.amount, payment.currency)}
                  </p>
                  {refundedAmount > 0 && (
                    <p className="mt-1 text-xs text-rose-400 font-medium">
                      {formatMoney(refundedAmount, payment.currency)} refunded ({formatMoney(remainingRefundable, payment.currency)} net)
                    </p>
                  )}
                </div>
                <div className="flex flex-col items-end gap-1.5">
                  <div className="flex items-center gap-1.5">
                    <span className={`chip text-xs ${status.className}`}>{status.label}</span>
                    {payment.refundStatus && payment.refundStatus !== "NONE" && (
                      <span className={`chip text-xs ${refundStatusStyle.className}`}>
                        {refundStatusStyle.label}
                      </span>
                    )}
                  </div>
                  <span className="text-[11px] text-[#71717A]">
                    {formatDateTime(payment.createdAt)}
                  </span>
                </div>
              </div>

              <CardBody className="p-6">
                <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-[#71717A]">
                  Payment Information
                </h3>
                <dl className="divide-y divide-[#1E2024]">
                  <InfoRow label="Payment ID">
                    <span className="flex items-center gap-2">
                      <code className="break-all font-mono text-xs font-medium text-[#E4E4E7]">
                        {payment._id}
                      </code>
                      <CopyButton value={payment._id} showLabel={false} label="Copy payment ID" />
                    </span>
                  </InfoRow>
                  <InfoRow label="Checkout URL">
                    <span className="flex items-center gap-2">
                      <a
                        href={`/checkout/${payment._id}`}
                        target="_blank"
                        rel="noreferrer"
                        className="truncate font-mono text-xs font-medium text-indigo-400 hover:text-indigo-300 hover:underline max-w-[240px] inline-flex items-center gap-1"
                      >
                        <span>/checkout/{payment._id}</span>
                        <ExternalLink className="h-3 w-3 shrink-0" />
                      </a>
                      <CopyButton
                        value={`${window.location.origin}/checkout/${payment._id}`}
                        showLabel={false}
                        label="Copy customer checkout URL"
                      />
                    </span>
                  </InfoRow>
                  <InfoRow label="Customer Name" value={payment.customerName || "—"} />
                  <InfoRow label="Customer Email" value={payment.customerEmail || "—"} />
                  {payment.customerPhone && (
                    <InfoRow label="Customer Phone" value={payment.customerPhone} />
                  )}
                  <InfoRow label="Currency" value={payment.currency || "INR"} />
                  {refundedAmount > 0 && (
                    <>
                      <InfoRow label="Refunded Amount">
                        <span className="text-xs font-semibold text-rose-400">
                          {formatMoney(refundedAmount, payment.currency)}
                        </span>
                      </InfoRow>
                      <InfoRow label="Remaining Refundable">
                        <span className="text-xs font-semibold text-emerald-400">
                          {formatMoney(remainingRefundable, payment.currency)}
                        </span>
                      </InfoRow>
                      <InfoRow label="Refund Status">
                        <span className={`chip text-xs ${refundStatusStyle.className}`}>
                          {refundStatusStyle.label}
                        </span>
                      </InfoRow>
                    </>
                  )}
                  <InfoRow label="Created At" value={formatDateTime(payment.createdAt)} />
                  <InfoRow label="Last Updated" value={formatDateTime(payment.updatedAt)} />
                </dl>
              </CardBody>
            </Card>

            {/* Refund History Table */}
            <Card>
              <div className="flex flex-wrap items-center justify-between border-b border-[#232529] px-6 py-4">
                <div className="flex items-center gap-2.5">
                  <span className="grid h-8 w-8 place-items-center rounded-lg bg-rose-500/10 text-rose-400 border border-rose-500/20">
                    <RotateCcw className="h-4 w-4" />
                  </span>
                  <div>
                    <h3 className="text-sm font-semibold text-[#F4F4F5]">Refund History</h3>
                    <p className="text-xs text-[#8E8E93]">
                      Reversals and ledger debit entries for this payment.
                    </p>
                  </div>
                </div>
                {canRefund && (
                  <Button
                    variant="danger"
                    size="sm"
                    onClick={() => setRefundModalOpen(true)}
                    className="gap-1.5"
                  >
                    <RotateCcw className="h-3.5 w-3.5" /> Issue Refund
                  </Button>
                )}
              </div>

              <CardBody className="p-0">
                {refundList.length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-[#111214] border-b border-[#232529] text-[11px] font-medium uppercase tracking-wider text-[#71717A]">
                        <tr>
                          <th className="px-5 py-3">Refund ID</th>
                          <th className="px-5 py-3">Processor ID</th>
                          <th className="px-5 py-3">Amount</th>
                          <th className="px-5 py-3">Status</th>
                          <th className="px-5 py-3">Reason</th>
                          <th className="px-5 py-3">Created</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#1E2024]">
                        {refundList.map((rfn) => {
                          const rfnStyle = statusStyle(REFUND_STATUS_STYLES, rfn.status);
                          return (
                            <tr key={rfn._id} className="hover:bg-[#191A1E] transition-colors">
                              <td className="px-5 py-3.5 font-mono">
                                <div className="flex items-center gap-1.5">
                                  <span className="font-medium text-[#E4E4E7]">{shortId(rfn._id)}</span>
                                  <CopyButton value={rfn._id} showLabel={false} label="Copy refund ID" />
                                </div>
                              </td>
                              <td className="px-5 py-3.5 font-mono text-[#D4D4D8]">
                                {rfn.processorRefundId ? (
                                  <div className="flex items-center gap-1">
                                    <span>{rfn.processorRefundId}</span>
                                    <CopyButton value={rfn.processorRefundId} showLabel={false} label="Copy processor ID" />
                                  </div>
                                ) : (
                                  <span className="text-[#636366]">—</span>
                                )}
                              </td>
                              <td className="px-5 py-3.5 font-semibold text-[#F4F4F5] whitespace-nowrap">
                                {formatMoney(rfn.amount, rfn.currency || payment.currency)}
                              </td>
                              <td className="px-5 py-3.5">
                                <span className={`chip ${rfnStyle.className}`}>
                                  {rfnStyle.label}
                                </span>
                              </td>
                              <td className="px-5 py-3.5 text-[#8E8E93] max-w-[200px] truncate" title={rfn.reason}>
                                {rfn.reason || "requested_by_customer"}
                              </td>
                              <td className="px-5 py-3.5 text-[#71717A] whitespace-nowrap">
                                {formatDateTime(rfn.createdAt)}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="py-10 text-center px-4">
                    <p className="text-xs font-semibold text-[#F4F4F5]">No refunds recorded yet</p>
                    <p className="mt-1 text-xs text-[#8E8E93] max-w-sm mx-auto">
                      {payment.status === "SUCCEEDED"
                        ? `This payment has a refundable balance of ${formatMoney(remainingRefundable, payment.currency)}.`
                        : "Only succeeded payments can be refunded."}
                    </p>
                    {canRefund && (
                      <div className="mt-3.5">
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => setRefundModalOpen(true)}
                          className="gap-1.5"
                        >
                          <RotateCcw className="h-3.5 w-3.5" /> Refund this payment
                        </Button>
                      </div>
                    )}
                  </div>
                )}
              </CardBody>
            </Card>

            {/* Processor & Integration Details */}
            {(payment.failureReason || payment.razorpayOrderId || payment.razorpayPaymentId) && (
              <Card>
                <CardBody className="p-6">
                  <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-[#71717A]">
                    Processor & Gateway Info
                  </h3>
                  <dl className="divide-y divide-[#1E2024]">
                    {payment.razorpayOrderId && (
                      <InfoRow label="Razorpay Order ID" value={payment.razorpayOrderId} mono />
                    )}
                    {payment.razorpayPaymentId && (
                      <InfoRow
                        label="Razorpay Payment ID"
                        value={payment.razorpayPaymentId}
                        mono
                      />
                    )}
                    {payment.failureReason && (
                      <InfoRow label="Failure Reason">
                        <span className="text-xs font-medium text-rose-400">
                          {payment.failureReason}
                        </span>
                      </InfoRow>
                    )}
                  </dl>
                </CardBody>
              </Card>
            )}
          </div>

          {/* Sidebar / Quick Ledger Context & Refund Summary */}
          <div className="space-y-4">
            {/* Refund Settlement Card */}
            <Card>
              <CardBody className="space-y-4 p-5">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-[#71717A]">
                  Settlement & Reversals
                </h3>
                <div className="rounded-lg border border-[#232529] bg-[#111215] p-3.5 text-xs space-y-2.5">
                  <div className="flex items-center justify-between text-[#8E8E93]">
                    <span>Gross Capture</span>
                    <span className="font-semibold text-[#F4F4F5]">
                      {formatMoney(totalAmount, payment.currency)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-[#8E8E93]">
                    <span>Total Refunded</span>
                    <span className="font-semibold text-rose-400">
                      {refundedAmount > 0 ? `-${formatMoney(refundedAmount, payment.currency)}` : "₹0.00"}
                    </span>
                  </div>
                  <div className="border-t border-[#232529] pt-2.5 flex items-center justify-between font-semibold text-[#F4F4F5]">
                    <span>Net Settled</span>
                    <span className="text-emerald-400">
                      {formatMoney(Math.max(0, totalAmount - refundedAmount), payment.currency)}
                    </span>
                  </div>
                </div>

                {canRefund ? (
                  <Button
                    variant="danger"
                    size="sm"
                    className="w-full gap-1.5"
                    onClick={() => setRefundModalOpen(true)}
                  >
                    <RotateCcw className="h-3.5 w-3.5" /> Issue Refund
                  </Button>
                ) : remainingRefundable <= 0 && refundedAmount > 0 ? (
                  <div className="rounded-lg bg-purple-500/10 border border-purple-500/20 p-2 text-center text-xs font-medium text-purple-300">
                    Fully Refunded
                  </div>
                ) : null}
              </CardBody>
            </Card>

            <Card>
              <CardBody className="space-y-4 p-5">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-[#71717A]">
                  Ledger Context
                </h3>
                <div className="rounded-lg border border-[#232529] bg-[#111215] p-3.5 text-xs space-y-2.5">
                  <div className="flex items-center justify-between text-[#8E8E93]">
                    <span>Ledger Status</span>
                    <span className="font-medium text-emerald-400">Double-Entry Settled</span>
                  </div>
                  <div className="flex items-center justify-between text-[#71717A]">
                    <span>Audit Trail</span>
                    <span className="text-[#A1A1AA] font-medium">Immutable</span>
                  </div>
                  {refundedAmount > 0 && (
                    <div className="flex items-center justify-between text-rose-400">
                      <span>Ledger Reversal</span>
                      <span className="font-medium">Debited to Merchant</span>
                    </div>
                  )}
                </div>
                <p className="text-[11px] leading-relaxed text-[#8E8E93]">
                  Transactions in ClearLedger automatically credit merchant ledger accounts upon capture and debit upon refund.
                </p>
                <Link
                  to="/ledger"
                  className="inline-flex w-full items-center justify-center rounded-lg border border-[#282A30] bg-[#16171A] py-2 text-xs font-medium text-[#D4D4D8] hover:bg-[#1C1D21] hover:text-[#FFFFFF] transition-colors"
                >
                  View full ledger entries →
                </Link>
              </CardBody>
            </Card>
          </div>
        </div>
      ) : null}

      {/* Refund Modal */}
      <RefundModal
        isOpen={refundModalOpen}
        onClose={() => setRefundModalOpen(false)}
        payment={payment}
        onSuccess={() => {
          handleRefreshAll();
          setTimeout(handleRefreshAll, 1000);
          setTimeout(handleRefreshAll, 3000);
        }}
      />
    </div>
  );
}
