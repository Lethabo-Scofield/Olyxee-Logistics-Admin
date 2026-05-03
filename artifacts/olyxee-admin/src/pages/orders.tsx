import { useState } from "react";
import { Link, useLocation } from "wouter";
import { useListOrders, useListCustomers, useCreateOrder, useUpdateOrderStatus } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { StatusBadge } from "@/components/status-badge";
import { Plus, Search, ArrowRight, Package, Pencil, Mail } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { ORDER_STATUSES, nextStatuses, isTerminal } from "@/lib/order-statuses";

function CreateOrderDialog({ onSuccess }: { onSuccess: () => void }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ customerId: "", orderReference: "", description: "", estimatedDeliveryDate: "" });
  const createMutation = useCreateOrder();
  const { data: customers } = useListCustomers({ limit: 100 });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createMutation.mutate(
      { data: { customerId: form.customerId, orderReference: form.orderReference || undefined, description: form.description || undefined, estimatedDeliveryDate: form.estimatedDeliveryDate || undefined } },
      {
        onSuccess: () => {
          toast.success("Order created — tracking ID auto-generated");
          setOpen(false);
          setForm({ customerId: "", orderReference: "", description: "", estimatedDeliveryDate: "" });
          onSuccess();
        },
        onError: () => toast.error("Failed to create order"),
      }
    );
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="gap-2"><Plus className="h-4 w-4" /> New Order</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle>New Order</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="mt-2 space-y-4">
          <div className="space-y-2">
            <Label>Customer *</Label>
            <Select value={form.customerId} onValueChange={v => setForm(f => ({ ...f, customerId: v }))}>
              <SelectTrigger><SelectValue placeholder="Select customer..." /></SelectTrigger>
              <SelectContent>
                {customers?.data.map(c => (
                  <SelectItem key={c.id} value={c.id}>{c.fullName} — {c.email}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Order Reference</Label>
              <Input value={form.orderReference} onChange={e => setForm(f => ({ ...f, orderReference: e.target.value }))} placeholder="e.g. REF-001" />
            </div>
            <div className="space-y-2">
              <Label>Est. Delivery Date</Label>
              <Input type="date" value={form.estimatedDeliveryDate} onChange={e => setForm(f => ({ ...f, estimatedDeliveryDate: e.target.value }))} />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Description</Label>
            <Input value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="What's in the shipment?" />
          </div>
          <p className="text-xs text-muted-foreground">A unique tracking ID will be auto-generated for this order.</p>
          <Button type="submit" className="w-full" disabled={createMutation.isPending || !form.customerId}>
            {createMutation.isPending ? "Creating..." : "Create Order"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

interface QuickUpdateSheetProps {
  order: { id: string; trackingId: string; currentStatus: string; customer?: { fullName: string } | null };
  onSuccess: () => void;
}

function QuickUpdateSheet({ order, onSuccess }: QuickUpdateSheetProps) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ status: "", message: "", location: "" });
  const updateMutation = useUpdateOrderStatus();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.status) return;
    updateMutation.mutate(
      { orderId: order.id, data: { status: form.status as any, message: form.message || undefined, location: form.location || undefined } },
      {
        onSuccess: (result) => {
          const emailMsg = result.emailStatus === "sent"
            ? " Email sent to customer."
            : result.emailStatus === "failed"
            ? " Email delivery failed — check Resend key."
            : "";
          toast.success(`Status updated to "${form.status}".${emailMsg}`);
          setOpen(false);
          setForm({ status: "", message: "", location: "" });
          onSuccess();
        },
        onError: () => toast.error("Failed to update status"),
      }
    );
  };

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button
          size="sm"
          variant="secondary"
          className="gap-1.5 h-8 text-xs"
          onClick={e => e.stopPropagation()}
        >
          <Pencil className="h-3 w-3" />
          Update
        </Button>
      </SheetTrigger>
      <SheetContent className="w-[420px]">
        <SheetHeader>
          <SheetTitle>Update Order Status</SheetTitle>
          <div className="space-y-0.5 pt-1">
            <p className="font-mono text-sm font-semibold text-foreground">{order.trackingId}</p>
            {order.customer?.fullName && (
              <p className="text-sm text-muted-foreground">{order.customer.fullName}</p>
            )}
            <div className="pt-1"><StatusBadge status={order.currentStatus} /></div>
          </div>
        </SheetHeader>

        <form onSubmit={handleSubmit} className="mt-6 space-y-5">
          <div className="space-y-2">
            <Label>New Status *</Label>
            {isTerminal(order.currentStatus) ? (
              <p className="text-sm text-muted-foreground border px-3 py-2 bg-muted/40">
                This order is <span className="font-semibold">{order.currentStatus}</span> — no further updates possible.
              </p>
            ) : (
              <Select value={form.status} onValueChange={v => setForm(f => ({ ...f, status: v }))}>
                <SelectTrigger><SelectValue placeholder="Select next status..." /></SelectTrigger>
                <SelectContent>
                  {nextStatuses(order.currentStatus).map(s => (
                    <SelectItem key={s} value={s}>{s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          <div className="space-y-2">
            <Label>
              Message{" "}
              <span className="text-muted-foreground font-normal text-xs">(sent to customer in email)</span>
            </Label>
            <Textarea
              value={form.message}
              onChange={e => setForm(f => ({ ...f, message: e.target.value }))}
              placeholder="e.g. Your parcel has left our Johannesburg warehouse."
              rows={3}
            />
          </div>

          <div className="space-y-2">
            <Label>
              Location{" "}
              <span className="text-muted-foreground font-normal text-xs">(optional)</span>
            </Label>
            <Input
              value={form.location}
              onChange={e => setForm(f => ({ ...f, location: e.target.value }))}
              placeholder="e.g. Johannesburg Hub"
            />
          </div>

          <div className="border-t pt-4 space-y-3">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Mail className="h-3.5 w-3.5" />
              <span>An email will automatically be sent to the customer on save.</span>
            </div>
            <Button type="submit" className="w-full gap-2" disabled={!form.status || updateMutation.isPending}>
              <Mail className="h-4 w-4" />
              {updateMutation.isPending ? "Saving..." : "Save & Send Email"}
            </Button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  );
}

export default function OrdersPage() {
  const [, navigate] = useLocation();
  const [search, setSearch] = useState("");
  const [querySearch, setQuerySearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [page, setPage] = useState(1);

  const { data, isLoading, refetch } = useListOrders({
    search: querySearch || undefined,
    status: statusFilter !== "all" ? statusFilter : undefined,
    page,
    limit: 20,
  });

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setQuerySearch(search);
    setPage(1);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Orders</h1>
          <p className="text-muted-foreground text-sm mt-0.5">{data?.total ?? 0} total orders</p>
        </div>
        <CreateOrderDialog onSuccess={() => refetch()} />
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-col sm:flex-row gap-2">
            <form onSubmit={handleSearch} className="flex gap-2 flex-1">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input className="pl-9" placeholder="Search tracking ID or reference..." value={search} onChange={e => setSearch(e.target.value)} />
              </div>
              <Button type="submit" variant="secondary">Search</Button>
            </form>
            <Select value={statusFilter} onValueChange={v => { setStatusFilter(v); setPage(1); }}>
              <SelectTrigger className="w-[200px]"><SelectValue placeholder="All statuses" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                {ORDER_STATUSES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-6 space-y-3">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
          ) : !data?.data.length ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <Package className="h-12 w-12 text-muted-foreground/30 mb-4" />
              <p className="text-muted-foreground font-medium">No orders found</p>
              <p className="text-muted-foreground/60 text-sm mt-1">Create your first order to get started</p>
            </div>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Tracking ID</TableHead>
                    <TableHead>Customer</TableHead>
                    <TableHead>Reference</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Est. Delivery</TableHead>
                    <TableHead>Updated</TableHead>
                    <TableHead className="text-right pr-4">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.data.map((order) => (
                    <TableRow
                      key={order.id}
                      className="cursor-pointer hover:bg-muted/40 group"
                      onClick={() => navigate(`/orders/${order.id}`)}
                    >
                      <TableCell onClick={e => e.stopPropagation()}>
                        <Link
                          href={`/orders/${order.id}`}
                          className="font-mono text-sm font-semibold text-foreground hover:text-primary transition-colors"
                        >
                          {order.trackingId}
                        </Link>
                      </TableCell>
                      <TableCell className="font-medium">{order.customer?.fullName ?? "—"}</TableCell>
                      <TableCell className="text-muted-foreground">{order.orderReference ?? "—"}</TableCell>
                      <TableCell><StatusBadge status={order.currentStatus} /></TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {order.estimatedDeliveryDate ? format(new Date(order.estimatedDeliveryDate), "MMM d, yyyy") : "—"}
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {format(new Date(order.updatedAt), "MMM d, HH:mm")}
                      </TableCell>
                      <TableCell className="text-right pr-4" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-2">
                          <QuickUpdateSheet order={order} onSuccess={() => refetch()} />
                          <Link href={`/orders/${order.id}`}>
                            <Button size="sm" variant="ghost" className="h-8 w-8 p-0 opacity-0 group-hover:opacity-100 transition-opacity">
                              <ArrowRight className="h-4 w-4" />
                            </Button>
                          </Link>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              {data.total > 20 && (
                <div className="flex items-center justify-between px-6 py-4 border-t">
                  <span className="text-sm text-muted-foreground">Page {page} of {Math.ceil(data.total / 20)}</span>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" disabled={page === 1} onClick={() => setPage(p => p - 1)}>Previous</Button>
                    <Button variant="outline" size="sm" disabled={page >= Math.ceil(data.total / 20)} onClick={() => setPage(p => p + 1)}>Next</Button>
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
