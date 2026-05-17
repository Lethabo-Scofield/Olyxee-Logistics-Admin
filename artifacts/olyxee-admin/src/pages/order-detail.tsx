import { useState } from "react";
import { Link, useParams } from "wouter";
import { useGetOrder, useUpdateOrderStatus, useResendOrderEmail } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectSeparator, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusBadge } from "@/components/status-badge";
import {
  ArrowLeft, Copy, Check, Mail, RefreshCw, MapPin, ExternalLink,
  ClipboardList, Settings2, UserCheck, Truck, AlertTriangle,
  Navigation, House, PackageX, Ban, Package,
} from "lucide-react";
import { EmptyState } from "@/components/page-loader";
import { toast } from "sonner";
import { format } from "date-fns";
import { statusChoices, isTerminal } from "@/lib/order-statuses";

const STATUS_ICON_CONFIG: Record<string, {
  icon: React.ElementType;
  bg: string;
  border: string;
  iconColor: string;
  label: string;
}> = {
  "Order received":   { icon: ClipboardList, bg: "bg-sky-50",    border: "border-sky-300",   iconColor: "text-sky-600",   label: "Order Received" },
  "Processing":       { icon: Settings2,     bg: "bg-violet-50", border: "border-violet-300", iconColor: "text-violet-600",label: "Processing" },
  "Driver assigned":  { icon: UserCheck,     bg: "bg-indigo-50", border: "border-indigo-300", iconColor: "text-indigo-600",label: "Driver Assigned" },
  "In transit":       { icon: Truck,         bg: "bg-blue-50",   border: "border-blue-300",   iconColor: "text-blue-600",  label: "In Transit" },
  "Delayed":          { icon: AlertTriangle, bg: "bg-amber-50",  border: "border-amber-300",  iconColor: "text-amber-600", label: "Delayed" },
  "Out for delivery": { icon: Navigation,    bg: "bg-orange-50", border: "border-orange-300", iconColor: "text-orange-600",label: "Out for Delivery" },
  "Delivered":        { icon: House,         bg: "bg-green-50",  border: "border-green-400",  iconColor: "text-green-600", label: "Delivered" },
  "Failed delivery":  { icon: PackageX,      bg: "bg-red-50",    border: "border-red-300",    iconColor: "text-red-600",   label: "Failed Delivery" },
  "Cancelled":        { icon: Ban,           bg: "bg-gray-100",  border: "border-gray-300",   iconColor: "text-gray-500",  label: "Cancelled" },
};

function getStatusConfig(status: string) {
  return STATUS_ICON_CONFIG[status] ?? {
    icon: Package,
    bg: "bg-muted",
    border: "border-border",
    iconColor: "text-muted-foreground",
    label: status,
  };
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <button
      onClick={copy}
      className="ml-1 p-1 text-muted-foreground hover:text-foreground transition-colors"
      title="Copy"
    >
      {copied ? <Check className="h-3.5 w-3.5 text-green-600" /> : <Copy className="h-3.5 w-3.5" />}
    </button>
  );
}

