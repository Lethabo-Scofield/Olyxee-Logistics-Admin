import { useState } from "react";
import { Link, useParams } from "wouter";
import { useGetOrder, useUpdateOrderStatus, useResendOrderEmail, useGetEmailNotifications } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusBadge } from "@/components/status-badge";
import { ArrowLeft, Copy, Check, Mail, RefreshCw, MapPin, Clock } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

const ORDER_STATUSES = [
  "Order received", "Processing", "Driver assigned", "In transit",
  "Delayed", "Out for delivery", "Delivered", "Failed delivery", "Cancelled"
];

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <button onClick={copy} className="ml-2 p-1 rounded hover:bg-gray-100 text-gray-500 hover:text-gray-700 transition-colors">
      {copied ? <Check className="h-3.5 w-3.5 text-green-500" /> : <Copy className="h-3.5 w-3.5" />}
    </button>
  );
}

export default function OrderDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { data: order, isLoading, refetch } = useGetOrder(id ?? "");
  const { data: emailNotifs } = useGetEmailNotifications(id ?? "");
  const updateStatusMutation = useUpdateOrderStatus();
  const resendMutation = useResendOrderEmail();

  const [statusForm, setStatusForm] = useState({ status: "", message: "", location: "" });

  const handleStatusUpdate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!statusForm.status) return;
    updateStatusMutation.mutate(
      {
        orderId: id!,
        data: {
          status: statusForm.status as any,
          message: statusForm.message || undefined,
          location: statusForm.location || undefined,
        },
      },
      {
        onSuccess: (result) => {
          const emailMsg = result.emailStatus === "sent" ? " Email sent to customer." : result.emailStatus === "failed" ? " Email delivery failed." : "";
          toast.success(`Status updated to "${statusForm.status}".${emailMsg}`);
          setStatusForm({ status: "", message: "", location: "" });
          refetch();
        },
        onError: () => toast.error("Failed to update status"),
      }
    );
  };

  const handleResend = () => {
    resendMutation.mutate(
      { orderId: id! },
      {
        onSuccess: (result) => {
          if (result.success) toast.success("Email resent successfully");
          else toast.error(`Failed to resend: ${result.message}`);
          refetch();
        },
        onError: () => toast.error("Failed to resend email"),
      }
    );
  };

  if (isLoading) {
    return <div className="space-y-4"><Skeleton className="h-40 w-full" /><Skeleton className="h-64 w-full" /></div>;
  }

  if (!order) {
    return <div className="text-center py-16 text-gray-500">Order not found</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/orders"><Button variant="ghost" size="sm" className="gap-2"><ArrowLeft className="h-4 w-4" /> Orders</Button></Link>
      </div>

      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight font-mono text-gray-900">{order.trackingId}</h1>
            <StatusBadge status={order.currentStatus} />
          </div>
          {order.orderReference && <p className="text-gray-500 mt-1">Ref: {order.orderReference}</p>}
          <p className="text-gray-400 text-sm mt-0.5">Created {format(new Date(order.createdAt), "MMMM d, yyyy 'at' HH:mm")}</p>
        </div>
        <Button variant="outline" size="sm" className="gap-2 self-start" onClick={handleResend} disabled={resendMutation.isPending}>
          <RefreshCw className={`h-4 w-4 ${resendMutation.isPending ? "animate-spin" : ""}`} />
          Resend Email
        </Button>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          {/* Tracking Link */}
          <Card>
            <CardHeader><CardTitle className="text-base">Tracking Link</CardTitle></CardHeader>
            <CardContent>
              <div className="flex items-center bg-gray-50 border border-gray-200 rounded-lg px-4 py-3">
                <span className="text-sm text-blue-600 truncate flex-1 font-mono">{order.trackingLink}</span>
                <CopyButton text={order.trackingLink} />
              </div>
              <p className="text-xs text-gray-400 mt-2">This link will be sent to customers and can be shared publicly for tracking.</p>
            </CardContent>
          </Card>

          {/* Status Update Form */}
          <Card>
            <CardHeader><CardTitle className="text-base">Update Status</CardTitle></CardHeader>
            <CardContent>
              <form onSubmit={handleStatusUpdate} className="space-y-4">
                <div className="space-y-2">
                  <Label>New Status *</Label>
                  <Select value={statusForm.status} onValueChange={v => setStatusForm(f => ({ ...f, status: v }))}>
                    <SelectTrigger><SelectValue placeholder="Select new status..." /></SelectTrigger>
                    <SelectContent>
                      {ORDER_STATUSES.filter(s => s !== order.currentStatus).map(s => (
                        <SelectItem key={s} value={s}>{s}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Message <span className="text-gray-400 font-normal">(sent to customer)</span></Label>
                  <Textarea value={statusForm.message} onChange={e => setStatusForm(f => ({ ...f, message: e.target.value }))} placeholder="Add a note about this status update..." rows={3} />
                </div>
                <div className="space-y-2">
                  <Label>Location <span className="text-gray-400 font-normal">(optional)</span></Label>
                  <Input value={statusForm.location} onChange={e => setStatusForm(f => ({ ...f, location: e.target.value }))} placeholder="e.g. Chicago Distribution Center" />
                </div>
                <Button type="submit" disabled={!statusForm.status || updateStatusMutation.isPending} className="gap-2">
                  <Mail className="h-4 w-4" />
                  {updateStatusMutation.isPending ? "Updating..." : "Update & Send Email"}
                </Button>
              </form>
            </CardContent>
          </Card>

          {/* Delivery Timeline */}
          <Card>
            <CardHeader><CardTitle className="text-base">Delivery Timeline</CardTitle></CardHeader>
            <CardContent>
              {!order.trackingEvents?.length ? (
                <p className="text-sm text-gray-500">No tracking events yet.</p>
              ) : (
                <div className="relative">
                  <div className="absolute left-4 top-0 bottom-0 w-px bg-gray-200" />
                  <div className="space-y-4">
                    {order.trackingEvents.map((event, idx) => (
                      <div key={event.id} className="flex gap-4 relative">
                        <div className={`relative z-10 flex h-8 w-8 items-center justify-center rounded-full border-2 flex-shrink-0 ${idx === 0 ? "border-blue-600 bg-blue-600" : "border-gray-300 bg-white"}`}>
                          <Clock className={`h-3.5 w-3.5 ${idx === 0 ? "text-white" : "text-gray-400"}`} />
                        </div>
                        <div className="pb-4 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <StatusBadge status={event.status} />
                            <span className="text-xs text-gray-400">{format(new Date(event.createdAt), "MMM d, HH:mm")}</span>
                          </div>
                          {event.message && <p className="text-sm text-gray-600 mt-1">{event.message}</p>}
                          {event.location && (
                            <div className="flex items-center gap-1 text-xs text-gray-400 mt-1">
                              <MapPin className="h-3 w-3" />{event.location}
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Email History */}
          <Card>
            <CardHeader><CardTitle className="text-base">Email History</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              {!order.emailNotifications?.length ? (
                <p className="text-sm text-gray-500">No emails sent yet.</p>
              ) : (
                order.emailNotifications.map((notif) => (
                  <div key={notif.id} className="flex items-start justify-between gap-3 p-3 bg-gray-50 rounded-lg border">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-700 truncate">{notif.subject}</p>
                      <p className="text-xs text-gray-500 mt-0.5">To: {notif.customerEmail}</p>
                      <p className="text-xs text-gray-400">{format(new Date(notif.createdAt), "MMM d, HH:mm")}</p>
                    </div>
                    <span className={`text-xs font-medium px-2 py-1 rounded-full flex-shrink-0 ${notif.status === "sent" ? "bg-green-100 text-green-700" : notif.status === "failed" ? "bg-red-100 text-red-700" : "bg-gray-100 text-gray-600"}`}>
                      {notif.status}
                    </span>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right sidebar */}
        <div className="space-y-6">
          {/* Customer Info */}
          {order.customer && (
            <Card>
              <CardHeader><CardTitle className="text-base">Customer</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <Link href={`/customers/${order.customer.id}`} className="font-medium text-blue-600 hover:underline">
                    {order.customer.fullName}
                  </Link>
                  {order.customer.companyName && <p className="text-sm text-gray-500">{order.customer.companyName}</p>}
                </div>
                <p className="text-sm text-gray-600">{order.customer.email}</p>
                {order.customer.phone && <p className="text-sm text-gray-600">{order.customer.phone}</p>}
                {order.customer.address && <p className="text-sm text-gray-500">{order.customer.address}</p>}
              </CardContent>
            </Card>
          )}

          {/* Order Info */}
          <Card>
            <CardHeader><CardTitle className="text-base">Order Details</CardTitle></CardHeader>
            <CardContent className="space-y-3 text-sm">
              {order.description && (
                <div>
                  <p className="text-gray-400 text-xs uppercase font-medium">Description</p>
                  <p className="text-gray-700 mt-1">{order.description}</p>
                </div>
              )}
              {order.estimatedDeliveryDate && (
                <div>
                  <p className="text-gray-400 text-xs uppercase font-medium">Est. Delivery</p>
                  <p className="text-gray-700 mt-1">{format(new Date(order.estimatedDeliveryDate), "MMMM d, yyyy")}</p>
                </div>
              )}
              <div>
                <p className="text-gray-400 text-xs uppercase font-medium">Last Updated</p>
                <p className="text-gray-700 mt-1">{format(new Date(order.updatedAt), "MMM d, yyyy HH:mm")}</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
