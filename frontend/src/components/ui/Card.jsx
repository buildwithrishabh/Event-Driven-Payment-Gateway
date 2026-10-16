export function Card({ className = "", interactive = false, children, ...props }) {
  return (
    <section className={`card ${interactive ? "card-hover" : ""} ${className}`} {...props}>
      {children}
    </section>
  );
}

export function CardHeader({ title, description, action, icon: Icon, className = "" }) {
  return (
    <div
      className={`flex flex-col gap-3 border-b border-ink-100 px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between ${className}`}
    >
      <div className="flex items-center gap-3">
        {Icon && (
          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-brand-50 text-brand-700">
            <Icon className="h-4 w-4" />
          </span>
        )}
        <div>
          <h2 className="text-sm font-semibold tracking-tight text-ink-900">{title}</h2>
          {description && <p className="mt-0.5 text-xs text-ink-500">{description}</p>}
        </div>
      </div>
      {action && <div className="flex shrink-0 items-center gap-2">{action}</div>}
    </div>
  );
}

export function CardBody({ className = "", children }) {
  return <div className={`p-4 ${className}`}>{children}</div>;
}

export default Card;
