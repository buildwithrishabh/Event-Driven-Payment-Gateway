import { Menu, Search } from "lucide-react";
import Button from "../ui/Button.jsx";

export default function Topbar({ onOpenSidebar, onOpenSearch }) {
  return (
    <header className="sticky top-0 z-30 border-b border-ink-200/80 bg-white/95 backdrop-blur-sm">
      <div className="flex h-14 items-center justify-between gap-3 px-4 sm:px-6 xl:px-8">
        <div className="flex items-center gap-2.5">
          <Button
            variant="ghost"
            size="icon-sm"
            className="lg:hidden"
            onClick={onOpenSidebar}
            aria-label="Open navigation"
          >
            <Menu className="h-5 w-5" />
          </Button>
          <div className="hidden items-center gap-2 sm:flex">
            <span className="flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-700">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
              Live Gateway
            </span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onOpenSearch}
            className="inline-flex h-8 items-center gap-2 rounded-lg border border-ink-200/90 bg-ink-50/50 px-3 text-xs text-ink-500 shadow-2xs transition hover:border-ink-300 hover:bg-white hover:text-ink-800"
            aria-label="Search console"
          >
            <Search className="h-3.5 w-3.5 text-ink-400" />
            <span className="hidden sm:inline">Search payments or docs</span>
            <kbd className="hidden rounded border border-ink-200 bg-white px-1 py-0.5 font-mono text-[9px] font-semibold text-ink-500 sm:inline">
              Ctrl K
            </kbd>
          </button>
        </div>
      </div>
    </header>
  );
}
