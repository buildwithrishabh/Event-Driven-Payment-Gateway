import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  ArrowRight,
  CheckCircle2,
  Eye,
  EyeOff,
  KeyRound,
  Lock,
  UserPlus,
} from "lucide-react";
import { registerMerchant } from "../lib/api.js";
import { useAuth } from "../context/AuthContext.jsx";
import { useToast } from "../context/ToastContext.jsx";
import Button from "../components/ui/Button.jsx";
import Input from "../components/ui/Input.jsx";
import CopyButton from "../components/ui/CopyButton.jsx";
import { Card } from "../components/ui/Card.jsx";

function BrandMark({ light = false, size = "md" }) {
  const tile = size === "lg" ? "h-10 w-10 rounded-xl" : "h-9 w-9 rounded-lg";
  return (
    <span
      className={`grid ${tile} shrink-0 place-items-center bg-gradient-to-br from-indigo-500 to-indigo-700 text-white shadow-[0_2px_8px_rgba(79,70,229,0.35),inset_0_1px_0_rgba(255,255,255,0.25)] border border-indigo-400/30`}
    >
      <svg
        viewBox="0 0 24 24"
        fill="none"
        width="18"
        height="18"
        stroke="currentColor"
        strokeWidth="2.5"
        className={light ? "text-white" : ""}
      >
        <polygon points="12 2 2 7 12 12 22 7 12 2" />
        <polyline points="2 17 12 22 22 17" />
        <polyline points="2 12 12 17 22 12" />
      </svg>
    </span>
  );
}

function BrandPanel() {
  return (
    <div className="relative hidden overflow-hidden bg-[#0C0D0E] p-10 lg:p-14 text-white lg:flex lg:flex-col lg:justify-between border-r border-[#232529]">
      {/* Background Architectural Grid Pattern */}
      <div
        className="pointer-events-none absolute inset-0 opacity-40"
        style={{
          backgroundImage: "radial-gradient(rgba(255, 255, 255, 0.08) 1px, transparent 1px)",
          backgroundSize: "24px 24px",
        }}
      />
      {/* Ambient Top Glow */}
      <div className="pointer-events-none absolute -top-32 left-1/4 h-96 w-96 rounded-full bg-indigo-500/10 blur-3xl" />

      {/* Brand Header */}
      <div className="relative z-10 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <BrandMark />
          <div>
            <span className="text-base font-bold tracking-tight text-[#F4F4F5]">ClearLedger</span>
            <span className="ml-2 text-[11px] font-mono font-medium text-zinc-500">ENGINE</span>
          </div>
        </div>
        <div className="flex items-center gap-2 rounded-full border border-[#232529] bg-[#16171A] px-3 py-1 shadow-xs">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
          <span className="text-[11px] font-medium text-zinc-300">v1.2 • Engine Live</span>
        </div>
      </div>

      {/* Hero & Fintech Visual */}
      <div className="relative z-10 my-auto max-w-lg space-y-7 py-6">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-white xl:text-4xl leading-tight">
            Payments and ledger balances, <span className="text-indigo-400">unified.</span>
          </h1>
          <p className="mt-3 text-sm leading-relaxed text-zinc-400">
            Process payments with idempotent safety, guarantee double-entry balance consistency, and dispatch cryptographic webhooks in real time.
          </p>
        </div>

        {/* Live Ledger Terminal Showcase Card */}
        <div className="rounded-2xl border border-[#232529] bg-[#141518]/90 p-5 shadow-[0_12px_36px_rgba(0,0,0,0.6),inset_0_1px_0_0_rgba(255,255,255,0.06)] backdrop-blur-md">
          {/* Terminal Window Header */}
          <div className="flex items-center justify-between border-b border-[#232529] pb-3 text-xs">
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full bg-zinc-700/80" />
                <span className="h-2.5 w-2.5 rounded-full bg-zinc-700/80" />
                <span className="h-2.5 w-2.5 rounded-full bg-zinc-700/80" />
              </div>
              <span className="ml-1 font-mono text-[11px] text-zinc-400">ledger.stream // node-01</span>
            </div>
            <span className="inline-flex items-center gap-1 font-mono text-[10px] text-emerald-400 font-semibold bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
              LIVE FEED
            </span>
          </div>

          {/* Account Balance Widget */}
          <div className="mt-3.5 mb-3 flex items-center justify-between rounded-xl bg-[#0C0D0E] border border-[#232529] px-4 py-2.5">
            <div>
              <p className="text-[10px] uppercase font-mono tracking-wider text-zinc-500">Settled Ledger Balance</p>
              <p className="font-mono text-base font-bold text-[#F4F4F5]">₹ 2,45,800.00</p>
            </div>
            <span className="text-[11px] font-mono font-medium text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-md">
              +14.2% Today
            </span>
          </div>

          {/* Simulated Real-Time Transactions Feed */}
          <div className="space-y-2">
            <div className="flex items-center justify-between rounded-lg bg-[#0C0D0E]/80 border border-[#1E2024] px-3.5 py-2 text-xs">
              <div className="flex items-center gap-2.5">
                <div className="grid h-6 w-6 place-items-center rounded-md bg-emerald-500/10 text-emerald-400">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-[11px] font-semibold text-zinc-200">PAY_8f921</span>
                    <span className="text-[11px] text-zinc-500">• Captured via UPI</span>
                  </div>
                  <p className="text-[10px] text-zinc-500">Idempotency-Key validated (0 dups)</p>
                </div>
              </div>
              <div className="text-right">
                <span className="font-mono text-xs font-bold text-emerald-400">+₹4,500.00</span>
                <span className="block text-[10px] text-zinc-500 font-mono">0.12s ago</span>
              </div>
            </div>

            <div className="flex items-center justify-between rounded-lg bg-[#0C0D0E]/80 border border-[#1E2024] px-3.5 py-2 text-xs">
              <div className="flex items-center gap-2.5">
                <div className="grid h-6 w-6 place-items-center rounded-md bg-indigo-500/10 text-indigo-400">
                  <KeyRound className="h-3.5 w-3.5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-[11px] font-semibold text-zinc-200">WHK_DISPATCH</span>
                    <span className="text-[11px] text-zinc-500">• payment.succeeded</span>
                  </div>
                  <p className="text-[10px] text-zinc-500">HMAC-SHA256 signature verified</p>
                </div>
              </div>
              <div className="text-right">
                <span className="font-mono text-[11px] font-semibold text-indigo-400">200 OK</span>
                <span className="block text-[10px] text-zinc-500 font-mono">0.08s ago</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Security Footer */}
      <div className="relative z-10 flex items-center justify-between border-t border-[#1E2024] pt-4 text-xs text-zinc-500">
        <div className="flex items-center gap-2">
          <Lock className="h-3.5 w-3.5 text-zinc-400" />
          <span>TLS 1.3 · Isolated Browser Session</span>
        </div>
        <span className="font-mono text-[11px] text-zinc-600">ClearLedger v1.0</span>
      </div>
    </div>
  );
}

