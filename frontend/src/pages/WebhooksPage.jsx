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
  return <div className="rounded-lg border border-ink-200 bg-ink-50/60 p-3">
    <p className="text-xs font-medium text-ink-500">{label}</p>
    <div className="mt-1.5 flex items-center justify-between gap-2">
      <code className="min-w-0 break-all font-mono text-sm text-ink-800">{value}</code>
      {configured && <CopyButton value={value} showLabel={false} label={`Copy ${label.toLowerCase()}`} />}
    </div>
  </div>;
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
                className={`chip text-xs ${
                  outboundUrl
                    ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                    : "border-ink-200 bg-ink-50 text-ink-500"
                }`}
              >
                <span
                  className={`h-1.5 w-1.5 rounded-full ${
                    outboundUrl ? "bg-emerald-500" : "bg-ink-400"
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

            <div className="rounded-xl border border-ink-100 bg-ink-50/60 p-3.5 text-xs text-ink-600 space-y-1.5">
              <p className="font-medium text-ink-900">Delivery Guarantees</p>
              <p className="text-ink-500">
                Events dispatched: <code className="font-mono text-brand-700">payment.succeeded</code> and{" "}
                <code className="font-mono text-brand-700">payment.failed</code>.
              </p>
            </div>

            <details className="group rounded-xl border border-ink-200/80 bg-ink-50/40 p-4 transition-colors">
              <summary className="flex cursor-pointer items-center justify-between text-xs font-semibold text-ink-700 select-none">
                <span>Webhook signature verification & sample payload</span>
                <span className="text-ink-400 transition group-open:rotate-180">▾</span>
              </summary>
              <div className="mt-3.5 space-y-3 text-xs text-ink-600">
                <p>
                  Every dispatch includes an HMAC-SHA256 signature in the{" "}
                  <code className="font-mono rounded bg-ink-100 px-1 py-0.5 text-ink-800">
                    x-signature
                  </code>{" "}
                  header. Validate it against your secret.
                </p>
                <div className="relative overflow-hidden rounded-xl bg-ink-950 p-3.5">
                  <div className="absolute right-2.5 top-2.5">
                    <CopyButton
                      value={EVENT_SAMPLE}
                      showLabel={false}
                      label="Copy payload"
                      className="border-white/10 bg-white/5 text-white hover:bg-white/15"
                    />
                  </div>
                  <pre className="overflow-x-auto text-[11px] leading-relaxed text-slate-200">
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
              <span className="chip border-emerald-200 bg-emerald-50 text-emerald-700 text-xs">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                Ready
              </span>
            }
          />
          <CardBody className="flex-1 space-y-5 p-6">
            <Endpoint label="Gateway Inbound Webhook URL" value={inboundUrl} />

            <div className="rounded-xl border border-ink-100 bg-ink-50/60 p-3.5 text-xs text-ink-600 space-y-1.5">
              <p className="font-medium text-ink-900">Processor Configuration</p>
              <p className="text-ink-500">
                Configure this webhook in your Razorpay Dashboard with events:{" "}
                <code className="font-mono text-ink-800">payment.captured</code>,{" "}
                <code className="font-mono text-ink-800">order.paid</code>, and{" "}
                <code className="font-mono text-ink-800">payment.failed</code>.
              </p>
            </div>

            <details className="group rounded-xl border border-ink-200/80 bg-ink-50/40 p-4 transition-colors">
              <summary className="flex cursor-pointer items-center justify-between text-xs font-semibold text-ink-700 select-none">
                <span>Verification details</span>
                <span className="text-ink-400 transition group-open:rotate-180">▾</span>
              </summary>
              <div className="mt-3.5 space-y-2 text-xs text-ink-600">
                <p>
                  Inbound requests are verified automatically via the{" "}
                  <code className="font-mono rounded bg-ink-100 px-1 py-0.5 text-ink-800">
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
