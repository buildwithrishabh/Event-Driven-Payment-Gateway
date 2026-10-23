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
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-16 sm:pt-24 px-4 bg-black/75 backdrop-blur-md animate-fade-in"
      onClick={onClose}
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Search console"
        className="w-full max-w-xl overflow-hidden rounded-xl border border-[#282A30] bg-[#16171A] shadow-pop transition-all"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search header */}
        <div className="relative flex items-center border-b border-[#232529] px-4 py-3 bg-[#111215]">
          <Search className="h-4 w-4 text-[#71717A] mr-3 shrink-0" />
          <form onSubmit={handleDirectLookup} className="flex-1">
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search pages, recent payments, or paste a payment ID..."
              className="w-full bg-transparent text-sm text-[#F4F4F5] placeholder:text-[#71717A] focus:outline-none"
            />
          </form>
          {query && (
            <button
              type="button"
              onClick={() => setQuery("")}
              className="rounded-lg p-1 text-[#8E8E93] hover:bg-[#232529] hover:text-[#F4F4F5]"
              aria-label="Clear search"
            >
              <X className="h-4 w-4" />
            </button>
          )}
          <kbd className="hidden sm:inline-block ml-2 rounded border border-[#2D3037] bg-[#18191D] px-1.5 py-0.5 text-[10px] font-medium text-[#71717A]">
            ESC
          </kbd>
        </div>

        {/* Content list */}
        <div className="max-h-[60vh] overflow-y-auto p-2.5 space-y-3">
          {/* Direct ID quick action if query looks like an ID */}
          {looksLikePaymentId && (
            <button
              type="button"
              onClick={handleDirectLookup}
              className="flex w-full items-center justify-between rounded-lg p-3 text-left bg-indigo-500/10 border border-indigo-500/25 text-indigo-300 hover:bg-indigo-500/15 transition-colors"
            >
              <div className="flex items-center gap-2.5">
                <Search className="h-4 w-4 text-indigo-400 shrink-0" />
                <span className="text-xs font-medium">
                  Look up payment ID: <strong className="font-mono text-[#F4F4F5]">{q}</strong>
                </span>
              </div>
              <ArrowRight className="h-4 w-4 text-indigo-400" />
            </button>
          )}

          {/* Pages */}
          <div>
            <p className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-[#636366]">
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
                    className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-xs font-medium text-[#D4D4D8] hover:bg-[#1C1D21] hover:text-[#FFFFFF] transition-colors"
                  >
                    <div className="flex items-center gap-2.5">
                      <Icon className="h-4 w-4 text-[#71717A]" />
                      <span>{page.title}</span>
                    </div>
                    <span className="text-[10px] font-mono text-[#636366]">{page.path}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Recent Payments in this session */}
          {matchedPayments.length > 0 && (
            <div>
              <p className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-[#636366]">
                Recent payments ({matchedPayments.length})
              </p>
              <div className="space-y-1">
                {matchedPayments.slice(0, 5).map((payment) => (
                  <button
                    key={payment.paymentId}
                    type="button"
                    onClick={() => handleSelectPayment(payment.paymentId)}
                    className="flex w-full items-center justify-between rounded-lg p-2.5 text-left border border-[#232529] bg-[#111215] hover:border-[#33363D] hover:bg-[#151619] transition-colors group"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-semibold text-[#E4E4E7] group-hover:text-indigo-400">
                          {shortId(payment.paymentId)}
                        </span>
                        <span className="rounded bg-emerald-500/10 border border-emerald-500/20 px-1.5 py-0.2 text-[10px] font-medium text-emerald-400">
                          {payment.status || "CREATED"}
                        </span>
                      </div>
                      <p className="mt-0.5 truncate text-[11px] text-[#8E8E93]">
                        {payment.customerEmail || "No email"} · {timeAgo(payment.createdAt)}
                      </p>
                    </div>
                    <span className="font-mono text-xs font-semibold text-[#F4F4F5]">
                      {formatMoney(payment.amount, payment.currency)}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {q && !looksLikePaymentId && matchedPages.length === 0 && matchedPayments.length === 0 && (
            <p className="px-3 py-6 text-center text-sm text-[#8E8E93]">No matching pages or saved payments.</p>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-[#232529] bg-[#111215] px-4 py-2 text-[11px] text-[#71717A]">
          <span>Tip: Press <strong className="text-[#A1A1AA]">⌘K</strong> anytime to open search</span>
        </div>
      </div>
    </div>
  );
}
