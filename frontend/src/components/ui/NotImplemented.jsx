import { Construction, Clock3 } from "lucide-react";

const METHOD_STYLES = {
  GET: "bg-sky-500/10 text-sky-400 border-sky-500/20",
  POST: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  PATCH: "bg-amber-500/10 text-amber-400 border-amber-500/20",
  DELETE: "bg-rose-500/10 text-rose-400 border-rose-500/20",
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
        className={`flex flex-wrap items-center gap-2 rounded-lg border border-[#26282E] bg-[#111215] px-4 py-3 ${className}`}
      >
        <Clock3 className="h-4 w-4 shrink-0 text-[#71717A]" />
        <p className="text-xs font-medium text-[#D4D4D8]">Coming soon</p>
        {endpoint && (
          <code className="font-mono text-[11px] text-[#A1A1AA]">
            {endpoint.method} {endpoint.path}
          </code>
        )}
      </div>
    );
  }

  return (
    <div
      className={`flex flex-col items-center rounded-xl border border-dashed border-[#282A30] bg-[#111215] px-6 py-9 text-center ${className}`}
    >
      <span className="mb-3.5 grid h-11 w-11 place-items-center rounded-xl border border-[#282A30] bg-[#16171A] text-indigo-400">
        <Construction className="h-5 w-5" />
      </span>
      <h3 className="text-sm font-semibold text-[#F4F4F5]">
        {title || "Not implemented yet"}
      </h3>
      {endpoint && (
        <div className="mt-2.5 flex items-center gap-2">
          <span
            className={`rounded-md border px-1.5 py-0.5 font-mono text-[10px] font-semibold ${
              METHOD_STYLES[endpoint.method] ||
              "border-[#282A30] bg-[#18191D] text-[#D4D4D8]"
            }`}
          >
            {endpoint.method}
          </span>
          <code className="font-mono text-xs text-[#A1A1AA]">{endpoint.path}</code>
        </div>
      )}
      {(note || endpoint?.purpose) && (
        <p className="mt-3 max-w-md text-xs leading-relaxed text-slate-400">
          {note || endpoint.purpose}
        </p>
      )}
    </div>
  );
}
