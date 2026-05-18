// Plain-English activity feed used inside the Settings → Activity tab.
// Reads from the shared audit-logs endpoint and renders each row through
// `humanizeAudit` so operators see "Order ABC moved from Pending to Shipped"
// instead of raw `UPDATE_ORDER_STATUS` codes + JSON blobs.

import { useState } from "react";
import { useListAuditLogs } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { History, Plus, Pencil, Send, Trash2, Circle } from "lucide-react";
import { humanizeAudit, formatWhen, type AuditTone } from "@/lib/audit-humanize";

const ENTITY_OPTIONS: { value: string; label: string }[] = [
  { value: "all", label: "Everything" },
  { value: "order", label: "Orders" },
  { value: "customer", label: "Customers" },
  { value: "user", label: "Users" },
  { value: "business", label: "Business" },
];

const TONE_STYLES: Record<AuditTone, { icon: typeof Circle; ring: string }> = {
  create: { icon: Plus, ring: "border-green-200 bg-green-50 text-green-700" },
  update: { icon: Pencil, ring: "border-blue-200 bg-blue-50 text-blue-700" },
  email: { icon: Send, ring: "border-purple-200 bg-purple-50 text-purple-700" },
  delete: { icon: Trash2, ring: "border-red-200 bg-red-50 text-red-700" },
  neutral: { icon: Circle, ring: "border-border bg-muted text-muted-foreground" },
};

const PAGE_SIZE = 25;

export function ActivityFeed() {
  const [entityType, setEntityType] = useState<string>("all");
  const [page, setPage] = useState(1);

  const { data, isLoading } = useListAuditLogs({
    entityType: entityType !== "all" ? entityType : undefined,
    page,
    limit: PAGE_SIZE,
  });

  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="p-4 space-y-4">
      {/* Filter — kept lightweight so the feed itself stays the focus. */}
      <div className="flex items-center gap-2 text-sm">
        <span className="text-muted-foreground">Show</span>
        <Select
          value={entityType}
          onValueChange={(v) => {
            setEntityType(v);
            setPage(1);
          }}
        >
          <SelectTrigger className="w-[160px] h-8 text-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {ENTITY_OPTIONS.map((o) => (
              <SelectItem key={o.value} value={o.value}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <ul className="space-y-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <li key={i} className="flex gap-3 p-3 border bg-muted/10">
              <Skeleton className="h-8 w-8 flex-shrink-0" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-3 w-1/4" />
              </div>
            </li>
          ))}
        </ul>
      ) : !data?.data.length ? (
        <div className="border bg-muted/10 px-6 py-12 text-center">
          <History className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
          <p className="text-sm font-medium">Nothing's happened here yet</p>
          <p className="text-xs text-muted-foreground mt-1">
            Once you create orders, update statuses, or send emails, you'll see them here.
          </p>
        </div>
      ) : (
        <>
          <ul className="space-y-1.5">
            {data.data.map((log) => {
              const { title, detail, tone } = humanizeAudit(log);
              const when = formatWhen(log.createdAt);
              const { icon: Icon, ring } = TONE_STYLES[tone];
              return (
                <li
                  key={log.id}
                  className="flex items-start gap-3 p-3 border border-border bg-card hover:bg-muted/20 transition-colors"
                >
                  <span
                    className={`flex h-8 w-8 items-center justify-center border flex-shrink-0 ${ring}`}
                    aria-hidden="true"
                  >
                    <Icon className="h-4 w-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-foreground leading-snug">{title}</p>
                    {detail && (
                      <p className="text-xs text-muted-foreground mt-0.5">{detail}</p>
                    )}
                  </div>
                  <time
                    className="text-xs text-muted-foreground whitespace-nowrap flex-shrink-0"
                    title={when.absolute}
                    dateTime={log.createdAt}
                  >
                    {when.relative}
                  </time>
                </li>
              );
            })}
          </ul>

          {total > PAGE_SIZE && (
            <div className="flex items-center justify-between pt-2 text-sm">
              <span className="text-muted-foreground">
                Page {page} of {totalPages} · {total} events
              </span>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page === 1}
                  onClick={() => setPage((p) => p - 1)}
                >
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => p + 1)}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
