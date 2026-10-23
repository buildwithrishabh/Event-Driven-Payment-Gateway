import { useEffect, useRef, useState } from "react";
import { Check, Copy } from "lucide-react";
import { copyToClipboard } from "../../lib/format.js";

/** Copy-to-clipboard button with an inline success state. */
export default function CopyButton({
  value,
  label = "Copy",
  className = "",
  onCopied,
  showLabel = true,
  title,
}) {
  const [copied, setCopied] = useState(false);
  const timerRef = useRef(null);

  useEffect(() => () => clearTimeout(timerRef.current), []);

  async function handleCopy() {
    const ok = await copyToClipboard(value ?? "");
    if (!ok) return;
    setCopied(true);
    onCopied?.(value);
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setCopied(false), 1800);
  }

  return (
    <button
      type="button"
      onClick={handleCopy}
      title={title || label}
      aria-label={title || label}
      className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-medium transition-colors ${
        copied
          ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400"
          : "border-[#282A30] bg-[#16171A] text-[#8E8E93] hover:border-[#363840] hover:bg-[#1C1D21] hover:text-[#FFFFFF]"
      } ${className}`}
    >
      {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
      {showLabel && (copied ? "Copied" : label)}
    </button>
  );
}
