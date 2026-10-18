import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import {
  Search,
  CreditCard,
  RotateCcw,
  BookText,
  Webhook,
  Code2,
  Settings,
  LayoutDashboard,
  ArrowRight,
  X,
} from "lucide-react";
import { getSessionPayments } from "../../lib/paymentStore.js";
import { formatMoney, shortId, timeAgo } from "../../lib/format.js";
import { useAuth } from "../../context/AuthContext.jsx";

const QUICK_PAGES = [
  { title: "Overview", path: "/", icon: LayoutDashboard },
  { title: "Payments", path: "/payments", icon: CreditCard },
  { title: "Refunds", path: "/refunds", icon: RotateCcw },
  { title: "Ledger", path: "/ledger", icon: BookText },
  { title: "Webhooks", path: "/webhooks", icon: Webhook },
  { title: "API reference", path: "/api", icon: Code2 },
  { title: "Settings", path: "/settings", icon: Settings },
];

export default function SearchModal({ isOpen, onClose }) {
  const { merchant } = useAuth();
  const [query, setQuery] = useState("");
  const inputRef = useRef(null);
  const navigate = useNavigate();
  const sessionPayments = getSessionPayments(merchant?._id);

  useEffect(() => {
    if (isOpen) {
      setQuery("");
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  useEffect(() => {
    function handleKeyDown(e) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        if (isOpen) onClose();
        else window.dispatchEvent(new CustomEvent("gateway:open-search"));
      }
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const q = query.trim().toLowerCase();
  const looksLikePaymentId = /^[a-f0-9]{24}$/i.test(q);

  // Filter navigation links
  const matchedPages = QUICK_PAGES.filter(
    (page) => !q || page.title.toLowerCase().includes(q) || page.path.includes(q),
  );

  // Filter session payments
  const matchedPayments = sessionPayments.filter(
    (p) =>
      !q ||
      p.paymentId?.toLowerCase().includes(q) ||
      p.customerEmail?.toLowerCase().includes(q) ||
      String(p.amount).includes(q),
  );

  function handleSelectPage(path) {
    navigate(path);
    onClose();
  }

  function handleSelectPayment(id) {
    navigate(`/payments/${id}`);
    onClose();
  }

  function handleDirectLookup(e) {
    e.preventDefault();
    if (!looksLikePaymentId) return;
    navigate(`/payments/${q}`);
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-16 sm:pt-24 px-4 bg-ink-950/50 backdrop-blur-sm animate-fade-in" onClick={onClose} role="presentation">
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Search console"
        className="w-full max-w-xl overflow-hidden rounded-2xl border border-ink-200/80 bg-white shadow-2xl transition-all"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search header */}
        <div className="relative flex items-center border-b border-ink-100 px-4 py-3">
          <Search className="h-5 w-5 text-ink-400 mr-3 shrink-0" />
          <form onSubmit={handleDirectLookup} className="flex-1">
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search pages, recent payments, or paste a payment ID..."
              className="w-full bg-transparent text-sm text-ink-900 placeholder:text-ink-400 focus:outline-none"
            />
          </form>
          {query && (
            <button
              type="button"
              onClick={() => setQuery("")}
              className="rounded-lg p-1 text-ink-400 hover:bg-ink-100"
              aria-label="Clear search"
            >
              <X className="h-4 w-4" />
            </button>
          )}
          <kbd className="hidden sm:inline-block ml-2 rounded-md border border-ink-200 bg-ink-50 px-1.5 py-0.5 text-[10px] font-semibold text-ink-500">
            ESC
          </kbd>
        </div>

        {/* Content list */}
        <div className="max-h-[60vh] overflow-y-auto p-2 space-y-3">
          {/* Direct ID quick action if query looks like an ID */}
          {looksLikePaymentId && (
            <button
              type="button"
              onClick={handleDirectLookup}
              className="flex w-full items-center justify-between rounded-xl p-3 text-left bg-brand-50/70 border border-brand-200 text-brand-900 hover:bg-brand-100/70 transition"
            >
              <div className="flex items-center gap-2.5">
                <Search className="h-4 w-4 text-brand-600 shrink-0" />
                <span className="text-xs font-medium">
                  Look up payment ID: <strong className="font-mono">{q}</strong>
                </span>
              </div>
              <ArrowRight className="h-4 w-4 text-brand-600" />
            </button>
          )}

          {/* Pages */}
          <div>
            <p className="px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider text-ink-400">
              Quick Navigation
            </p>
            <div className="space-y-0.5">
              {matchedPages.map((page) => {
                const Icon = page.icon;
                return (
                  <button
                    key={page.path}
                    type="button"
                    onClick={() => handleSelectPage(page.path)}
                    className="flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-xs font-medium text-ink-700 hover:bg-ink-50 hover:text-ink-900 transition"
                  >
                    <div className="flex items-center gap-2.5">
                      <Icon className="h-4 w-4 text-ink-400" />
                      <span>{page.title}</span>
                    </div>
                    <span className="text-[10px] font-mono text-ink-400">{page.path}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Recent Payments in this session */}
          {matchedPayments.length > 0 && (
            <div>
              <p className="px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider text-ink-400">
              Recent payments ({matchedPayments.length})
              </p>
              <div className="space-y-1">
                {matchedPayments.slice(0, 5).map((payment) => (
                  <button
                    key={payment.paymentId}
                    type="button"
                    onClick={() => handleSelectPayment(payment.paymentId)}
                    className="flex w-full items-center justify-between rounded-xl p-2.5 text-left border border-ink-100 hover:border-brand-200 hover:bg-brand-50/30 transition group"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-semibold text-ink-900 group-hover:text-brand-700">
                          {shortId(payment.paymentId)}
                        </span>
                        <span className="rounded bg-emerald-50 border border-emerald-200 px-1.5 py-0.2 text-[10px] font-medium text-emerald-700">
                          {payment.status || "CREATED"}
                        </span>
                      </div>
                      <p className="mt-0.5 truncate text-[11px] text-ink-400">
                        {payment.customerEmail || "No email"} · {timeAgo(payment.createdAt)}
                      </p>
                    </div>
                    <span className="font-mono text-xs font-bold text-ink-800">
                      {formatMoney(payment.amount, payment.currency)}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {q && !looksLikePaymentId && matchedPages.length === 0 && matchedPayments.length === 0 && (
            <p className="px-3 py-6 text-center text-sm text-ink-500">No matching pages or saved payments.</p>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-ink-100 bg-ink-50/50 px-4 py-2.5 text-[11px] text-ink-500">
          <span>Tip: Press <strong>⌘K</strong> anytime to open this window</span>
        </div>
      </div>
    </div>
  );
}
