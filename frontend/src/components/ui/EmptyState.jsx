export default function EmptyState({ icon: Icon, title, description, action, className = "" }) {
  return (
    <div className={`flex flex-col items-center justify-center px-6 py-12 text-center ${className}`}>
      {Icon && (
        <span className="mb-4 grid h-12 w-12 place-items-center rounded-xl bg-[#1C1D21] text-[#A1A1AA] border border-[#282A30]">
          <Icon className="h-6 w-6" />
        </span>
      )}
      <h3 className="text-sm font-semibold text-[#F4F4F5]">{title}</h3>
      {description && (
        <p className="mt-1 max-w-sm text-xs leading-relaxed text-[#8E8E93]">{description}</p>
      )}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
