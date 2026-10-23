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
    brand: "bg-indigo-500/10 text-indigo-400 border border-indigo-500/20",
    success: "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20",
    warning: "bg-amber-500/10 text-amber-400 border border-amber-500/20",
    danger: "bg-rose-500/10 text-rose-400 border border-rose-500/20",
    neutral: "bg-[#232529] text-[#D4D4D8] border border-[#2D3037]",
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
      <div className="mt-3.5">
        {children || (
          <>
            <div className="flex items-baseline gap-2.5">
              <p className="text-2xl font-bold tracking-tight text-[#F4F4F5]">{value}</p>
              {trend != null && (
                <span
                  className={`inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[11px] font-medium border ${
                    trendUp
                      ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                      : "bg-rose-500/10 text-rose-400 border-rose-500/20"
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
            {sublabel && <p className="mt-1 text-xs text-[#8E8E93]">{sublabel}</p>}
          </>
        )}
      </div>
    </div>
  );
}
