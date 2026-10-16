/** Skeleton primitives backed by the shimmer animation in index.css. */
export function Skeleton({ className = "" }) {
  return <div className={`skeleton ${className}`} />;
}

/** A stack of shimmer rows for table-like loading states. */
export function SkeletonRows({ rows = 5, className = "" }) {
  return (
    <div className={`space-y-3 ${className}`}>
      {Array.from({ length: rows }).map((_, index) => (
        <Skeleton key={index} className="h-10 w-full" />
      ))}
    </div>
  );
}

export function SkeletonCard({ className = "" }) {
  return (
    <div className={`card p-5 ${className}`}>
      <Skeleton className="h-4 w-28" />
      <Skeleton className="mt-4 h-8 w-40" />
      <Skeleton className="mt-3 h-3 w-24" />
    </div>
  );
}
