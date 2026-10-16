import { useEffect } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, Receipt, RefreshCw } from "lucide-react";
import { ApiError, getPayment } from "../lib/api.js";
import { formatDateTime, formatMoney } from "../lib/format.js";
import { PAYMENT_STATUS_STYLES, statusStyle } from "../lib/constants.js";
import { useAuth } from "../context/AuthContext.jsx";
import { useFetch } from "../hooks/useFetch.js";
import { saveSessionPayment } from "../lib/paymentStore.js";
import PageHeader from "../components/ui/PageHeader.jsx";
import Button from "../components/ui/Button.jsx";
import CopyButton from "../components/ui/CopyButton.jsx";
import { Card, CardBody } from "../components/ui/Card.jsx";
import { InfoRow } from "../components/ui/InfoRow.jsx";
import { LoadingBlock } from "../components/ui/Spinner.jsx";

export default function PaymentDetailPage() {
  const { id } = useParams();
  const { apiKey } = useAuth();
  const { data: payment, loading, error, refresh } = useFetch(
    () => getPayment(id, apiKey),
    [id, apiKey],
    { enabled: Boolean(id && apiKey) }
  );

  useEffect(() => {
    if (payment) saveSessionPayment({ ...payment, paymentId: payment.paymentId || payment._id });
  }, [payment]);

  const status = statusStyle(PAYMENT_STATUS_STYLES, payment?.status);
  const notFound = error instanceof ApiError && error.status === 404;
  const invalidId = error instanceof ApiError && error.status === 400;

  return (
    <div className="animate-fade-in space-y-6">
      <PageHeader
        title="Payment details"
        description={payment ? `Reference ID ${payment._id || id}` : "Inspect transaction ledger details."}
        actions={
          <div className="flex items-center gap-2">
            <Button variant="secondary" size="sm" onClick={refresh} loading={loading}>
              <RefreshCw className="h-3.5 w-3.5" /> Refresh
            </Button>
            <Link
              to="/payments"
              className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-ink-200 bg-white px-3 text-xs font-semibold text-ink-700 hover:bg-ink-50"
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
            <p className="text-base font-semibold text-ink-900">
              {notFound ? "Payment not found" : invalidId ? "Invalid payment ID" : "Could not load payment"}
            </p>
            <p className="mx-auto mt-1.5 max-w-md text-xs text-ink-500">
              {notFound
                ? "This transaction may not exist in your account, or the ID may be mistyped."
                : error.message}
            </p>
            <div className="mt-5 flex justify-center gap-2">
              {!invalidId && (
                <Button variant="secondary" size="sm" onClick={refresh}>
                  <RefreshCw className="h-3.5 w-3.5" /> Retry
                </Button>
              )}
              <Link
                to="/payments"
                className="inline-flex h-8 items-center rounded-lg bg-brand-600 px-3.5 text-xs font-semibold text-white hover:bg-brand-700"
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
              <div className="flex flex-wrap items-center justify-between border-b border-ink-100 p-6">
                <div>
                  <p className="text-xs font-medium text-ink-500">Transaction amount</p>
                  <p className="mt-1 text-3xl font-bold tracking-tight text-ink-950">
                    {formatMoney(payment.amount, payment.currency)}
                  </p>
                </div>
                <div className="flex flex-col items-end gap-1.5">
                  <span className={`chip text-xs ${status.className}`}>{status.label}</span>
                  <span className="text-[11px] text-ink-400">
                    {formatDateTime(payment.createdAt)}
                  </span>
                </div>
              </div>

              <CardBody className="p-6">
                <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-ink-400">
                  Payment Information
                </h3>
                <dl className="divide-y divide-ink-100">
                  <InfoRow label="Payment ID">
                    <span className="flex items-center gap-2">
                      <code className="break-all font-mono text-xs font-medium text-ink-800">
                        {payment._id}
                      </code>
                      <CopyButton value={payment._id} showLabel={false} label="Copy payment ID" />
                    </span>
                  </InfoRow>
                  <InfoRow label="Customer Email" value={payment.customerEmail || "—"} />
                  {payment.customerPhone && (
                    <InfoRow label="Customer Phone" value={payment.customerPhone} />
                  )}
                  <InfoRow label="Currency" value={payment.currency || "INR"} />
                  <InfoRow label="Created At" value={formatDateTime(payment.createdAt)} />
                  <InfoRow label="Last Updated" value={formatDateTime(payment.updatedAt)} />
                </dl>
              </CardBody>
            </Card>

            {/* Processor & Integration Details */}
            {(payment.failureReason || payment.razorpayOrderId || payment.razorpayPaymentId) && (
              <Card>
                <CardBody className="p-6">
                  <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-ink-400">
                    Processor & Gateway Info
                  </h3>
                  <dl className="divide-y divide-ink-100">
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
                        <span className="text-xs font-medium text-rose-600">
                          {payment.failureReason}
                        </span>
                      </InfoRow>
                    )}
                  </dl>
                </CardBody>
              </Card>
            )}
          </div>

          {/* Sidebar / Quick Ledger Context */}
          <div className="space-y-4">
            <Card>
              <CardBody className="space-y-3.5 p-5">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-ink-400">
                  Ledger Context
                </h3>
                <div className="rounded-xl border border-ink-100 bg-ink-50/70 p-3 text-xs space-y-2">
                  <div className="flex items-center justify-between text-ink-600">
                    <span>Ledger Status</span>
                    <span className="font-semibold text-emerald-700">Double-Entry Settled</span>
                  </div>
                  <div className="flex items-center justify-between text-ink-500">
                    <span>Audit Trail</span>
                    <span>Immutable</span>
                  </div>
                </div>
                <p className="text-[11px] leading-relaxed text-ink-400">
                  Transactions in ClearLedger automatically credit merchant ledger accounts upon successful processor capture.
                </p>
                <Link
                  to="/ledger"
                  className="inline-flex w-full items-center justify-center rounded-lg border border-ink-200 bg-white py-2 text-xs font-semibold text-ink-700 hover:bg-ink-50"
                >
                  View full ledger entries →
                </Link>
              </CardBody>
            </Card>
          </div>
        </div>
      ) : null}
    </div>
  );
}