export default function OrderDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { data: order, isLoading, refetch } = useGetOrder(id ?? "");
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
          const emailMsg =
            result.emailStatus === "sent"
              ? " Email sent to customer."
              : result.emailStatus === "failed"
              ? " Email delivery failed — check Resend API key."
              : "";
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
          if (result.success) toast.success("Email resent to customer");
          else toast.error(`Failed to resend: ${result.message}`);
          refetch();
        },
        onError: () => toast.error("Failed to resend email"),
      }
    );
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-48 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!order) {
    return (
      <EmptyState
        icon={<PackageX className="h-12 w-12" />}
        title="Order not found"
        description="This order may have been deleted or the tracking link is incorrect."
        action={
          <Link href="/orders">
            <Button variant="outline" size="sm" className="gap-1.5">
              <ArrowLeft className="h-4 w-4" /> Back to orders
            </Button>
          </Link>
        }
      />
    );
  }

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Back + header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-center gap-3">
          <Link href="/orders">
            <Button variant="ghost" size="sm" className="gap-1.5 -ml-2 text-muted-foreground">
              <ArrowLeft className="h-4 w-4" /> Orders
            </Button>
          </Link>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="gap-2 self-start sm:self-auto"
          onClick={handleResend}
          disabled={resendMutation.isPending}
        >
          <RefreshCw className={`h-3.5 w-3.5 ${resendMutation.isPending ? "animate-spin" : ""}`} />
          Resend Email
        </Button>
      </div>

      {/* Order identity bar */}
      <div className="border-b pb-5">
        <div className="flex flex-wrap items-center gap-3 mb-1">
          <h1 className="text-2xl font-bold font-mono tracking-tight">{order.trackingId}</h1>
          <StatusBadge status={order.currentStatus} />
        </div>
        <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
          {order.orderReference && <span>Ref: {order.orderReference}</span>}
          <span>Created {format(new Date(order.createdAt), "MMM d, yyyy 'at' HH:mm")}</span>
          {order.customer && (
            <Link href={`/customers/${order.customer.id}`} className="text-primary hover:underline flex items-center gap-1">
              {order.customer.fullName} <ExternalLink className="h-3 w-3" />
            </Link>
          )}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Left — actions + timeline */}
        <div className="lg:col-span-2 space-y-6">

          {/* ★ UPDATE STATUS — hero card */}
          <Card className="border-2 border-primary/20">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Mail className="h-4 w-4 text-primary" />
                Update Order Status
              </CardTitle>
              <p className="text-xs text-muted-foreground">
                Changing the status saves a tracking event and automatically emails the customer.
              </p>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleStatusUpdate} className="space-y-4">
                <div className="space-y-2">
                  <Label>New Status <span className="text-destructive">*</span></Label>
                  {isTerminal(order.currentStatus) ? (
                    <p className="text-sm text-muted-foreground border px-3 py-2 bg-muted/40">
                      This order is <span className="font-semibold">{order.currentStatus}</span> — no further status changes are possible.
                    </p>
                  ) : (() => {
                    const choices = statusChoices(order.currentStatus);
                    if (!choices) return null;
                    return (
                      <Select
                        value={statusForm.status}
                        onValueChange={v => setStatusForm(f => ({ ...f, status: v }))}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Choose next status..." />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectGroup>
                            <SelectLabel className="text-[10px] uppercase tracking-widest text-muted-foreground">Next step</SelectLabel>
                            <SelectItem value={choices.primary}>
                              <span className="flex items-center gap-2">
                                <span className="text-primary font-bold">→</span> {choices.primary}
                              </span>
                            </SelectItem>
                          </SelectGroup>
                          <SelectSeparator />
                          <SelectGroup>
                            <SelectLabel className="text-[10px] uppercase tracking-widest text-muted-foreground">Exceptions</SelectLabel>
                            {choices.exceptions.map(s => (
                              <SelectItem key={s} value={s}>
                                <span className="flex items-center gap-2">
                                  <span className={s === "Cancelled" ? "text-red-500 font-bold" : "text-amber-500 font-bold"}>
                                    {s === "Cancelled" ? "✕" : "⚠"}
                                  </span>
                                  {s}
                                </span>
                              </SelectItem>
                            ))}
                          </SelectGroup>
                        </SelectContent>
                      </Select>
                    );
                  })()}
                </div>

                <div className="grid sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>
                      Message{" "}
                      <span className="text-muted-foreground font-normal text-xs">(in customer email)</span>
                    </Label>
                    <Textarea
                      value={statusForm.message}
                      onChange={e => setStatusForm(f => ({ ...f, message: e.target.value }))}
                      placeholder="e.g. Your parcel has left our warehouse."
                      rows={3}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>
                      Location{" "}
                      <span className="text-muted-foreground font-normal text-xs">(optional)</span>
                    </Label>
                    <Input
                      value={statusForm.location}
                      onChange={e => setStatusForm(f => ({ ...f, location: e.target.value }))}
                      placeholder="e.g. Johannesburg Hub"
                    />
                  </div>
                </div>

                <Button
                  type="submit"
                  disabled={!statusForm.status || updateStatusMutation.isPending}
                  className="gap-2 w-full sm:w-auto"
                >
                  <Mail className="h-4 w-4" />
                  {updateStatusMutation.isPending ? "Saving..." : "Save & Send Email to Customer"}
                </Button>
              </form>
            </CardContent>
          </Card>

          {/* Tracking timeline */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Delivery Timeline</CardTitle>
            </CardHeader>
            <CardContent>
              {!order.trackingEvents?.length ? (
                <p className="text-sm text-muted-foreground">No tracking events yet.</p>
              ) : (
                <div className="relative pl-12">
                  {/* Vertical line */}
                  <div className="absolute left-5 top-6 bottom-6 w-px bg-border" />

                  <div className="space-y-6">
                    {order.trackingEvents.map((event, idx) => {
                      const cfg = getStatusConfig(event.status);
                      const Icon = cfg.icon;
                      const isLatest = idx === 0;
                      const isDelivered = event.status === "Delivered";

                      return (
                        <div key={event.id} className="relative">
                          {/* Icon bubble */}
                          <div
                            className={`
                              absolute -left-7 flex items-center justify-center border-2 transition-all
                              ${isDelivered ? "h-11 w-11 -left-8" : "h-9 w-9"}
                              ${isLatest ? `${cfg.bg} ${cfg.border}` : "bg-background border-border"}
                            `}
                          >
                            <Icon
                              className={`
                                ${isDelivered ? "h-5 w-5" : "h-4 w-4"}
                                ${isLatest ? cfg.iconColor : "text-muted-foreground/40"}
                              `}
                            />
                          </div>

                          {/* Content */}
                          <div className={`min-w-0 pt-1.5 ${isDelivered && isLatest ? "pl-2" : ""}`}>
                            {/* Delivered special banner */}
                            {isDelivered && isLatest && (
                              <div className="flex items-center gap-2 mb-2 px-3 py-1.5 bg-green-50 border border-green-200 w-fit">
                                <House className="h-3.5 w-3.5 text-green-600" />
                                <span className="text-xs font-semibold text-green-700 tracking-wide uppercase">
                                  Package received by customer
                                </span>
                              </div>
                            )}

                            <div className="flex items-center gap-2 flex-wrap">
                              <span className={`text-sm font-semibold ${isLatest ? "" : "text-muted-foreground"}`}>
                                {cfg.label}
                              </span>
                              <span className="text-xs text-muted-foreground">
                                {format(new Date(event.createdAt), "MMM d, yyyy · HH:mm")}
                              </span>
                              {isLatest && (
                                <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground border px-1.5 py-0.5">
                                  Latest
                                </span>
                              )}
                            </div>

                            {event.message && (
                              <p className="text-sm text-muted-foreground mt-1 leading-relaxed">
                                {event.message}
                              </p>
                            )}
                            {event.location && (
                              <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
                                <MapPin className="h-3 w-3" /> {event.location}
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Email history */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Email History</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {!order.emailNotifications?.length ? (
                <p className="text-sm text-muted-foreground">No emails sent yet.</p>
              ) : (
                order.emailNotifications.map((notif) => (
                  <div
                    key={notif.id}
                    className="flex items-start justify-between gap-3 p-3 border bg-muted/20"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{notif.subject}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">To: {notif.customerEmail}</p>
                      <p className="text-xs text-muted-foreground">
                        {format(new Date(notif.createdAt), "MMM d, yyyy · HH:mm")}
                      </p>
                    </div>
                    <span
                      className={`text-xs font-semibold px-2 py-0.5 flex-shrink-0 border ${
                        notif.status === "sent"
                          ? "text-green-700 border-green-200 bg-green-50"
                          : notif.status === "failed"
                          ? "text-red-700 border-red-200 bg-red-50"
                          : "text-muted-foreground border-border bg-muted"
                      }`}
                    >
                      {notif.status}
                    </span>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right sidebar */}
        <div className="space-y-5">
          {/* Tracking link */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-muted-foreground font-medium uppercase tracking-wider">
                Tracking Link
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center border bg-muted/30 px-3 py-2">
                <span className="text-xs text-primary truncate flex-1 font-mono">{order.trackingLink}</span>
                <CopyButton text={order.trackingLink} />
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                Included in every customer email automatically.
              </p>
            </CardContent>
          </Card>

          {/* Customer */}
          {order.customer && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-muted-foreground font-medium uppercase tracking-wider">
                  Customer
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <Link
                  href={`/customers/${order.customer.id}`}
                  className="font-semibold hover:text-primary transition-colors block"
                >
                  {order.customer.fullName}
                </Link>
                {order.customer.companyName && (
                  <p className="text-muted-foreground">{order.customer.companyName}</p>
                )}
                <p className="text-muted-foreground">{order.customer.email}</p>
                {order.customer.phone && (
                  <p className="text-muted-foreground">{order.customer.phone}</p>
                )}
                {order.customer.address && (
                  <p className="text-muted-foreground text-xs">{order.customer.address}</p>
                )}
              </CardContent>
            </Card>
          )}

          {/* Order details */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-muted-foreground font-medium uppercase tracking-wider">
                Order Details
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              {order.description && (
                <div>
                  <p className="text-xs text-muted-foreground uppercase font-medium mb-0.5">Description</p>
                  <p>{order.description}</p>
                </div>
              )}
              {order.estimatedDeliveryDate && (
                <div>
                  <p className="text-xs text-muted-foreground uppercase font-medium mb-0.5">Est. Delivery</p>
                  <p>{format(new Date(order.estimatedDeliveryDate), "MMMM d, yyyy")}</p>
                </div>
              )}
              <div>
                <p className="text-xs text-muted-foreground uppercase font-medium mb-0.5">Last Updated</p>
                <p>{format(new Date(order.updatedAt), "MMM d, yyyy · HH:mm")}</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
