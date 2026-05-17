import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";

interface PageLoaderProps {
  label?: string;
  className?: string;
  fullHeight?: boolean;
}

export function PageLoader({
  label,
  className,
  fullHeight = false,
}: PageLoaderProps) {
  // No default label — a bare spinner reads as "working" without the page
  // feeling broken. Callers can still pass `label` if they need explicit
  // copy (e.g. for screen reader context).
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-3 text-muted-foreground",
        fullHeight ? "min-h-[60vh]" : "py-16",
        className,
      )}
      role="status"
      aria-live="polite"
      aria-label={label ?? "Loading"}
    >
      <Spinner className="size-6 text-primary" aria-hidden="true" />
      {label ? <p className="text-sm">{label}</p> : null}
    </div>
  );
}

interface EmptyStateProps {
  icon: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}

export function EmptyState({ icon, title, description, action, className }: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center text-center py-16 px-4",
        className,
      )}
    >
      <div
        className="h-12 w-12 mb-4 text-muted-foreground/40 flex items-center justify-center"
        aria-hidden="true"
      >
        {icon}
      </div>
      <p className="text-foreground font-medium">{title}</p>
      {description ? (
        <p className="text-muted-foreground/70 text-sm mt-1 max-w-sm">{description}</p>
      ) : null}
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}
