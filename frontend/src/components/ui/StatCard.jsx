import { ArrowDownRight, ArrowUpRight } from "lucide-react";

/**
 * Compact metric tile. Accepts a real `value`, or renders custom children.
 * Optional `trend` renders a coloured delta pill.
 */
export default function StatCard({
  label,
  value,
  sublabel,
  icon: Icon,
  tone = "brand",
  trend,
  children,
}) {
  const tones = {
    brand: "bg-brand-50 text-brand-600 ring-1 ring-inset ring-brand-100",
    success: "bg-emerald-50 text-emerald-600 ring-1 ring-inset ring-emerald-100",
    warning: "bg-amber-50 text-amber-600 ring-1 ring-inset ring-amber-100",
    danger: "bg-rose-50 text-rose-600 ring-1 ring-inset ring-rose-100",
    neutral: "bg-ink-100 text-ink-600 ring-1 ring-inset ring-ink-200",
  };

  const trendUp = trend != null && trend >= 0;

  return (
    <div className="stat-tile animate-fade-in">
      <div className="flex items-start justify-between gap-3">
        <p className="eyebrow">{label}</p>
        {Icon && (
          <span
            className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg ${
              tones[tone] || tones.brand
            }`}
          >
            <Icon className="h-4 w-4" />
          </span>
        )}
      </div>
      <div className="mt-3">
        {children || (
          <>
            <div className="flex items-baseline gap-2">
              <p className="text-2xl font-semibold tracking-tight text-ink-900">{value}</p>
              {trend != null && (
                <span
                  className={`inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[11px] font-semibold ${
                    trendUp
                      ? "bg-emerald-50 text-emerald-700"
                      : "bg-rose-50 text-rose-700"
                  }`}
                >
                  {trendUp ? (
                    <ArrowUpRight className="h-3 w-3" />
                  ) : (
                    <ArrowDownRight className="h-3 w-3" />
                  )}
                  {Math.abs(trend)}%
                </span>
              )}
            </div>
            {sublabel && <p className="mt-1 text-xs text-ink-500">{sublabel}</p>}
          </>
        )}
      </div>
    </div>
  );
}
