import { useState } from "react";
import { Link, useParams } from "wouter";
import { useGetCustomer, useGetCustomerOrders, useUpdateCustomer } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { StatusBadge } from "@/components/status-badge";
import { ArrowLeft, Edit, Package, Mail, Phone, Building, MapPin } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

const AVATAR = `${import.meta.env.BASE_URL}avatar-placeholder.png`;

export default function CustomerDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { data: customer, isLoading, refetch } = useGetCustomer(id ?? "");
  const { data: orders, isLoading: ordersLoading } = useGetCustomerOrders(id ?? "");
  const updateMutation = useUpdateCustomer();
  const [editOpen, setEditOpen] = useState(false);
  const [form, setForm] = useState({ fullName: "", email: "", phone: "", companyName: "", address: "" });

  const openEdit = () => {
    if (customer) {
      setForm({ fullName: customer.fullName, email: customer.email, phone: customer.phone ?? "", companyName: customer.companyName ?? "", address: customer.address ?? "" });
      setEditOpen(true);
    }
  };

  const handleUpdate = (e: React.FormEvent) => {
    e.preventDefault();
    updateMutation.mutate(
      { customerId: id!, data: { fullName: form.fullName, email: form.email, phone: form.phone || undefined, companyName: form.companyName || undefined, address: form.address || undefined } },
      {
        onSuccess: () => { toast.success("Customer updated"); setEditOpen(false); refetch(); },
        onError: () => toast.error("Failed to update customer"),
      }
    );
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-40" />
        <div className="flex items-center gap-5">
          <Skeleton className="h-20 w-20 flex-shrink-0" />
          <div className="space-y-2 flex-1">
            <Skeleton className="h-7 w-48" />
            <Skeleton className="h-4 w-32" />
          </div>
        </div>
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!customer) {
    return <div className="text-center py-16 text-muted-foreground">Customer not found</div>;
  }

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Back */}
      <Link href="/customers">
        <Button variant="ghost" size="sm" className="gap-2 -ml-2 text-muted-foreground">
          <ArrowLeft className="h-4 w-4" /> Customers
        </Button>
      </Link>

      {/* Header */}
      <div className="flex items-start gap-5 justify-between">
        <div className="flex items-center gap-5">
          {/* Avatar */}
          <div className="h-20 w-20 flex-shrink-0 border bg-muted overflow-hidden">
            <img src={AVATAR} alt={customer.fullName} className="h-full w-full object-cover opacity-60" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">{customer.fullName}</h1>
            {customer.companyName && (
              <p className="text-muted-foreground text-sm mt-0.5">{customer.companyName}</p>
            )}
            <p className="text-muted-foreground text-xs mt-1">
              Customer since {format(new Date(customer.createdAt), "MMMM d, yyyy")}
            </p>
          </div>
        </div>

        <Sheet open={editOpen} onOpenChange={setEditOpen}>
          <SheetTrigger asChild>
            <Button variant="outline" className="gap-2 flex-shrink-0" onClick={openEdit}>
              <Edit className="h-4 w-4" /> Edit
            </Button>
          </SheetTrigger>
          <SheetContent className="w-[400px]">
            <SheetHeader><SheetTitle>Edit Customer</SheetTitle></SheetHeader>
            <form onSubmit={handleUpdate} className="mt-6 space-y-4">
              <div className="space-y-2"><Label>Full Name *</Label><Input value={form.fullName} onChange={e => setForm(f => ({ ...f, fullName: e.target.value }))} required /></div>
              <div className="space-y-2"><Label>Email *</Label><Input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} required /></div>
              <div className="space-y-2"><Label>Phone</Label><Input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} /></div>
              <div className="space-y-2"><Label>Company</Label><Input value={form.companyName} onChange={e => setForm(f => ({ ...f, companyName: e.target.value }))} /></div>
              <div className="space-y-2"><Label>Address</Label><Input value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} /></div>
              <Button type="submit" className="w-full" disabled={updateMutation.isPending}>
                {updateMutation.isPending ? "Saving..." : "Save Changes"}
              </Button>
            </form>
          </SheetContent>
        </Sheet>
      </div>

      {/* Info cards */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground font-medium uppercase tracking-wider">Contact</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center gap-3 text-sm">
              <Mail className="h-4 w-4 text-muted-foreground flex-shrink-0" />
              <span>{customer.email}</span>
            </div>
            {customer.phone && (
              <div className="flex items-center gap-3 text-sm">
                <Phone className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                <span>{customer.phone}</span>
              </div>
            )}
            {customer.companyName && (
              <div className="flex items-center gap-3 text-sm">
                <Building className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                <span>{customer.companyName}</span>
              </div>
            )}
            {customer.address && (
              <div className="flex items-center gap-3 text-sm">
                <MapPin className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                <span className="text-muted-foreground">{customer.address}</span>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground font-medium uppercase tracking-wider">Summary</CardTitle>
          </CardHeader>
          <CardContent className="flex items-center gap-3 text-sm pt-1">
            <Package className="h-4 w-4 text-muted-foreground" />
            <span className="text-2xl font-bold">{orders?.length ?? 0}</span>
            <span className="text-muted-foreground">total orders</span>
          </CardContent>
        </Card>
      </div>

      {/* Orders table */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Orders</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {ordersLoading ? (
            <div className="p-6 space-y-3">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}</div>
          ) : !orders?.length ? (
            <div className="flex flex-col items-center justify-center py-10 text-center">
              <Package className="h-10 w-10 text-muted-foreground/20 mb-3" />
              <p className="text-muted-foreground text-sm">No orders yet</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tracking ID</TableHead>
                  <TableHead>Reference</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Est. Delivery</TableHead>
                  <TableHead>Created</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {orders.map((order) => (
                  <TableRow key={order.id} className="cursor-pointer hover:bg-muted/40">
                    <TableCell>
                      <Link href={`/orders/${order.id}`} className="font-mono font-semibold text-sm hover:text-primary transition-colors">
                        {order.trackingId}
                      </Link>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{order.orderReference ?? "—"}</TableCell>
                    <TableCell><StatusBadge status={order.currentStatus} /></TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {order.estimatedDeliveryDate ? format(new Date(order.estimatedDeliveryDate), "MMM d, yyyy") : "—"}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {format(new Date(order.createdAt), "MMM d, yyyy")}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
