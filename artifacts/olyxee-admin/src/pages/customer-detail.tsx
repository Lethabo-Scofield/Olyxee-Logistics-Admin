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
    return <div className="space-y-4"><Skeleton className="h-40 w-full" /><Skeleton className="h-64 w-full" /></div>;
  }

  if (!customer) {
    return <div className="text-center py-16 text-gray-500">Customer not found</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/customers">
          <Button variant="ghost" size="sm" className="gap-2"><ArrowLeft className="h-4 w-4" /> Customers</Button>
        </Link>
      </div>

      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-gray-900">{customer.fullName}</h1>
          <p className="text-gray-500 mt-1">Customer since {format(new Date(customer.createdAt), "MMMM d, yyyy")}</p>
        </div>
        <Sheet open={editOpen} onOpenChange={setEditOpen}>
          <SheetTrigger asChild>
            <Button variant="outline" className="gap-2" onClick={openEdit}><Edit className="h-4 w-4" /> Edit</Button>
          </SheetTrigger>
          <SheetContent className="w-[400px]">
            <SheetHeader><SheetTitle>Edit Customer</SheetTitle></SheetHeader>
            <form onSubmit={handleUpdate} className="mt-6 space-y-4">
              <div className="space-y-2"><Label>Full Name *</Label><Input value={form.fullName} onChange={e => setForm(f => ({ ...f, fullName: e.target.value }))} required /></div>
              <div className="space-y-2"><Label>Email *</Label><Input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} required /></div>
              <div className="space-y-2"><Label>Phone</Label><Input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} /></div>
              <div className="space-y-2"><Label>Company</Label><Input value={form.companyName} onChange={e => setForm(f => ({ ...f, companyName: e.target.value }))} /></div>
              <div className="space-y-2"><Label>Address</Label><Input value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} /></div>
              <Button type="submit" className="w-full" disabled={updateMutation.isPending}>{updateMutation.isPending ? "Saving..." : "Save Changes"}</Button>
            </form>
          </SheetContent>
        </Sheet>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="text-base">Contact Information</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center gap-3 text-sm">
              <Mail className="h-4 w-4 text-gray-400 flex-shrink-0" />
              <span className="text-gray-600">{customer.email}</span>
            </div>
            {customer.phone && (
              <div className="flex items-center gap-3 text-sm">
                <Phone className="h-4 w-4 text-gray-400 flex-shrink-0" />
                <span className="text-gray-600">{customer.phone}</span>
              </div>
            )}
            {customer.companyName && (
              <div className="flex items-center gap-3 text-sm">
                <Building className="h-4 w-4 text-gray-400 flex-shrink-0" />
                <span className="text-gray-600">{customer.companyName}</span>
              </div>
            )}
            {customer.address && (
              <div className="flex items-center gap-3 text-sm">
                <MapPin className="h-4 w-4 text-gray-400 flex-shrink-0" />
                <span className="text-gray-600">{customer.address}</span>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Summary</CardTitle></CardHeader>
          <CardContent>
            <div className="flex items-center gap-3 text-sm">
              <Package className="h-4 w-4 text-gray-400" />
              <span className="text-gray-600">{orders?.length ?? 0} total orders</span>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Orders</CardTitle></CardHeader>
        <CardContent className="p-0">
          {ordersLoading ? (
            <div className="p-6 space-y-3">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}</div>
          ) : !orders?.length ? (
            <div className="flex flex-col items-center justify-center py-10 text-center">
              <Package className="h-10 w-10 text-gray-300 mb-3" />
              <p className="text-gray-500 text-sm">No orders yet</p>
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
                  <TableRow key={order.id}>
                    <TableCell>
                      <Link href={`/orders/${order.id}`} className="font-mono text-blue-600 hover:underline text-sm">
                        {order.trackingId}
                      </Link>
                    </TableCell>
                    <TableCell className="text-gray-600">{order.orderReference ?? "—"}</TableCell>
                    <TableCell><StatusBadge status={order.currentStatus} /></TableCell>
                    <TableCell className="text-gray-600 text-sm">{order.estimatedDeliveryDate ? format(new Date(order.estimatedDeliveryDate), "MMM d, yyyy") : "—"}</TableCell>
                    <TableCell className="text-gray-500 text-sm">{format(new Date(order.createdAt), "MMM d, yyyy")}</TableCell>
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
