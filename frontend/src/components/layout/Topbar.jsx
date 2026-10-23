import { Menu, Search } from "lucide-react";
import Button from "../ui/Button.jsx";

export default function Topbar({ onOpenSidebar, onOpenSearch }) {
  return (
    <header className="sticky top-0 z-30 border-b border-[#232529] bg-[#0C0D0E]/90 backdrop-blur-md">
      <div className="flex h-14 items-center justify-between gap-3 px-4 sm:px-6 xl:px-8">
        <div className="flex items-center gap-2.5">
          <Button
            variant="ghost"
            size="icon-sm"
            className="lg:hidden text-[#8E8E93] hover:text-[#F4F4F5]"
            onClick={onOpenSidebar}
            aria-label="Open navigation"
          >
            <Menu className="h-5 w-5" />
          </Button>
          <div className="hidden items-center gap-2 sm:flex">
            <span className="flex items-center gap-1.5 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2.5 py-0.5 text-[11px] font-medium text-emerald-400">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
              Live Gateway
            </span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onOpenSearch}
            className="inline-flex h-8 items-center gap-2 rounded-lg border border-[#232529] bg-[#16171A] px-3 text-xs text-[#8E8E93] transition-colors hover:border-[#33363D] hover:bg-[#1C1D21] hover:text-[#E4E4E7]"
            aria-label="Search console"
          >
            <Search className="h-3.5 w-3.5 text-[#71717A]" />
            <span className="hidden sm:inline">Search payments or docs</span>
            <kbd className="hidden rounded border border-[#282A30] bg-[#111215] px-1.5 py-0.5 font-mono text-[9px] font-medium text-[#71717A] sm:inline">
              Ctrl K
            </kbd>
          </button>
        </div>
      </div>
    </header>
  );
}
