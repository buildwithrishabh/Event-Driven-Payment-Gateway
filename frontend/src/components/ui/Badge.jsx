const TONES = {
  neutral: "border-ink-200/80 bg-ink-100 text-ink-600",
  brand: "border-brand-200 bg-brand-50 text-brand-700",
  solid: "border-transparent bg-brand-gradient text-white",
  success: "border-emerald-200/70 bg-emerald-50 text-emerald-700",
  warning: "border-amber-200/70 bg-amber-50 text-amber-700",
  danger: "border-rose-200/70 bg-rose-50 text-rose-700",
};

/**
 * Small pill used for statuses and tags. Pass `tone` for a preset colour, or a
 * raw `className` from the status-style maps in lib/constants.js.
 */
export function Badge({ children, tone = "neutral", className = "", dot = false }) {
  const toneClass = TONES[tone] || TONES.neutral;
  return (
    <span className={`chip ${className || toneClass}`}>
      {dot && <span className="h-1.5 w-1.5 rounded-full bg-current opacity-70" />}
      {children}
    </span>
  );
}

export default Badge;
