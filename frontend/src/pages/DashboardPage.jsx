import { Link } from "react-router-dom";
import {
  Activity,
  ArrowRight,
  Code2,
  CreditCard,
  Plus,
  Receipt,
  RefreshCw,
  RotateCcw,
  TrendingUp,
  Wallet,
  Webhook,
} from "lucide-react";
import { getBalance, getPayments } from "../lib/api.js";
import { formatMoney, shortId, timeAgo } from "../lib/format.js";
import { PAYMENT_STATUS_STYLES, statusStyle } from "../lib/constants.js";
import { useAuth } from "../context/AuthContext.jsx";
import { useHealth } from "../hooks/useHealth.js";
import { useFetch } from "../hooks/useFetch.js";
import PageHeader from "../components/ui/PageHeader.jsx";
import StatCard from "../components/ui/StatCard.jsx";
import Button from "../components/ui/Button.jsx";
import EmptyState from "../components/ui/EmptyState.jsx";
import { Card, CardBody, CardHeader } from "../components/ui/Card.jsx";
import { SkeletonCard } from "../components/ui/Skeleton.jsx";

export default function DashboardPage() {
  const { apiKey, isConnected, merchant } = useAuth();
  const balance = useFetch(() => getBalance(apiKey), [apiKey], { enabled: isConnected });
  const paymentsFetch = useFetch(
    () => getPayments(apiKey, { limit: 10 }),
    [apiKey],
    { enabled: isConnected },
  );
  const health = useHealth();
  const balanceData = balance.data?.balance || balance.data;
  const currency = balanceData?.currency || "INR";

  const payments = (paymentsFetch.data?.data || []).map((p) => ({
    ...p,
    paymentId: p.paymentId || p._id,
  }));
  const succeeded = payments.filter((payment) => payment.status === "SUCCEEDED").length;
  const recent = [...payments]
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .slice(0, 5);

  const handleSync = () => {
    balance.refresh();
    paymentsFetch.refresh();
  };

  return (
    <div className="animate-fade-in space-y-6">
      <PageHeader
        title="Overview"
        description={`Welcome back${merchant?.name ? `, ${merchant.name}` : ""}. Monitor your live ledger balance, settlements, and recent gateway charges.`}
        actions={
          <div className="flex items-center gap-2.5">
            <Button
              variant="secondary"
              size="sm"
              onClick={handleSync}
              loading={balance.loading || paymentsFetch.loading}
              title="Refresh ledger balance and transactions"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Sync
            </Button>
            <Link
              to="/payments"
              className="inline-flex h-9 items-center gap-2 rounded-lg bg-indigo-600 px-3.5 text-xs font-medium text-white shadow-xs hover:bg-indigo-500 active:bg-indigo-700 transition-colors"
            >
              <Plus className="h-4 w-4" />
              Create payment
            </Link>
          </div>
        }
      />

      {/* Top Metrics Row: Balanced 3-column grid */}
      {balance.loading && !balanceData ? (
        <div className="grid gap-4 sm:grid-cols-3">
          {[0, 1, 2].map((item) => (
            <SkeletonCard key={item} />
          ))}
        </div>
      ) : balance.error ? (
        <Card>
          <CardBody className="flex flex-wrap items-center justify-between gap-3 p-5">
            <div>
              <p className="text-sm font-semibold text-[#F4F4F5]">Ledger balance unavailable</p>
              <p className="mt-1 text-xs text-[#8E8E93]">{balance.error.message}</p>
            </div>
            <Button variant="secondary" size="sm" onClick={balance.refresh}>
              <RefreshCw className="h-3.5 w-3.5" /> Try again
            </Button>
          </CardBody>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-3">
          <StatCard
            label="Available balance"
            icon={Wallet}
            tone="brand"
            value={formatMoney(balanceData?.availableBalance ?? 0, currency)}
            sublabel="Settled in double-entry ledger"
          />
          <StatCard
            label="Successful payments"
            icon={CreditCard}
            tone="success"
            value={succeeded}
            sublabel={`${payments.length} total transactions`}
          />
          <StatCard
            label="Total credited"
            icon={TrendingUp}
            tone="brand"
            value={formatMoney(balanceData?.totalCredits ?? 0, currency)}
            sublabel="Cumulative inbound settlement"
          />
        </div>
      )}

      {/* Main Grid: Transactions & System Console */}
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
        {/* Recent Transactions Card */}
        <Card className="flex flex-col">
          <CardHeader
            title="Recent transactions"
            description="Latest transactions synchronized from ClearLedger database."
            action={
              <Link
                to="/payments"
                className="inline-flex items-center gap-1 text-xs font-medium text-indigo-400 hover:text-indigo-300 transition-colors"
              >
                View all <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            }
          />
          <CardBody className="flex-1 p-0">
            {recent.length ? (
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr>
                      <th className="px-5 py-3">Payment</th>
                      <th className="px-5 py-3">Customer</th>
                      <th className="px-5 py-3">Amount</th>
                      <th className="px-5 py-3">Status</th>
                      <th className="px-5 py-3 text-right">Created</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#1E2024]">
                    {recent.map((payment) => {
                      const status = statusStyle(PAYMENT_STATUS_STYLES, payment.status);
                      return (
                        <tr key={payment.paymentId} className="hover:bg-[#191A1E] transition-colors">
                          <td className="px-5 py-3.5">
                            <Link
                              className="font-mono text-xs font-medium text-indigo-400 hover:text-indigo-300 hover:underline"
                              to={`/payments/${payment.paymentId}`}
                            >
                              {shortId(payment.paymentId)}
                            </Link>
                          </td>
                          <td className="max-w-[200px] truncate px-5 py-3.5 text-xs text-[#8E8E93]">
                            {payment.customerEmail || "—"}
                          </td>
                          <td className="whitespace-nowrap px-5 py-3.5 text-xs font-semibold text-[#F4F4F5]">
                            {formatMoney(payment.amount, payment.currency)}
                          </td>
                          <td className="px-5 py-3.5">
                            <span className={`chip ${status.className}`}>{status.label}</span>
                          </td>
                          <td className="whitespace-nowrap px-5 py-3.5 text-right text-xs text-[#71717A]">
                            {timeAgo(payment.createdAt)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <EmptyState
                icon={Receipt}
                title="No recent transactions"
                description="Payments you process will appear here in real time with ledger status."
                action={
                  <Link
                    to="/payments"
                    className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-3.5 py-2 text-xs font-medium text-white hover:bg-indigo-500 transition-colors"
                  >
                    <Plus className="h-3.5 w-3.5" /> Create payment
                  </Link>
                }
                className="py-14"
              />
            )}
          </CardBody>
        </Card>

        {/* System & Developer Status Card */}
        <div className="space-y-4">
          <Card>
            <CardHeader title="Gateway status" icon={Activity} />
            <CardBody className="space-y-4 p-5">
              <div className="space-y-3">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-[#8E8E93]">API Gateway</span>
                  <StatusBadge loading={health.loading} ok={health.apiUp} />
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-[#8E8E93]">Ledger Engine (Redis)</span>
                  <StatusBadge loading={health.loading} ok={health.redisUp} />
                </div>
              </div>

              <div className="rounded-lg border border-[#232529] bg-[#111215] p-3 text-xs">
                <div className="flex items-center justify-between text-[#8E8E93]">
                  <span>Merchant Mode</span>
                  <span className="font-medium text-[#F4F4F5]">Live Gateway</span>
                </div>
                <div className="mt-1.5 flex items-center justify-between text-[#71717A]">
                  <span>Settlement</span>
                  <span className="text-[#A1A1AA] font-medium">Instant Double-Entry</span>
                </div>
              </div>

              <Button
                variant="secondary"
                size="sm"
                className="w-full"
                onClick={health.refresh}
                loading={health.loading}
              >
                <RefreshCw className="h-3.5 w-3.5" /> Refresh health
              </Button>
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Developer shortcuts" />
            <CardBody className="space-y-1 p-2.5">
              <Link
                to="/refunds"
                className="flex items-center justify-between rounded-lg p-2.5 text-xs text-[#D4D4D8] transition-colors hover:bg-[#1C1D21] hover:text-[#FFFFFF]"
              >
                <div className="flex items-center gap-2.5">
                  <RotateCcw className="h-3.5 w-3.5 text-rose-400" />
                  <span>Refunds & Reversals</span>
                </div>
                <ArrowRight className="h-3 w-3 text-[#71717A]" />
              </Link>
              <Link
                to="/api"
                className="flex items-center justify-between rounded-lg p-2.5 text-xs text-[#D4D4D8] transition-colors hover:bg-[#1C1D21] hover:text-[#FFFFFF]"
              >
                <div className="flex items-center gap-2.5">
                  <Code2 className="h-3.5 w-3.5 text-indigo-400" />
                  <span>API Reference</span>
                </div>
                <ArrowRight className="h-3 w-3 text-[#71717A]" />
              </Link>
              <Link
                to="/webhooks"
                className="flex items-center justify-between rounded-lg p-2.5 text-xs text-[#D4D4D8] transition-colors hover:bg-[#1C1D21] hover:text-[#FFFFFF]"
              >
                <div className="flex items-center gap-2.5">
                  <Webhook className="h-3.5 w-3.5 text-indigo-400" />
                  <span>Webhook Endpoints</span>
                </div>
                <ArrowRight className="h-3 w-3 text-[#71717A]" />
              </Link>
            </CardBody>
          </Card>
        </div>
      </div>
    </div>
  );
}

function StatusBadge({ loading, ok }) {
  const label = loading ? "Checking" : ok ? "Operational" : "Unavailable";
  return (
    <span
      className={`chip ${
        loading
          ? "border-[#282A30] bg-[#18191D] text-[#8E8E93]"
          : ok
            ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-400"
            : "border-rose-500/20 bg-rose-500/10 text-rose-400"
      }`}
    >
      <span
        className={`h-1.5 w-1.5 rounded-full ${
          loading
            ? "bg-[#71717A]"
            : ok
              ? "bg-emerald-400"
              : "bg-rose-400"
        }`}
      />
      {label}
    </span>
  );
}
