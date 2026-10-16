import { forwardRef } from "react";
import { Loader2 } from "lucide-react";

const VARIANTS = {
  primary:
    "bg-brand-600 text-white hover:bg-brand-700 active:bg-brand-800 disabled:bg-ink-200 disabled:text-ink-400",
  secondary:
    "bg-white text-ink-800 border border-ink-200 shadow-2xs hover:border-ink-300 hover:bg-ink-50 active:bg-ink-100 disabled:text-ink-400 disabled:border-ink-200",
  subtle:
    "bg-ink-100 text-ink-700 hover:bg-ink-200 active:bg-ink-300 disabled:text-ink-400",
  danger:
    "bg-rose-50 text-rose-700 border border-rose-200 shadow-2xs hover:bg-rose-100 active:bg-rose-200 disabled:text-rose-300",
  success:
    "bg-emerald-600 text-white shadow-glow-sm hover:bg-emerald-700 active:bg-emerald-800 disabled:bg-emerald-200",
  ghost:
    "bg-transparent text-ink-600 hover:bg-ink-100 hover:text-ink-900 disabled:text-ink-300",
  link: "bg-transparent text-brand-600 underline-offset-4 hover:text-brand-700 hover:underline p-0 h-auto font-semibold",
};

const SIZES = {
  sm: "h-8 px-3 text-xs gap-1.5 rounded-lg",
  md: "h-9 px-3.5 text-sm gap-2 rounded-xl",
  lg: "h-10 px-4 text-sm gap-2 rounded-xl",
  xl: "h-11 px-5 text-sm gap-2 rounded-xl",
  icon: "h-9 w-9 p-0 rounded-xl",
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
    "inline-flex items-center justify-center rounded-xl font-semibold transition duration-150 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand-500/20 disabled:cursor-not-allowed whitespace-nowrap";
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
      {loading && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
      {children}
    </button>
  );
});

export default Button;
