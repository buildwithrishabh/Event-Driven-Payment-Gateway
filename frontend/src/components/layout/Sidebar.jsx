import { NavLink } from "react-router-dom";
import { BookText, Code2, CreditCard, LayoutDashboard, RotateCcw, Settings, Webhook, X } from "lucide-react";
import { NAV_ITEMS, MERCHANT_STATUS_STYLES, statusStyle } from "../../lib/constants.js";
import { useAuth } from "../../context/AuthContext.jsx";

const ICONS = { LayoutDashboard, CreditCard, RotateCcw, BookText, Webhook, Code2, Settings };

function NavItem({ item, onNavigate }) {
  const Icon = ICONS[item.icon] || Settings;
  return (
    <NavLink
      to={item.to}
      end={item.end}
      onClick={onNavigate}
      className={({ isActive }) =>
        `group relative flex items-center gap-3 rounded-lg px-3 py-2 text-xs font-medium transition-colors ${
          isActive
            ? "bg-[#1B1D22] text-[#F4F4F5] border border-[#2A2C33] shadow-xs"
            : "text-[#8E8E93] hover:bg-[#16171A] hover:text-[#EDEDEE] border border-transparent"
        }`
      }
    >
      {({ isActive }) => (
        <>
          <Icon
            className={`h-4 w-4 transition-colors ${
              isActive ? "text-indigo-400" : "text-[#71717A] group-hover:text-[#A1A1AA]"
            }`}
          />
          <span>{item.label}</span>
          {isActive && (
            <span className="absolute right-2.5 h-1.5 w-1.5 rounded-full bg-indigo-400" />
          )}
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
    <div className="flex h-full flex-col border-r border-[#232529] bg-[#111215]">
      <div className="flex h-14 items-center justify-between border-b border-[#232529] px-4">
        <div className="flex items-center gap-2.5">
          <span
            className="grid h-8 w-8 place-items-center rounded-lg bg-indigo-600 text-white shadow-xs"
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
          <span className="text-sm font-semibold tracking-tight text-[#F4F4F5]">ClearLedger</span>
        </div>
        <span className="rounded-md border border-[#282A30] bg-[#18191D] px-1.5 py-0.5 font-mono text-[10px] font-medium text-[#8E8E93]">
          v1.0
        </span>
      </div>

      <nav aria-label="Main navigation" className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
        <div className="mb-2 px-3 text-[10px] font-semibold uppercase tracking-wider text-[#636366]">
          Platform
        </div>
        {NAV_ITEMS.map((item) => (
          <NavItem key={item.to} item={item} onNavigate={onNavigate} />
        ))}
      </nav>

      {isConnected && (
        <div className="border-t border-[#232529] p-3">
          <div className="flex items-center gap-3 rounded-lg border border-[#232529] bg-[#16171A] p-2.5 transition-colors hover:border-[#33363D]">
            <div className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-indigo-500/10 text-xs font-semibold text-indigo-300 border border-indigo-500/20">
              {initial}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-semibold text-[#F4F4F5]">{merchant?.name}</p>
              <div className="flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                <p className="truncate text-[11px] text-[#8E8E93]">{merchant?.email}</p>
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
  return (
    <div className="fixed inset-0 z-50 lg:hidden">
      <button
        type="button"
        className="absolute inset-0 bg-black/70 backdrop-blur-sm transition-opacity"
        onClick={onClose}
        aria-label="Close navigation"
      />
      <div className="absolute inset-y-0 left-0 w-72 max-w-[85%] shadow-pop">
        <button
          type="button"
          onClick={onClose}
          className="absolute right-3 top-3 z-10 rounded-md p-1.5 text-slate-400 hover:bg-white/10 hover:text-white"
          aria-label="Close navigation"
        >
          <X className="h-5 w-5" />
        </button>
        <SidebarInner onNavigate={onClose} />
      </div>
    </div>
  );
}
