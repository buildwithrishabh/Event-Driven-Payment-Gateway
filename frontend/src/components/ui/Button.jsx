import { forwardRef } from "react";
import { Loader2 } from "lucide-react";

const VARIANTS = {
  primary:
    "bg-gradient-to-b from-indigo-500 to-indigo-600 text-white font-medium shadow-[0_1px_3px_rgba(0,0,0,0.5),inset_0_1px_0_0_rgba(255,255,255,0.22)] hover:from-indigo-400 hover:to-indigo-500 active:from-indigo-600 active:to-indigo-700 disabled:opacity-50 disabled:pointer-events-none border border-indigo-400/30 transition-all",
  secondary:
    "bg-[#16171A] text-[#E4E4E7] border border-[#282A30] shadow-[0_1px_2px_rgba(0,0,0,0.4),inset_0_1px_0_0_rgba(255,255,255,0.06)] hover:border-[#383B44] hover:bg-[#1C1E23] hover:text-[#FFFFFF] active:bg-[#131416] disabled:opacity-40 disabled:pointer-events-none transition-all",
  subtle:
    "bg-[#191A1E] text-[#D4D4D8] hover:bg-[#202227] hover:text-[#FFFFFF] border border-[#282A30] shadow-[inset_0_1px_0_0_rgba(255,255,255,0.05)] disabled:opacity-40 disabled:pointer-events-none transition-all",
  danger:
    "bg-[#241417] text-[#F87171] border border-[#3E1D22] shadow-[inset_0_1px_0_0_rgba(248,113,113,0.12)] hover:bg-[#2E181D] hover:border-[#52242B] active:bg-[#381B21] disabled:opacity-40 disabled:pointer-events-none transition-all",
  success:
    "bg-[#13231B] text-[#34D399] border border-[#1A3A2A] shadow-[inset_0_1px_0_0_rgba(52,211,153,0.12)] hover:bg-[#182F24] hover:border-[#224E38] disabled:opacity-40 disabled:pointer-events-none transition-all",
  ghost:
    "bg-transparent text-[#8E8E93] hover:bg-[#18191D] hover:text-[#F4F4F5] disabled:opacity-40 disabled:pointer-events-none transition-all",
  link: "bg-transparent text-indigo-400 underline-offset-4 hover:text-indigo-300 hover:underline p-0 h-auto font-medium transition-all",
};

const SIZES = {
  sm: "h-8 px-2.5 text-xs gap-1.5 rounded-lg",
  md: "h-9 px-3.5 text-xs font-medium gap-2 rounded-lg",
  lg: "h-10 px-4 text-sm font-medium gap-2 rounded-lg",
  xl: "h-11 px-5 text-sm font-medium gap-2.5 rounded-lg",
  icon: "h-9 w-9 p-0 rounded-lg",
  "icon-sm": "h-8 w-8 p-0 rounded-lg",
};

const Button = forwardRef(function Button(
  {
    children,
    variant = "primary",
    size = "md",
    loading = false,
    disabled = false,
    className = "",
    type = "button",
    ...props
  },
  ref,
) {
  const base =
    "inline-flex items-center justify-center rounded-xl font-semibold transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40 disabled:cursor-not-allowed whitespace-nowrap";
  return (
    <button
      ref={ref}
      type={type}
      disabled={disabled || loading}
      className={`${base} ${VARIANTS[variant] || VARIANTS.primary} ${
        SIZES[size] || SIZES.md
      } ${className}`}
      {...props}
    >
      {loading && <Loader2 className="h-4 w-4 animate-spin shrink-0" aria-hidden="true" />}
      {children}
    </button>
  );
});

export default Button;
