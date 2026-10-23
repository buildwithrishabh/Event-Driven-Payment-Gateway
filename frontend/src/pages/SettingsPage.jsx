import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Building2, Eye, EyeOff, KeyRound, LogOut } from "lucide-react";
import { maskSecret } from "../lib/format.js";
import { MERCHANT_STATUS_STYLES, statusStyle } from "../lib/constants.js";
import { useAuth } from "../context/AuthContext.jsx";
import PageHeader from "../components/ui/PageHeader.jsx";
import Button from "../components/ui/Button.jsx";
import CopyButton from "../components/ui/CopyButton.jsx";
import { Card, CardBody, CardHeader } from "../components/ui/Card.jsx";
import { InfoRow } from "../components/ui/InfoRow.jsx";

export default function SettingsPage() {
  const { merchant, apiKey, disconnect } = useAuth();
  const navigate = useNavigate();
  const [revealKey, setRevealKey] = useState(false);
  const [confirmSignOut, setConfirmSignOut] = useState(false);
  const merchantStyle = statusStyle(MERCHANT_STATUS_STYLES, merchant?.status);

  function handleDisconnect() {
    disconnect();
    navigate("/connect", { replace: true });
  }

  return (
    <div className="animate-fade-in space-y-6">
      <PageHeader
        title="Settings"
        description="Manage your merchant credentials, account configuration, and console access."
      />

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Merchant Profile Card */}
        <Card>
          <CardHeader
            title="Merchant profile"
            description="Registered merchant identity in ClearLedger."
            icon={Building2}
          />
          <CardBody className="p-6">
            <dl className="divide-y divide-[#1E2024]">
              <InfoRow label="Business Name" value={merchant?.name || "—"} />
              <InfoRow label="Contact Email" value={merchant?.email || "—"} />
              <InfoRow
                label="Webhook Destination"
                value={merchant?.webhookUrl || "Not configured"}
                mono={Boolean(merchant?.webhookUrl)}
              />
              <InfoRow label="Account Status">
                <span className={`chip ${merchantStyle.className}`}>{merchantStyle.label}</span>
              </InfoRow>
            </dl>
          </CardBody>
        </Card>

        {/* API Key Access Card */}
        <Card>
          <CardHeader
            title="Merchant API key"
            description="Secret credential for authorizing payments and querying the ledger."
            icon={KeyRound}
          />
          <CardBody className="space-y-4 p-6">
            <div className="flex items-center gap-2 rounded-xl border border-[#232529] bg-[#111215] p-3.5">
              <code className="min-w-0 flex-1 break-all font-mono text-xs font-medium text-zinc-200">
                {revealKey ? apiKey : maskSecret(apiKey)}
              </code>
              <CopyButton value={apiKey} showLabel={false} label="Copy API key" />
            </div>

            <div className="flex items-center justify-between">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setRevealKey((value) => !value)}
              >
                {revealKey ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                {revealKey ? "Hide secret key" : "Reveal secret key"}
              </Button>
              <span className="text-[11px] text-zinc-500">Stored in browser local session</span>
            </div>
          </CardBody>
        </Card>
      </div>

      {/* Sign Out Card */}
      <Card className="border-rose-500/20 bg-rose-500/5">
        <CardBody className="flex flex-wrap items-center justify-between gap-4 p-5">
          <div>
            <p className="text-sm font-semibold text-[#F4F4F5]">Sign out of Console</p>
            <p className="mt-0.5 text-xs text-zinc-400">
              Clears your stored API key and session data from this browser.
            </p>
          </div>
          {confirmSignOut ? (
            <div className="flex items-center gap-2">
              <span className="text-xs text-rose-400 font-medium">Are you sure?</span>
              <Button variant="danger" size="sm" onClick={handleDisconnect}>
                <LogOut className="h-3.5 w-3.5" /> Yes, sign out
              </Button>
              <Button variant="secondary" size="sm" onClick={() => setConfirmSignOut(false)}>
                Cancel
              </Button>
            </div>
          ) : (
            <Button variant="secondary" size="sm" onClick={() => setConfirmSignOut(true)}>
              <LogOut className="h-3.5 w-3.5" /> Sign out
            </Button>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
