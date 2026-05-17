import { useState } from "react";
import { useListAuditLogs } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { FileText } from "lucide-react";
import { EmptyState } from "@/components/page-loader";
import { format } from "date-fns";

const ENTITY_TYPES = ["order", "customer", "user", "business"];

const ACTION_LABELS: Record<string, string> = {
  CREATE_ORDER: "Order created",
  UPDATE_ORDER_STATUS: "Status updated",
  RESEND_EMAIL: "Email resent",
  CREATE_CUSTOMER: "Customer created",
  UPDATE_CUSTOMER: "Customer updated",
};

function getActionBadgeClass(action: string): string {
  if (action.startsWith("CREATE")) return "bg-green-100 text-green-700";
  if (action.startsWith("UPDATE")) return "bg-blue-100 text-blue-700";
  if (action.startsWith("RESEND")) return "bg-purple-100 text-purple-700";
  if (action.startsWith("DELETE")) return "bg-red-100 text-red-700";
  return "bg-gray-100 text-gray-600";
}

export default function AuditLogsPage() {
  const [entityType, setEntityType] = useState<string>("all");
  const [page, setPage] = useState(1);

  const { data, isLoading } = useListAuditLogs({
    entityType: entityType !== "all" ? entityType : undefined,
    page,
    limit: 30,
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Audit Logs</h1>
        <p className="text-muted-foreground mt-1">Complete history of all actions in your account</p>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-3">
            <span className="text-sm text-muted-foreground">Filter by entity:</span>
            <Select value={entityType} onValueChange={v => { setEntityType(v); setPage(1); }}>
              <SelectTrigger className="w-[160px]"><SelectValue placeholder="All types" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All types</SelectItem>
                {ENTITY_TYPES.map(t => <SelectItem key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-6 space-y-3">{Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}</div>
          ) : !data?.data.length ? (
            <EmptyState
              icon={<FileText className="h-12 w-12" />}
              title="No audit logs found"
              description="Activity in your account will appear here once it happens."
            />
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Action</TableHead>
                    <TableHead>Entity Type</TableHead>
                    <TableHead>Entity ID</TableHead>
                    <TableHead>Details</TableHead>
                    <TableHead>Time</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.data.map((log) => (
                    <TableRow key={log.id} className="hover:bg-muted/40">
                      <TableCell>
                        <span className={`text-xs font-medium px-2 py-1 rounded-full ${getActionBadgeClass(log.action)}`}>
                          {ACTION_LABELS[log.action] ?? log.action}
                        </span>
                      </TableCell>
                      <TableCell className="text-muted-foreground capitalize">{log.entityType}</TableCell>
                      <TableCell className="font-mono text-xs text-muted-foreground max-w-[160px] truncate">{log.entityId ?? "—"}</TableCell>
                      <TableCell className="text-xs text-muted-foreground max-w-[200px] truncate">
                        {log.metadata ? JSON.stringify(log.metadata) : "—"}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                        {format(new Date(log.createdAt), "MMM d, HH:mm")}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {(data?.total ?? 0) > 30 && (
                <div className="flex items-center justify-between px-6 py-4 border-t">
                  <span className="text-sm text-muted-foreground">Page {page} of {Math.ceil((data?.total ?? 0) / 30)}</span>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" disabled={page === 1} onClick={() => setPage(p => p - 1)}>Previous</Button>
                    <Button variant="outline" size="sm" disabled={page >= Math.ceil((data?.total ?? 0) / 30)} onClick={() => setPage(p => p + 1)}>Next</Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
