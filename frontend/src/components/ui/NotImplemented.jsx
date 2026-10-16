import { Construction, Clock3 } from "lucide-react";

const METHOD_STYLES = {
  GET: "bg-sky-50 text-sky-700 border-sky-200/70",
  POST: "bg-emerald-50 text-emerald-700 border-emerald-200/70",
  PATCH: "bg-amber-50 text-amber-700 border-amber-200/70",
  DELETE: "bg-rose-50 text-rose-700 border-rose-200/70",
};

/**
 * A calm empty state for areas that are not yet available.
 * Shows the proposed endpoint (method + path) and why the screen needs it.
 */
export default function NotImplemented({
  variant = "panel",
  endpoint,
  title,
  note,
  className = "",
}) {
  if (variant === "inline") {
    return (
      <div
        className={`flex flex-wrap items-center gap-2 rounded-xl border border-ink-200/80 bg-ink-50/70 px-4 py-3 ${className}`}
      >
        <Clock3 className="h-4 w-4 shrink-0 text-ink-400" />
        <p className="text-xs font-medium text-ink-600">Coming soon</p>
        {endpoint && (
          <code className="font-mono text-[11px] text-ink-400">
            {endpoint.method} {endpoint.path}
          </code>
        )}
      </div>
    );
  }

  return (
    <div
      className={`flex flex-col items-center rounded-2xl border border-dashed border-ink-200 bg-ink-50/50 px-6 py-9 text-center ${className}`}
    >
      <span className="mb-3 grid h-11 w-11 place-items-center rounded-2xl border border-ink-200/60 bg-white text-brand-600 shadow-2xs">
        <Construction className="h-5 w-5" />
      </span>
      <h3 className="text-sm font-semibold text-ink-900">
        {title || "Not implemented yet"}
      </h3>
      {endpoint && (
        <div className="mt-2 flex items-center gap-2">
          <span
            className={`rounded-md border px-1.5 py-0.5 font-mono text-[10px] font-bold ${
              METHOD_STYLES[endpoint.method] ||
              "border-ink-200 bg-ink-100 text-ink-600"
            }`}
          >
            {endpoint.method}
          </span>
          <code className="font-mono text-xs text-ink-500">{endpoint.path}</code>
        </div>
      )}
      {(note || endpoint?.purpose) && (
        <p className="mt-3 max-w-md text-xs leading-relaxed text-ink-500">
          {note || endpoint.purpose}
        </p>
      )}
    </div>
  );
}
