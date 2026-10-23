import { Link } from "react-router-dom";
import { BookText, RefreshCw, TrendingDown, TrendingUp, Wallet } from "lucide-react";
import { getBalance, getLedgerEntries } from "../lib/api.js";
import { formatDateTime, formatMoney, shortId } from "../lib/format.js";
import { LEDGER_TYPE_STYLES, statusStyle } from "../lib/constants.js";
import { useAuth } from "../context/AuthContext.jsx";
import { useFetch } from "../hooks/useFetch.js";
import PageHeader from "../components/ui/PageHeader.jsx";
import StatCard from "../components/ui/StatCard.jsx";
import Button from "../components/ui/Button.jsx";
import CopyButton from "../components/ui/CopyButton.jsx";
import { Card, CardBody, CardHeader } from "../components/ui/Card.jsx";
import { SkeletonCard } from "../components/ui/Skeleton.jsx";

export default function LedgerPage() {
  const { apiKey, isConnected } = useAuth();
  const balance = useFetch(() => getBalance(apiKey), [apiKey], { enabled: isConnected });
  const entriesFetch = useFetch(
    () => getLedgerEntries(apiKey, { limit: 50 }),
    [apiKey],
    { enabled: isConnected },
  );

  const balanceData = balance.data?.balance || balance.data;
  const currency = balanceData?.currency || "INR";
  const entries = entriesFetch.data?.data || [];

  const handleRefresh = () => {
    balance.refresh();
    entriesFetch.refresh();
  };

  return (
    <div className="animate-fade-in space-y-6">
      <PageHeader
        title="Ledger"
        description="Immutable double-entry balance accounting and ledger journal transactions."
        actions={
          <Button
            variant="secondary"
            size="sm"
            onClick={handleRefresh}
            loading={balance.loading || entriesFetch.loading}
          >
            <RefreshCw className="h-3.5 w-3.5" /> Refresh ledger
          </Button>
        }
      />

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
              <p className="text-sm font-bold text-[#F4F4F5]">Ledger balance unavailable</p>
              <p className="mt-1 text-xs text-zinc-400">{balance.error.message}</p>
            </div>
            <Button variant="secondary" size="sm" onClick={balance.refresh}>
              Try again
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
            sublabel="Current settled ledger balance"
          />
          <StatCard
            label="Total credits"
            icon={TrendingUp}
            tone="success"
            value={formatMoney(balanceData?.totalCredits ?? 0, currency)}
            sublabel="Inbound captured payments"
          />
          <StatCard
            label="Total debits"
            icon={TrendingDown}
            tone="neutral"
            value={formatMoney(balanceData?.totalDebits ?? 0, currency)}
            sublabel="Refunds & deductions"
          />
        </div>
      )}

      <Card>
        <CardHeader
          title="Ledger entries"
          description="Immutable double-entry journal records from ClearLedger database."
          action={
            <Button
              variant="ghost"
              size="sm"
              onClick={entriesFetch.refresh}
              loading={entriesFetch.loading}
            >
              <RefreshCw className="h-3.5 w-3.5" /> Refresh entries
            </Button>
          }
        />
        <CardBody className="p-0">
          {entries.length ? (
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-[#232529] bg-[#111215] text-[11px] font-semibold uppercase tracking-wider text-zinc-400">
                    <th className="px-5 py-3.5">Reference</th>
                    <th className="px-5 py-3.5">Type</th>
                    <th className="px-5 py-3.5">Amount</th>
                    <th className="px-5 py-3.5">Recorded At</th>
                    <th className="px-5 py-3.5 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#1E2024]">
                  {entries.map((entry) => {
                    const isCredit = entry.type === "CREDIT";
                    const paymentObj =
                      typeof entry.paymentId === "object" && entry.paymentId !== null
                        ? entry.paymentId
                        : null;
                    const paymentRefId = paymentObj?._id || entry.paymentId;
                    const referenceLabel = shortId(paymentRefId || entry._id);
                    const description =
                      paymentObj?.customerEmail || entry.description || "Settlement";
                    const typeStyle = statusStyle(LEDGER_TYPE_STYLES, entry.type);

                    return (
                      <tr key={entry._id} className="hover:bg-white/[0.02] transition-colors">
                        <td className="px-5 py-3.5">
                          <div className="flex items-center gap-1.5">
                            {paymentRefId ? (
                              <Link
                                to={`/payments/${paymentRefId}`}
                                className="font-mono text-xs font-semibold text-indigo-400 hover:text-indigo-300 hover:underline"
                              >
                                {referenceLabel}
                              </Link>
                            ) : (
                              <span className="font-mono text-xs font-semibold text-zinc-300">
                                {referenceLabel}
                              </span>
                            )}
                            {paymentRefId && (
                              <CopyButton
                                value={String(paymentRefId)}
                                showLabel={false}
                                label="Copy payment ID"
                              />
                            )}
                          </div>
                          <p className="mt-0.5 text-xs text-zinc-400">{description}</p>
                        </td>
                        <td className="px-5 py-3.5">
                          <span className={`chip ${typeStyle.className}`}>
                            {typeStyle.label}
                          </span>
                        </td>
                        <td
                          className={`whitespace-nowrap px-5 py-3.5 text-xs font-bold ${
                            isCredit ? "text-emerald-400" : "text-rose-400"
                          }`}
                        >
                          {isCredit ? "+" : "-"}
                          {formatMoney(entry.amount, entry.currency)}
                        </td>
                        <td className="whitespace-nowrap px-5 py-3.5 text-xs text-zinc-400">
                          {formatDateTime(entry.createdAt)}
                        </td>
                        <td className="px-5 py-3.5 text-right">
                          {paymentRefId ? (
                            <Link
                              to={`/payments/${paymentRefId}`}
                              className="text-xs font-semibold text-indigo-400 hover:text-indigo-300 hover:underline"
                            >
                              Details →
                            </Link>
                          ) : (
                            <span className="text-xs text-zinc-600">—</span>
                          )}
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
                <BookText className="h-5 w-5" />
              </div>
              <h3 className="text-sm font-bold text-[#F4F4F5]">No ledger entries yet</h3>
              <p className="mt-1 text-xs text-zinc-400">
                Successful payments automatically record ledger credit entries.
              </p>
              <Link
                to="/payments"
                className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 px-3.5 py-2 text-xs font-semibold text-white shadow-xs transition-colors"
              >
                Create a payment
              </Link>
            </div>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
