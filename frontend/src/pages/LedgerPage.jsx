import { Link } from "react-router-dom";
import { BookText, RefreshCw, TrendingDown, TrendingUp, Wallet } from "lucide-react";
import { getBalance } from "../lib/api.js";
import { formatDateTime, formatMoney, shortId } from "../lib/format.js";
import { useAuth } from "../context/AuthContext.jsx";
import { useFetch } from "../hooks/useFetch.js";
import { useSessionPayments } from "../lib/paymentStore.js";
import PageHeader from "../components/ui/PageHeader.jsx";
import StatCard from "../components/ui/StatCard.jsx";
import Button from "../components/ui/Button.jsx";
import CopyButton from "../components/ui/CopyButton.jsx";
import { Card, CardBody, CardHeader } from "../components/ui/Card.jsx";
import { SkeletonCard } from "../components/ui/Skeleton.jsx";

export default function LedgerPage() {
  const { apiKey, isConnected } = useAuth();
  const payments = useSessionPayments();
  const entries = payments.filter((payment) => payment.status === "SUCCEEDED");
  const balance = useFetch(() => getBalance(apiKey), [apiKey], { enabled: isConnected });
  const balanceData = balance.data?.balance || balance.data;
  const currency = balanceData?.currency || "INR";

  return (
    <div className="animate-fade-in space-y-6">
      <PageHeader
        title="Ledger"
        description="Immutable double-entry balance accounting and ledger transactions."
        actions={
          <Button
            variant="secondary"
            size="sm"
            onClick={balance.refresh}
            loading={balance.loading}
          >
            <RefreshCw className="h-3.5 w-3.5" /> Refresh balance
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
              <p className="text-sm font-semibold text-ink-900">Ledger balance unavailable</p>
              <p className="mt-1 text-sm text-ink-500">{balance.error.message}</p>
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
          description="Double-entry journal records from captured payments in this session."
        />
        <CardBody className="p-0">
          {entries.length ? (
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr>
                    <th className="px-5 py-3">Reference</th>
                    <th className="px-5 py-3">Type</th>
                    <th className="px-5 py-3">Amount</th>
                    <th className="px-5 py-3">Recorded At</th>
                    <th className="px-5 py-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-ink-100">
                  {[...entries]
                    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
                    .map((payment) => (
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
                          <p className="mt-0.5 text-xs text-ink-500">
                            {payment.customerEmail || "Settlement"}
                          </p>
                        </td>
                        <td className="px-5 py-3.5">
                          <span className="chip border-emerald-200 bg-emerald-50 text-emerald-700">
                            Credit
                          </span>
                        </td>
                        <td className="whitespace-nowrap px-5 py-3.5 text-xs font-semibold text-emerald-700">
                          +{formatMoney(payment.amount, payment.currency)}
                        </td>
                        <td className="whitespace-nowrap px-5 py-3.5 text-xs text-ink-500">
                          {formatDateTime(payment.createdAt)}
                        </td>
                        <td className="px-5 py-3.5 text-right">
                          <Link
                            to={`/payments/${payment.paymentId}`}
                            className="text-xs font-semibold text-brand-600 hover:underline"
                          >
                            Details →
                          </Link>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="py-14 text-center">
              <div className="mx-auto mb-3 grid h-10 w-10 place-items-center rounded-xl bg-ink-100 text-ink-500">
                <BookText className="h-5 w-5" />
              </div>
              <h3 className="text-sm font-semibold text-ink-900">No ledger entries yet</h3>
              <p className="mt-1 text-xs text-ink-500">
                Successful payments automatically record ledger credit entries.
              </p>
              <Link
                to="/payments"
                className="mt-4 inline-flex items-center gap-1.5 rounded-xl bg-brand-50 px-3.5 py-2 text-xs font-semibold text-brand-700 hover:bg-brand-100"
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
