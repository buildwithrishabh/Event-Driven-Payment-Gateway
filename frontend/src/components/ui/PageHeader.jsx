/** Compact, consistent page heading with optional context and actions. */
export default function PageHeader({
  title,
  description,
  icon: Icon,
  breadcrumb,
  actions,
  children,
}) {
  return (
    <header className="flex flex-col gap-4 border-b border-[#232529] pb-5 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex min-w-0 items-center gap-3.5">
        {Icon && (
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
            <Icon className="h-5 w-5" />
          </span>
        )}
        <div className="min-w-0">
          {breadcrumb && <p className="mb-0.5 text-xs font-medium text-[#71717A]">{breadcrumb}</p>}
          <h1 className="text-xl font-bold tracking-tight text-[#F4F4F5] sm:text-2xl">{title}</h1>
          {description && <p className="mt-1 max-w-2xl text-xs leading-relaxed text-[#8E8E93]">{description}</p>}
          {children}
        </div>
      </div>
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-2.5">{actions}</div>}
    </header>
  );
}
