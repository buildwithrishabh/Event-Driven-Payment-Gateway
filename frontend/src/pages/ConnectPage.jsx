import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  ArrowRight,
  CheckCircle2,
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
      className={`grid ${tile} shrink-0 place-items-center bg-brand-600 text-white shadow-glow-sm`}
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
    <div className="relative hidden overflow-hidden bg-ink-950 p-12 text-white lg:flex lg:flex-col lg:justify-between">
      {/* Subtle ambient fintech glow */}
      <div className="pointer-events-none absolute -left-20 -top-20 h-80 w-80 rounded-full bg-brand-600/15 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-24 right-0 h-96 w-96 rounded-full bg-brand-500/10 blur-3xl" />

      {/* Brand Header */}
      <div className="relative z-10 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <BrandMark />
          <span className="text-base font-semibold tracking-tight text-white">ClearLedger</span>
        </div>
        <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-xs font-medium text-slate-300">
          Console
        </span>
      </div>

      {/* Hero & Fintech Visual */}
      <div className="relative z-10 my-auto max-w-lg space-y-8 py-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-white xl:text-4xl">
            Payments and ledger balances, unified.
          </h1>
          <p className="mt-3 text-sm leading-relaxed text-slate-300">
            Process payments with idempotent safety, maintain double-entry accuracy, and monitor live ledger events.
          </p>
        </div>

        {/* Subtle Fintech-inspired Ledger Preview Card */}
        <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5 shadow-2xl backdrop-blur-sm">
          <div className="flex items-center justify-between border-b border-white/10 pb-3">
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-emerald-400" />
              <span className="text-xs font-semibold text-slate-200">Double-Entry Engine</span>
            </div>
            <span className="font-mono text-[11px] text-slate-400">Real-time</span>
          </div>

          <div className="mt-4 space-y-3">
            <div className="flex items-center justify-between rounded-lg bg-white/[0.03] px-3.5 py-2.5">
              <div className="flex items-center gap-2.5">
                <div className="grid h-7 w-7 place-items-center rounded-md bg-emerald-500/15 text-emerald-400">
                  <CheckCircle2 className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-xs font-medium text-slate-200">Idempotent Settlement</p>
                  <p className="text-[11px] text-slate-400">Protected duplicate checks</p>
                </div>
              </div>
              <span className="font-mono text-xs font-semibold text-emerald-400">Active</span>
            </div>

            <div className="flex items-center justify-between rounded-lg bg-white/[0.03] px-3.5 py-2.5">
              <div className="flex items-center gap-2.5">
                <div className="grid h-7 w-7 place-items-center rounded-md bg-brand-500/15 text-brand-300">
                  <KeyRound className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-xs font-medium text-slate-200">Cryptographic Webhooks</p>
                  <p className="text-[11px] text-slate-400">HMAC-SHA256 verified</p>
                </div>
              </div>
              <span className="font-mono text-xs font-semibold text-brand-300">Signed</span>
            </div>
          </div>
        </div>
      </div>

      {/* Security Footer */}
      <div className="relative z-10 flex items-center gap-2 text-xs text-slate-400">
        <Lock className="h-3.5 w-3.5 text-slate-400" />
        <span>End-to-end encrypted · Direct merchant key auth</span>
      </div>
    </div>
  );
}

function ConnectWithKeyForm({ onSuccess }) {
  const { connect } = useAuth();
  const toast = useToast();
  const [apiKey, setApiKey] = useState("");
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
        type="password"
        autoComplete="off"
        spellCheck={false}
        placeholder="key_••••••••••••••••••••••••"
        value={apiKey}
        onChange={(e) => setApiKey(e.target.value)}
        hint="Paste your merchant secret key to sign in. Stored securely in your browser."
        error={error}
        required
        autoFocus
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
        <div className="flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4">
          <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" />
          <div>
            <p className="text-sm font-semibold text-emerald-900">🎉 Store Created Successfully!</p>
            <p className="mt-0.5 text-xs text-emerald-800">
              Save your keys below. The API key is shown only once and cannot be recovered later.
            </p>
          </div>
        </div>

        <div className="space-y-3">
          <div className="rounded-xl border border-ink-200 bg-ink-50/70 p-3">
            <div className="mb-1.5 flex items-center justify-between gap-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-ink-500">
                Your Secret API Key
              </p>
              <CopyButton value={created.apiKey} label="Copy key" showLabel />
            </div>
            <code className="block break-all font-mono text-xs text-ink-800">
              {created.apiKey}
            </code>
          </div>

          <div className="rounded-xl border border-ink-200 bg-ink-50/70 p-3">
            <div className="mb-1.5 flex items-center justify-between gap-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-ink-500">
                Webhook Secret (For signature verification)
              </p>
              <CopyButton value={created.webhookSecret} label="Copy secret" showLabel />
            </div>
            <code className="block break-all font-mono text-xs text-ink-800">
              {created.webhookSecret}
            </code>
          </div>
        </div>

        <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs leading-relaxed text-amber-900">
          <strong>Important:</strong> Keep your API key safe. Our server only stores a secure one-way hash of it.
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

      <div className="relative flex items-center justify-center bg-[#f8fafc] p-6 sm:p-10">
        <div className="relative w-full max-w-md animate-fade-up">
          <div className="mb-6 flex items-center gap-3 lg:hidden">
            <BrandMark size="lg" />
            <div>
              <p className="text-base font-bold text-ink-900">ClearLedger</p>
              <p className="text-xs text-ink-500">Merchant Console</p>
            </div>
          </div>

          <Card className="overflow-hidden rounded-2xl border-ink-200/90 shadow-soft">
            <div className="border-b border-ink-100 bg-ink-50/70 p-1.5">
              <div className="grid grid-cols-2 gap-1 rounded-xl bg-ink-100/60 p-0.5">
                <button
                  type="button"
                  onClick={() => setTab("key")}
                  className={`flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold transition ${
                    tab === "key"
                      ? "bg-white text-ink-900 shadow-2xs"
                      : "text-ink-500 hover:text-ink-800"
                  }`}
                >
                  <KeyRound className="h-3.5 w-3.5 text-brand-600" />
                  Sign in
                </button>
                <button
                  type="button"
                  onClick={() => setTab("register")}
                  className={`flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold transition ${
                    tab === "register"
                      ? "bg-white text-ink-900 shadow-2xs"
                      : "text-ink-500 hover:text-ink-800"
                  }`}
                >
                  <UserPlus className="h-3.5 w-3.5 text-brand-600" />
                  Create account
                </button>
              </div>
            </div>

            <div className="p-6">
              <h2 className="text-lg font-bold text-ink-900">
                {tab === "key" ? "Sign in to console" : "Create merchant account"}
              </h2>
              <p className="mt-1 text-sm text-ink-500">
                {tab === "key"
                  ? "Enter your merchant secret key to access your dashboard."
                  : "Generate your API key and set up your ledger."}
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

          <p className="mt-5 text-center text-xs text-ink-400">
            Secure, key-authenticated console · Isolated local session
          </p>
        </div>
      </div>
    </div>
  );
}