function ConnectWithKeyForm({ onSuccess }) {
  const { connect } = useAuth();
  const toast = useToast();
  const [apiKey, setApiKey] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(event) {
    event.preventDefault();
    setLoading(true);
    setError("");
    try {
      const profile = await connect(apiKey);
      toast.success("Welcome back!", `Signed in to ${profile.name}`);
      onSuccess?.();
    } catch (err) {
      setError(err.message);
      toast.error("Could not sign in", err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <Input
        label="Merchant API key"
        type={showKey ? "text" : "password"}
        autoComplete="off"
        spellCheck={false}
        placeholder="key_••••••••••••••••••••••••"
        value={apiKey}
        onChange={(e) => setApiKey(e.target.value)}
        hint="Paste your merchant secret key to sign in. Stored securely in your browser."
        error={error}
        required
        suffix={
          <button
            type="button"
            onClick={() => setShowKey(!showKey)}
            className="text-zinc-500 hover:text-zinc-300 transition-colors p-1"
            title={showKey ? "Hide API key" : "Show API key"}
            tabIndex={-1}
          >
            {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        }
      />
      <Button type="submit" loading={loading} className="w-full" size="lg">
        <Lock className="h-4 w-4" />
        Sign in to Console
      </Button>
    </form>
  );
}

function RegisterForm() {
  const toast = useToast();
  const { connect } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: "", email: "", webhookUrl: "" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [created, setCreated] = useState(null);

  function update(field) {
    return (event) => setForm((prev) => ({ ...prev, [field]: event.target.value }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setLoading(true);
    setError("");
    try {
      const { data } = await registerMerchant({
        name: form.name.trim(),
        email: form.email.trim(),
        webhookUrl: form.webhookUrl.trim() || undefined,
      });
      setCreated(data);
      toast.success("Store created!", "Copy your secret API key below.");
    } catch (err) {
      setError(err.message);
      toast.error("Registration failed", err.message);
    } finally {
      setLoading(false);
    }
  }

  async function useNewKey() {
    try {
      await connect(created.apiKey);
      toast.success("Welcome!", "You are signed in with your new store key.");
      navigate("/", { replace: true });
    } catch (err) {
      toast.error("Could not sign in", err.message);
    }
  }

  if (created) {
    return (
      <div className="space-y-5">
        <div className="flex items-start gap-3 rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-4">
          <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-400" />
          <div>
            <p className="text-sm font-semibold text-emerald-400">Store Created Successfully!</p>
            <p className="mt-0.5 text-xs text-emerald-400/90">
              Save your keys below. The API key is shown only once and cannot be recovered later.
            </p>
          </div>
        </div>

        <div className="space-y-3">
          <div className="rounded-xl border border-[#232529] bg-[#111215] p-3.5">
            <div className="mb-1.5 flex items-center justify-between gap-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-zinc-400">
                Your Secret API Key
              </p>
              <CopyButton value={created.apiKey} label="Copy key" showLabel />
            </div>
            <code className="block break-all font-mono text-xs text-indigo-400">
              {created.apiKey}
            </code>
          </div>

          <div className="rounded-xl border border-[#232529] bg-[#111215] p-3.5">
            <div className="mb-1.5 flex items-center justify-between gap-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-zinc-400">
                Webhook Secret (For signature verification)
              </p>
              <CopyButton value={created.webhookSecret} label="Copy secret" showLabel />
            </div>
            <code className="block break-all font-mono text-xs text-indigo-400">
              {created.webhookSecret}
            </code>
          </div>
        </div>

        <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-3.5 text-xs leading-relaxed text-amber-300/90">
          <strong className="text-amber-200">Important:</strong> Keep your API key safe. Our server only stores a secure one-way hash of it.
        </div>

        <div className="flex flex-col gap-2 sm:flex-row">
          <Button onClick={useNewKey} className="w-full sm:flex-1" size="lg">
            <ArrowRight className="h-4 w-4" />
            Sign in with this key now
          </Button>
          <Button
            variant="secondary"
            size="lg"
            className="w-full sm:w-auto"
            onClick={() => setCreated(null)}
          >
            Create another
          </Button>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <Input
        label="Store or business name"
        placeholder="e.g. Acme Coffee Roasters"
        value={form.name}
        onChange={update("name")}
        required
        autoFocus
      />
      <Input
        label="Contact email"
        type="email"
        placeholder="e.g. owner@acmecoffee.com"
        value={form.email}
        onChange={update("email")}
        required
      />
      <Input
        label="Webhook alert URL (Optional)"
        type="url"
        placeholder="https://your-domain.com/webhooks"
        value={form.webhookUrl}
        onChange={update("webhookUrl")}
        hint="Optional. Where payment alerts will be sent automatically."
        error={error}
      />
      <Button type="submit" loading={loading} className="w-full" size="lg">
        <UserPlus className="h-4 w-4" />
        Create account
      </Button>
    </form>
  );
}

export default function ConnectPage() {
  const [tab, setTab] = useState("key");
  const navigate = useNavigate();
  const location = useLocation();
  const redirectTo = location.state?.from || "/";

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <BrandPanel />

      <div className="relative flex items-center justify-center bg-[#0C0D0E] p-6 sm:p-10 border-l border-[#232529]">
        {/* Subtle dot matrix texture on right panel */}
        <div
          className="pointer-events-none absolute inset-0 opacity-25"
          style={{
            backgroundImage: "radial-gradient(rgba(255, 255, 255, 0.08) 1px, transparent 1px)",
            backgroundSize: "24px 24px",
          }}
        />

        <div className="relative w-full max-w-md animate-fade-up">
          <div className="mb-6 flex items-center gap-3 lg:hidden">
            <BrandMark size="lg" />
            <div>
              <p className="text-base font-bold text-[#F4F4F5]">ClearLedger</p>
              <p className="text-xs text-zinc-400">Merchant Console</p>
            </div>
          </div>

          <Card className="overflow-hidden rounded-2xl border border-[#26282E] bg-[#151619] shadow-[0_20px_50px_rgba(0,0,0,0.7),inset_0_1px_0_0_rgba(255,255,255,0.08)]">
            <div className="border-b border-[#232529] bg-[#111215] p-2">
              <div className="grid grid-cols-2 gap-1 rounded-xl bg-[#0C0D0E] p-1 border border-[#232529]">
                <button
                  type="button"
                  onClick={() => setTab("key")}
                  className={`flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold transition-all ${
                    tab === "key"
                      ? "bg-[#1E2024] text-white border border-[#2D3039] shadow-xs"
                      : "text-zinc-400 hover:text-zinc-200"
                  }`}
                >
                  <KeyRound className="h-3.5 w-3.5 text-indigo-400" />
                  Sign in
                </button>
                <button
                  type="button"
                  onClick={() => setTab("register")}
                  className={`flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold transition-all ${
                    tab === "register"
                      ? "bg-[#1E2024] text-white border border-[#2D3039] shadow-xs"
                      : "text-zinc-400 hover:text-zinc-200"
                  }`}
                >
                  <UserPlus className="h-3.5 w-3.5 text-indigo-400" />
                  Create account
                </button>
              </div>
            </div>

            <div className="p-6 sm:p-7">
              <h2 className="text-xl font-bold tracking-tight text-[#F4F4F5]">
                {tab === "key" ? "Sign in to console" : "Create merchant account"}
              </h2>
              <p className="mt-1 text-xs text-zinc-400 leading-relaxed">
                {tab === "key"
                  ? "Enter your merchant secret key to access your live dashboard and ledger."
                  : "Generate your API key and initialize your double-entry ledger."}
              </p>

              <div className="mt-5">
                {tab === "key" ? (
                  <ConnectWithKeyForm onSuccess={() => navigate(redirectTo, { replace: true })} />
                ) : (
                  <RegisterForm />
                )}
              </div>
            </div>
          </Card>

          <p className="mt-5 text-center text-[11px] text-zinc-500 flex items-center justify-center gap-2">
            <Lock className="h-3 w-3 text-zinc-500" />
            <span>Secure key auth · Zero plain-text persistence · TLS 1.3</span>
          </p>
        </div>
      </div>
    </div>
  );
}
