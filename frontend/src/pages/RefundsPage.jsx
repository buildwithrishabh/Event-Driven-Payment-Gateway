import { useMemo, useState, useEffect } from "react";
import { Link } from "react-router-dom";
import {
  RotateCcw,
  RefreshCw,
  Search,
  CheckCircle2,
  AlertCircle,
  Clock,
  ArrowRight,
  ExternalLink,
  Info,
  CreditCard,
  Code,
  ShieldCheck,
} from "lucide-react";
import { getRefunds, getRefund, getPaymentRefunds, ApiError } from "../lib/api.js";
import { formatDateTime, formatMoney, shortId } from "../lib/format.js";
import { REFUND_STATUS_STYLES, statusStyle } from "../lib/constants.js";
import { useAuth } from "../context/AuthContext.jsx";
import { useToast } from "../context/ToastContext.jsx";
import { useFetch } from "../hooks/useFetch.js";
import PageHeader from "../components/ui/PageHeader.jsx";
import StatCard from "../components/ui/StatCard.jsx";
import Button from "../components/ui/Button.jsx";
import CopyButton from "../components/ui/CopyButton.jsx";
import { Card, CardBody, CardHeader } from "../components/ui/Card.jsx";
import RefundModal from "../components/refunds/RefundModal.jsx";

