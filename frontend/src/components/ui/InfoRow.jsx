/**
 * Definition-list row for key/value detail panels.
 * `mono` renders the value in a monospace font (ids, hashes, keys).
 */
export function InfoRow({ label, value, mono = false, className = "", children }) {
  return (
    <div
      className={`flex flex-col gap-1 border-b border-[#1E2024] py-3.5 last:border-0 sm:flex-row sm:items-center sm:justify-between sm:gap-4 ${className}`}
    >
      <dt className="text-xs font-medium uppercase tracking-wider text-[#71717A]">
        {label}
      </dt>
      <dd
        className={`min-w-0 break-words text-sm text-[#F4F4F5] sm:text-right ${
          mono ? "font-mono text-xs text-[#E4E4E7]" : "font-medium"
        }`}
      >
        {children ?? value ?? "—"}
      </dd>
    </div>
  );
}

export default InfoRow;
