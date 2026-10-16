/**
 * Definition-list row for key/value detail panels.
 * `mono` renders the value in a monospace font (ids, hashes, keys).
 */
export function InfoRow({ label, value, mono = false, className = "", children }) {
  return (
    <div
      className={`flex flex-col gap-1 border-b border-ink-100 py-3 last:border-0 sm:flex-row sm:items-center sm:justify-between sm:gap-4 ${className}`}
    >
      <dt className="text-xs font-medium uppercase tracking-wide text-ink-400">
        {label}
      </dt>
      <dd
        className={`min-w-0 break-words text-sm text-ink-800 sm:text-right ${
          mono ? "font-mono text-[13px]" : "font-medium"
        }`}
      >
        {children ?? value ?? "—"}
      </dd>
    </div>
  );
}

export default InfoRow;
