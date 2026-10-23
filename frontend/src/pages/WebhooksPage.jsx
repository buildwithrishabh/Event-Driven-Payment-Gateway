import { ArrowDownToLine, ArrowUpFromLine, Webhook } from "lucide-react";
import { API_BASE_URL } from "../lib/api.js";
import { useAuth } from "../context/AuthContext.jsx";
import PageHeader from "../components/ui/PageHeader.jsx";
import CopyButton from "../components/ui/CopyButton.jsx";
import { Card, CardBody, CardHeader } from "../components/ui/Card.jsx";

const EVENT_SAMPLE = `{
  "event": "payment.succeeded",
  "data": {
    "paymentId": "<PAYMENT_ID>",
    "amount": 0,
    "currency": "INR",
    "status": "SUCCEEDED"
  }
}`;

function Endpoint({ label, value, configured = true }) {
  return (
    <div className="rounded-xl border border-[#232529] bg-[#111215] p-3.5">
      <p className="text-xs font-medium text-zinc-400">{label}</p>
      <div className="mt-1.5 flex items-center justify-between gap-2">
        <code className="min-w-0 break-all font-mono text-sm text-zinc-200">{value}</code>
        {configured && <CopyButton value={value} showLabel={false} label={`Copy ${label.toLowerCase()}`} />}
      </div>
    </div>
  );
}

export default function WebhooksPage() {
  const { merchant } = useAuth();
  const outboundUrl = merchant?.webhookUrl;
  const inboundUrl = `${API_BASE_URL}/v1/webhooks/razorpay`;

  return (
    <div className="animate-fade-in space-y-6">
      <PageHeader
        title="Webhooks"
        description="Monitor automated payment event delivery endpoints and cryptographic signature verification."
      />

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Outbound Merchant Webhook Card */}
        <Card className="flex flex-col">
          <CardHeader
            title="Outbound merchant endpoint"
            description="Where ClearLedger delivers real-time payment notifications."
            icon={ArrowUpFromLine}
            action={
              <span
                className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium border ${
                  outboundUrl
                    ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-400"
                    : "border-[#26282E] bg-[#16171A] text-zinc-400"
                }`}
              >
                <span
                  className={`h-1.5 w-1.5 rounded-full ${
                    outboundUrl ? "bg-emerald-400" : "bg-zinc-500"
                  }`}
                />
                {outboundUrl ? "Configured" : "Not Set"}
              </span>
            }
          />
          <CardBody className="flex-1 space-y-5 p-6">
            <Endpoint
              label="Merchant Destination URL"
              value={outboundUrl || "No webhook URL configured"}
              configured={Boolean(outboundUrl)}
            />

            <div className="rounded-xl border border-[#232529] bg-[#111215] p-4 text-xs text-zinc-400 space-y-2">
              <p className="font-semibold text-zinc-200 flex items-center gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-indigo-400" />
                Delivery Guarantees
              </p>
              <p className="text-zinc-400 leading-relaxed">
                Events dispatched: <code className="font-mono text-indigo-400 font-semibold">payment.succeeded</code> and{" "}
                <code className="font-mono text-indigo-400 font-semibold">payment.failed</code>.
              </p>
            </div>

            <details className="group rounded-xl border border-[#232529] bg-[#111215] p-4 transition-colors">
              <summary className="flex cursor-pointer items-center justify-between text-xs font-semibold text-zinc-300 select-none">
                <span>Webhook signature verification & sample payload</span>
                <span className="text-zinc-500 transition group-open:rotate-180">▾</span>
              </summary>
              <div className="mt-3.5 space-y-3 text-xs text-zinc-400">
                <p className="leading-relaxed">
                  Every dispatch includes an HMAC-SHA256 signature in the{" "}
                  <code className="font-mono rounded border border-[#26282E] bg-[#16171A] px-1.5 py-0.5 text-indigo-400">
                    x-signature
                  </code>{" "}
                  header. Validate it against your merchant secret.
                </p>
                <div className="relative overflow-hidden rounded-xl border border-[#232529] bg-[#0C0D0E] p-4">
                  <div className="absolute right-2.5 top-2.5">
                    <CopyButton
                      value={EVENT_SAMPLE}
                      showLabel={false}
                      label="Copy payload"
                    />
                  </div>
                  <pre className="overflow-x-auto text-[11px] leading-relaxed text-zinc-300 font-mono">
                    <code>{EVENT_SAMPLE}</code>
                  </pre>
                </div>
              </div>
            </details>
          </CardBody>
        </Card>

        {/* Inbound Provider Webhook Card */}
        <Card className="flex flex-col">
          <CardHeader
            title="Inbound gateway listener"
            description="Razorpay sends processor payment events directly to this URL."
            icon={ArrowDownToLine}
            action={
              <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium border border-emerald-500/20 bg-emerald-500/10 text-emerald-400">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                Ready
              </span>
            }
          />
          <CardBody className="flex-1 space-y-5 p-6">
            <Endpoint label="Gateway Inbound Webhook URL" value={inboundUrl} />

            <div className="rounded-xl border border-[#232529] bg-[#111215] p-4 text-xs text-zinc-400 space-y-2">
              <p className="font-semibold text-zinc-200 flex items-center gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                Processor Configuration
              </p>
              <p className="text-zinc-400 leading-relaxed">
                Configure this webhook in your Razorpay Dashboard with events:{" "}
                <code className="font-mono text-zinc-300 font-semibold">payment.captured</code>,{" "}
                <code className="font-mono text-zinc-300 font-semibold">order.paid</code>, and{" "}
                <code className="font-mono text-zinc-300 font-semibold">payment.failed</code>.
              </p>
            </div>

            <details className="group rounded-xl border border-[#232529] bg-[#111215] p-4 transition-colors">
              <summary className="flex cursor-pointer items-center justify-between text-xs font-semibold text-zinc-300 select-none">
                <span>Verification details</span>
                <span className="text-zinc-500 transition group-open:rotate-180">▾</span>
              </summary>
              <div className="mt-3.5 space-y-2 text-xs text-zinc-400 leading-relaxed">
                <p>
                  Inbound requests are verified automatically via the{" "}
                  <code className="font-mono rounded border border-[#26282E] bg-[#16171A] px-1.5 py-0.5 text-indigo-400">
                    x-razorpay-signature
                  </code>{" "}
                  HMAC header before committing double-entry records.
                </p>
              </div>
            </details>
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
