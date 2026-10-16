import { NavLink } from "react-router-dom";
import { BookText, Code2, CreditCard, LayoutDashboard, Settings, Webhook, X } from "lucide-react";
import { NAV_ITEMS, MERCHANT_STATUS_STYLES, statusStyle } from "../../lib/constants.js";
import { useAuth } from "../../context/AuthContext.jsx";

const ICONS = { LayoutDashboard, CreditCard, BookText, Webhook, Code2, Settings };

function NavItem({ item, onNavigate }) {
  const Icon = ICONS[item.icon] || Settings;
  return (
    <NavLink
      to={item.to}
      end={item.end}
      onClick={onNavigate}
      className={({ isActive }) =>
        `group flex items-center gap-3 rounded-xl px-3 py-2 text-xs font-semibold transition ${
          isActive
            ? "bg-brand-50 text-brand-700 shadow-2xs"
            : "text-ink-600 hover:bg-ink-50 hover:text-ink-900"
        }`
      }
    >
      {({ isActive }) => (
        <>
          <Icon
            className={`h-4 w-4 transition-colors ${
              isActive ? "text-brand-600" : "text-ink-400 group-hover:text-ink-700"
            }`}
          />
          <span>{item.label}</span>
        </>
      )}
    </NavLink>
  );
}

function SidebarInner({ onNavigate }) {
  const { merchant, isConnected } = useAuth();
  const state = statusStyle(MERCHANT_STATUS_STYLES, merchant?.status);
  const initial = merchant?.name ? merchant.name.charAt(0).toUpperCase() : "M";

  return (
    <div className="flex h-full flex-col border-r border-ink-200/90 bg-white">
      <div className="flex h-14 items-center justify-between border-b border-ink-100 px-4">
        <div className="flex items-center gap-2.5">
          <span
            className="grid h-8 w-8 place-items-center rounded-lg bg-brand-600 text-white shadow-glow-sm"
            aria-hidden="true"
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              width="17"
              height="17"
              stroke="currentColor"
              strokeWidth="2.5"
            >
              <polygon points="12 2 2 7 12 12 22 7 12 2" />
              <polyline points="2 17 12 22 22 17" />
              <polyline points="2 12 12 17 22 12" />
            </svg>
          </span>
          <span className="text-sm font-bold tracking-tight text-ink-900">ClearLedger</span>
        </div>
        <span className="rounded-md border border-ink-200 bg-ink-50 px-1.5 py-0.5 font-mono text-[10px] font-medium text-ink-500">
          v1.0
        </span>
      </div>

      <nav aria-label="Main navigation" className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
        <div className="mb-2 px-3 text-[10px] font-semibold uppercase tracking-wider text-ink-400">
          Platform
        </div>
        {NAV_ITEMS.map((item) => (
          <NavItem key={item.to} item={item} onNavigate={onNavigate} />
        ))}
      </nav>

      {isConnected && (
        <div className="border-t border-ink-100 p-3">
          <div className="flex items-center gap-3 rounded-xl border border-ink-100 bg-ink-50/70 p-2.5">
            <div className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-brand-100 text-xs font-bold text-brand-700">
              {initial}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-semibold text-ink-900">{merchant?.name}</p>
              <div className="flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                <p className="truncate text-[11px] text-ink-500">{merchant?.email}</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export function Sidebar() {
  return <aside className="hidden w-60 shrink-0 lg:block"><div className="fixed inset-y-0 left-0 z-40 w-60"><SidebarInner /></div></aside>;
}

export function MobileSidebar({ open, onClose }) {
  if (!open) return null;
  return <div className="fixed inset-0 z-50 lg:hidden">
    <button type="button" className="absolute inset-0 bg-ink-950/40" onClick={onClose} aria-label="Close navigation" />
    <div className="absolute inset-y-0 left-0 w-72 max-w-[85%] shadow-pop"><button type="button" onClick={onClose} className="absolute right-3 top-3 z-10 rounded-md p-1.5 text-ink-500 hover:bg-ink-100" aria-label="Close navigation"><X className="h-5 w-5" /></button><SidebarInner onNavigate={onClose} /></div>
  </div>;
}
