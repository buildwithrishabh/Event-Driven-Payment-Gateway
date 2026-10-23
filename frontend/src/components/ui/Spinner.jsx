import { Loader2 } from "lucide-react";

/** Centered inline spinner with optional caption. */
export default function Spinner({ label, className = "", size = 20 }) {
  return (
    <div className={`flex items-center justify-center gap-2 text-slate-400 ${className}`}>
      <Loader2 size={size} className="animate-spin text-brand-400" />
      {label && <span className="text-sm font-medium">{label}</span>}
    </div>
  );
}

/** Full-card loading panel. */
export function LoadingBlock({ label = "Loading…", className = "" }) {
  return (
    <div className={`flex flex-col items-center justify-center gap-3 py-12 ${className}`}>
      <Spinner size={24} />
      <p className="text-xs font-medium text-slate-400">{label}</p>
    </div>
  );
}
