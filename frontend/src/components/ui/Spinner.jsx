import { Loader2 } from "lucide-react";

/** Centered inline spinner with optional caption. */
export default function Spinner({ label, className = "", size = 20 }) {
  return (
    <div className={`flex items-center justify-center gap-2 text-ink-500 ${className}`}>
      <Loader2 size={size} className="animate-spin text-brand-500" />
      {label && <span className="text-sm">{label}</span>}
    </div>
  );
}

/** Full-card loading panel. */
export function LoadingBlock({ label = "Loading…", className = "" }) {
  return (
    <div className={`flex flex-col items-center justify-center gap-3 py-12 ${className}`}>
      <Spinner size={24} />
      <p className="text-sm text-ink-500">{label}</p>
    </div>
  );
}
