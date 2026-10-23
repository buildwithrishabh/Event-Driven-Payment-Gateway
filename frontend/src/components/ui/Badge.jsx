const TONES = {
  neutral: "border-[#282A30] bg-[#18191D] text-[#D4D4D8]",
  brand: "border-indigo-500/25 bg-indigo-500/10 text-indigo-300",
  solid: "border-transparent bg-indigo-600 text-white shadow-xs",
  success: "border-emerald-500/25 bg-emerald-500/10 text-emerald-400",
  warning: "border-amber-500/25 bg-amber-500/10 text-amber-300",
  danger: "border-rose-500/25 bg-rose-500/10 text-rose-400",
  purple: "border-purple-500/25 bg-purple-500/10 text-purple-300",
  sky: "border-sky-500/25 bg-sky-500/10 text-sky-300",
};

/**
 * Small pill used for statuses and tags. Pass `tone` for a preset colour, or a
 * raw `className` from the status-style maps in lib/constants.js.
 */
export function Badge({ children, tone = "neutral", className = "", dot = false }) {
  const toneClass = TONES[tone] || TONES.neutral;
  return (
    <span className={`chip ${className || toneClass}`}>
      {dot && <span className="h-1.5 w-1.5 rounded-full bg-current opacity-80" />}
      {children}
    </span>
  );
}

export default Badge;