export default function RefundsPage() {
  const { apiKey } = useAuth();
  const toast = useToast();

  const [statusFilter, setStatusFilter] = useState("ALL");
  const [search, setSearch] = useState("");
  const [directLookupId, setDirectLookupId] = useState("");
  const [directResult, setDirectResult] = useState(null);
  const [directLoading, setDirectLoading] = useState(false);
  const [directError, setDirectError] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Fetch all refunds from backend if implemented
  const refundsFetch = useFetch(
    async () => {
      try {
        const res = await getRefunds(apiKey, {
          limit: 50,
          status: statusFilter === "ALL" ? undefined : statusFilter,
          search: search.trim() || undefined,
        });
        return res;
      } catch (err) {
        if (err instanceof ApiError && (err.status === 404 || err.status === 501)) {
          // Graceful flag when backend does not have GET /v1/refunds mounted yet
          return { notImplemented: true, data: [] };
        }
        throw err;
      }
    },
    [apiKey, statusFilter, search],
    { enabled: Boolean(apiKey) }
  );

  const isEndpointMissing = Boolean(refundsFetch.data?.notImplemented);
  const refundsData = refundsFetch.data?.data || refundsFetch.data?.refunds || [];

  const filteredRefunds = useMemo(() => {
    if (!Array.isArray(refundsData)) return [];
    const q = search.trim().toLowerCase();
    return refundsData.filter((r) => {
      if (statusFilter !== "ALL" && r.status !== statusFilter) return false;
      if (!q) return true;
      return [r._id, r.paymentId, r.processorRefundId, r.reason, r.status]
        .some((val) => String(val || "").toLowerCase().includes(q));
    });
  }, [refundsData, statusFilter, search]);

  // Metric aggregates
  const stats = useMemo(() => {
    let totalVolume = 0;
    let succeededCount = 0;
    let pendingCount = 0;
    let failedCount = 0;

    for (const r of filteredRefunds) {
      if (r.status === "SUCCEEDED") {
        totalVolume += r.amount || 0;
        succeededCount++;
      } else if (r.status === "PENDING" || r.status === "PROCESSING") {
        pendingCount++;
      } else if (r.status === "FAILED") {
        failedCount++;
      }
    }

    return {
      totalVolume,
      succeededCount,
      pendingCount,
      failedCount,
    };
  }, [filteredRefunds]);

  // Live Auto-Polling: poll if any refund in the list is in PENDING or PROCESSING state
  const hasInFlightRefund = useMemo(() => {
    return Array.isArray(refundsData) && refundsData.some(
      (r) => r.status === "PENDING" || r.status === "PROCESSING"
    );
  }, [refundsData]);

  useEffect(() => {
    if (!hasInFlightRefund) return;

    const interval = setInterval(() => {
      refundsFetch.refresh();
    }, 2500);

    return () => clearInterval(interval);
  }, [hasInFlightRefund, refundsFetch]);

  // Live Auto-Polling for Direct Lookup result if it is pending/processing
  const hasInFlightDirect = useMemo(() => {
    if (!directResult) return false;
    if (directResult.type === "single") {
      return (
        directResult.item?.status === "PENDING" ||
        directResult.item?.status === "PROCESSING"
      );
    }
    if (directResult.type === "payment" && Array.isArray(directResult.list)) {
      return directResult.list.some(
        (r) => r.status === "PENDING" || r.status === "PROCESSING"
      );
    }
    return false;
  }, [directResult]);

  useEffect(() => {
    if (!hasInFlightDirect || !directLookupId.trim()) return;

    const interval = setInterval(async () => {
      try {
        if (directResult.type === "single") {
          const { refund } = await getRefund(directLookupId.trim(), apiKey);
          if (refund) {
            setDirectResult({ type: "single", item: refund });
          }
        } else if (directResult.type === "payment") {
          const { refunds } = await getPaymentRefunds(directLookupId.trim(), apiKey);
          if (refunds) {
            setDirectResult({ type: "payment", list: refunds, paymentId: directLookupId.trim() });
          }
        }
      } catch {
        // silent polling catch
      }
    }, 2500);

    return () => clearInterval(interval);
  }, [hasInFlightDirect, directLookupId, apiKey, directResult?.type]);

  async function handleDirectLookup(e) {
    e.preventDefault();
    const id = directLookupId.trim();
    if (!id) return;

    setDirectLoading(true);
    setDirectError("");
    setDirectResult(null);

    try {
      // First attempt single refund lookup
      try {
        const { refund } = await getRefund(id, apiKey);
        if (refund) {
          setDirectResult({ type: "single", item: refund });
          toast.success("Refund found", `Refund ${shortId(refund._id)}`);
          return;
        }
      } catch (singleErr) {
        // If not found as refund ID, try looking up as payment ID
        try {
          const { refunds } = await getPaymentRefunds(id, apiKey);
          if (refunds && refunds.length > 0) {
            setDirectResult({ type: "payment", list: refunds, paymentId: id });
            toast.success("Payment refunds found", `Found ${refunds.length} refund(s)`);
            return;
          }
        } catch {
          // Ignore and rethrow original or generic
        }
        throw singleErr;
      }
    } catch (err) {
      setDirectError(err.message || "No refund or payment refunds found with that ID.");
      toast.error("Lookup failed", err.message || "Not found.");
    } finally {
      setDirectLoading(false);
    }
  }

  return (
    <div className="animate-fade-in space-y-6">
      <PageHeader
        title="Refunds"
        description="Inspect reversed charges, track upstream processor refund statuses, and issue customer refunds."
        actions={
          <div className="flex items-center gap-2">
            {hasInFlightRefund && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/10 px-2.5 py-1 text-[11px] font-semibold text-amber-400 border border-amber-500/20 animate-pulse">
                <RefreshCw className="h-3 w-3 animate-spin text-amber-400" />
                Live updating...
              </span>
            )}
            <Button
              variant="primary"
              size="sm"
              onClick={() => setIsModalOpen(true)}
              className="gap-1.5"
            >
              <RotateCcw className="h-3.5 w-3.5" /> Issue refund
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={refundsFetch.refresh}
              loading={refundsFetch.loading}
              title="Refresh refunds"
            >
              <RefreshCw className="h-3.5 w-3.5" /> Refresh
            </Button>
          </div>
        }
      />

      {/* Backend Route Notice (if GET /v1/refunds not implemented in backend) */}
      {isEndpointMissing && (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-xs text-amber-300">
          <div className="flex items-start gap-3">
            <Info className="h-4 w-4 shrink-0 text-amber-400 mt-0.5" />
            <div className="flex-1 space-y-1">
              <p className="font-bold text-white">
                Notice: Backend endpoint <code>GET /v1/refunds</code> is not yet configured for full listing.
              </p>
              <p className="text-amber-200/90 leading-relaxed">
                Individual refund issuance (<code>POST /v1/refunds</code>) and payment refund queries (<code>GET /v1/refunds/payment/:id</code>) are active! To enable the global list view across all payments, follow the backend steps provided by Antigravity.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Metrics Row */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Total Refunded Volume"
          value={formatMoney(stats.totalVolume, "INR")}
          sublabel="Settled reversals"
          icon={RotateCcw}
          tone="brand"
        />
        <StatCard
          label="Succeeded Refunds"
          value={stats.succeededCount}
          sublabel="Successfully credited"
          icon={CheckCircle2}
          tone="success"
        />
        <StatCard
          label="In-Flight / Pending"
          value={stats.pendingCount}
          sublabel="Processing with processor"
          icon={Clock}
          tone="warning"
        />
        <StatCard
          label="Failed Reversals"
          value={stats.failedCount}
          sublabel="Upstream rejections"
          icon={AlertCircle}
          tone="danger"
        />
      </div>

      {/* Direct Lookup Box */}
      <Card>
        <CardBody className="p-4 bg-[#111215]">
          <form onSubmit={handleDirectLookup} className="flex flex-col gap-3 sm:flex-row items-center">
            <div className="relative min-w-0 flex-1 w-full">
              <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
              <input
                className="input pl-9 text-xs sm:text-sm w-full"
                value={directLookupId}
                onChange={(e) => setDirectLookupId(e.target.value)}
                placeholder="Direct Lookup: Enter Refund ID or Payment ID (e.g. 671146869b8fa588ca752f92)..."
              />
            </div>
            <Button
              type="submit"
              variant="secondary"
              size="md"
              loading={directLoading}
              disabled={!directLookupId.trim()}
              className="w-full sm:w-auto"
            >
              Lookup
            </Button>
          </form>

          {/* Direct Lookup Results */}
          {directError && (
            <p className="mt-2 text-xs text-rose-400 font-medium">{directError}</p>
          )}

          {directResult && (
            <div className="mt-4 rounded-xl border border-[#232529] bg-[#16171A] p-4">
              <div className="flex items-center justify-between mb-3 border-b border-[#232529] pb-2">
                <span className="text-xs font-bold text-[#F4F4F5]">
                  {directResult.type === "single"
                    ? "Single Refund Found"
                    : `Refunds for Payment ${shortId(directResult.paymentId)}`}
                </span>
                <button
                  type="button"
                  onClick={() => setDirectResult(null)}
                  className="text-xs text-zinc-400 hover:text-white transition-colors font-medium"
                >
                  Dismiss
                </button>
              </div>

              {directResult.type === "single" ? (
                <div className="grid sm:grid-cols-4 gap-3 text-xs">
                  <div>
                    <span className="text-zinc-500 text-[11px] block uppercase font-mono tracking-wider">Refund ID</span>
                    <span className="font-mono font-semibold text-indigo-400">
                      {directResult.item._id}
                    </span>
                  </div>
                  <div>
                    <span className="text-zinc-500 text-[11px] block uppercase font-mono tracking-wider">Amount</span>
                    <span className="font-bold text-[#F4F4F5]">
                      {formatMoney(directResult.item.amount, directResult.item.currency)}
                    </span>
                  </div>
                  <div>
                    <span className="text-zinc-500 text-[11px] block uppercase font-mono tracking-wider">Status</span>
                    <span
                      className={`chip text-[11px] ${
                        statusStyle(REFUND_STATUS_STYLES, directResult.item.status).className
                      }`}
                    >
                      {statusStyle(REFUND_STATUS_STYLES, directResult.item.status).label}
                    </span>
                  </div>
                  <div>
                    <span className="text-zinc-500 text-[11px] block uppercase font-mono tracking-wider">Target Payment</span>
                    <Link
                      to={`/payments/${directResult.item.paymentId}`}
                      className="font-mono text-indigo-400 hover:text-indigo-300 hover:underline font-semibold"
                    >
                      {shortId(directResult.item.paymentId)} →
                    </Link>
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  {directResult.list.map((rfn) => (
                    <div
                      key={rfn._id}
                      className="flex items-center justify-between bg-[#111215] rounded-lg p-2.5 border border-[#232529] text-xs"
                    >
                      <div className="flex items-center gap-3">
                        <span className="font-mono font-semibold text-indigo-400">
                          {shortId(rfn._id)}
                        </span>
                        <span className="font-bold text-[#F4F4F5]">
                          {formatMoney(rfn.amount, rfn.currency)}
                        </span>
                        <span
                          className={`chip text-[10px] ${
                            statusStyle(REFUND_STATUS_STYLES, rfn.status).className
                          }`}
                        >
                          {statusStyle(REFUND_STATUS_STYLES, rfn.status).label}
                        </span>
                      </div>
                      <span className="text-zinc-500 text-[11px] font-mono">
                        {formatDateTime(rfn.createdAt)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </CardBody>
      </Card>

      {/* Refunds List Card */}
      <Card>
        <CardHeader
          title="Refund Records"
          description="Detailed log of all customer refund requests and upstream processor synchronizations."
          action={
            <div className="flex items-center gap-2">
              <select
                className="input text-xs h-8 py-0 px-2.5 rounded-lg border-[#26282E] bg-[#111215] text-[#F4F4F5]"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
              >
                <option value="ALL">All Statuses</option>
                <option value="SUCCEEDED">Succeeded</option>
                <option value="PENDING">Pending</option>
                <option value="PROCESSING">Processing</option>
                <option value="FAILED">Failed</option>
              </select>
            </div>
          }
        />

        {/* Filter input */}
        <div className="border-b border-[#232529] bg-[#111215] p-4">
          <div className="relative min-w-0 flex-1">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
            <input
              className="input pl-9 text-xs sm:text-sm"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Filter by Refund ID, Payment ID, processor ID, or reason..."
            />
          </div>
        </div>

        <CardBody className="p-0">
          {filteredRefunds.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-[#232529] bg-[#111215] text-[11px] font-semibold uppercase tracking-wider text-zinc-400">
                    <th className="px-5 py-3.5">Refund ID</th>
                    <th className="px-5 py-3.5">Payment ID</th>
                    <th className="px-5 py-3.5">Amount</th>
                    <th className="px-5 py-3.5">Status</th>
                    <th className="px-5 py-3.5">Processor ID</th>
                    <th className="px-5 py-3.5">Reason</th>
                    <th className="px-5 py-3.5">Created</th>
                    <th className="px-5 py-3.5 text-right" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#1E2024]">
                  {filteredRefunds.map((refund) => {
                    const st = statusStyle(REFUND_STATUS_STYLES, refund.status);
                    return (
                      <tr key={refund._id} className="hover:bg-white/[0.02] transition-colors">
                        <td className="px-5 py-3.5">
                          <div className="flex items-center gap-1.5">
                            <span className="font-mono text-xs font-semibold text-indigo-400">
                              {shortId(refund._id)}
                            </span>
                            <CopyButton value={refund._id} showLabel={false} label="Copy refund ID" />
                          </div>
                        </td>
                        <td className="px-5 py-3.5">
                          <div className="flex items-center gap-1.5">
                            <Link
                              to={`/payments/${refund.paymentId}`}
                              className="font-mono text-xs font-semibold text-indigo-400 hover:text-indigo-300 hover:underline"
                            >
                              {shortId(refund.paymentId)}
                            </Link>
                            <CopyButton value={refund.paymentId} showLabel={false} label="Copy payment ID" />
                          </div>
                        </td>
                        <td className="whitespace-nowrap px-5 py-3.5 text-xs font-bold text-[#F4F4F5]">
                          {formatMoney(refund.amount, refund.currency || "INR")}
                        </td>
                        <td className="px-5 py-3.5">
                          <span className={`chip ${st.className}`}>{st.label}</span>
                        </td>
                        <td className="px-5 py-3.5 font-mono text-zinc-300">
                          {refund.processorRefundId ? (
                            <div className="flex items-center gap-1">
                              <span>{refund.processorRefundId}</span>
                              <CopyButton
                                value={refund.processorRefundId}
                                showLabel={false}
                                label="Copy processor ID"
                              />
                            </div>
                          ) : (
                            <span className="text-zinc-600">—</span>
                          )}
                        </td>
                        <td className="px-5 py-3.5 text-zinc-300 max-w-[200px] truncate" title={refund.reason}>
                          {refund.reason || "requested_by_customer"}
                        </td>
                        <td className="whitespace-nowrap px-5 py-3.5 text-xs text-zinc-400">
                          {formatDateTime(refund.createdAt)}
                        </td>
                        <td className="px-5 py-3.5 text-right whitespace-nowrap">
                          <Link
                            to={`/payments/${refund.paymentId}`}
                            className="text-xs font-semibold text-indigo-400 hover:text-indigo-300 hover:underline"
                          >
                            Payment →
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="py-14 text-center">
              <div className="mx-auto mb-3 grid h-10 w-10 place-items-center rounded-xl bg-[#1C1D21] text-zinc-400 border border-[#282A30]">
                <RotateCcw className="h-5 w-5" />
              </div>
              <h3 className="text-sm font-bold text-[#F4F4F5]">
                {refundsData.length ? "No matching refunds" : "No refunds issued yet"}
              </h3>
              <p className="mt-1 text-xs text-zinc-400 max-w-sm mx-auto">
                {isEndpointMissing
                  ? "Use the direct lookup above to check any refund by ID or payment ID, or click Issue Refund."
                  : "Issue full or partial refunds for any succeeded transaction at any time."}
              </p>
              <div className="mt-4 flex justify-center gap-2">
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => setIsModalOpen(true)}
                  className="gap-1.5"
                >
                  <RotateCcw className="h-3.5 w-3.5" /> Issue a refund
                </Button>
                <Link
                  to="/payments"
                  className="inline-flex h-8 items-center rounded-lg border border-[#26282E] bg-[#16171A] px-3 text-xs font-semibold text-zinc-300 hover:bg-[#1E2024] hover:text-white transition-colors"
                >
                  View payments
                </Link>
              </div>
            </div>
          )}
        </CardBody>
      </Card>

      {/* Modal */}
      <RefundModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSuccess={() => {
          refundsFetch.refresh();
          setTimeout(() => refundsFetch.refresh(), 1000);
          setTimeout(() => refundsFetch.refresh(), 3000);
        }}
      />
    </div>
  );
}
