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
    <header className="flex flex-col gap-4 border-b border-ink-200/80 pb-5 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex min-w-0 items-center gap-3">
        {Icon && (
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-brand-50 text-brand-700">
            <Icon className="h-4 w-4" />
          </span>
        )}
        <div className="min-w-0">
          {breadcrumb && <p className="mb-0.5 text-xs font-medium text-ink-400">{breadcrumb}</p>}
          <h1 className="text-xl font-semibold tracking-tight text-ink-900 sm:text-2xl">{title}</h1>
          {description && <p className="mt-1 max-w-2xl text-sm text-ink-500">{description}</p>}
          {children}
        </div>
      </div>
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
    </header>
  );
}
