import { useState } from "react";
import { Link, useParams } from "wouter";
import { useGetOrder, useUpdateOrderStatus, useResendOrderEmail, useGetBusiness } from "@workspace/api-client-react";
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
  House, PackageX, ArrowRight, Sparkles,
} from "lucide-react";
import { EmptyState } from "@/components/page-loader";
import { toast } from "sonner";
import { format } from "date-fns";
import {
  statusChoices, isTerminal, getStatusVisual, suggestedMessages, statusCopy,
} from "@/lib/order-statuses";

const getStatusConfig = getStatusVisual;

// Inline status pill — used in the Step 1 current → new flow + the select.
function StatusChip({ status, subtle = false, inline = false }: {
  status: string;
  subtle?: boolean;
  inline?: boolean;
}) {
  const cfg = getStatusVisual(status);
  const Icon = cfg.icon;
  if (inline) {
    return (
      <span className="flex items-center gap-2 min-w-0">
        <span className={`flex h-5 w-5 items-center justify-center ${cfg.bg} ${cfg.border} border flex-shrink-0`}>
          <Icon className={`h-3 w-3 ${cfg.iconColor}`} />
        </span>
        <span className="text-sm truncate">{cfg.label}</span>
      </span>
    );
  }
  return (
    <div className={`flex items-center gap-2 px-3 py-2 border ${
      subtle ? "bg-muted/30 border-border" : `${cfg.bg} ${cfg.border}`
    }`}>
      <span className={`flex h-6 w-6 items-center justify-center ${
        subtle ? "bg-background border" : `${cfg.bg} ${cfg.border} border`
      } flex-shrink-0`}>
        <Icon className={`h-3.5 w-3.5 ${subtle ? "text-muted-foreground" : cfg.iconColor}`} />
      </span>
      <div className="min-w-0">
        <p className="text-[9px] uppercase tracking-wider text-muted-foreground leading-none mb-0.5">
          {subtle ? "From" : "To"}
        </p>
        <p className={`text-xs font-semibold leading-none truncate ${subtle ? "text-muted-foreground" : ""}`}>
          {cfg.label}
        </p>
      </div>
    </div>
  );
}

// Substitute {name}/{businessName} placeholders the same way the server
// template does (see artifacts/api-server/src/lib/email.ts) so the preview
// stays honest.
function renderGreetingPreview(template: string | null | undefined, name: string): string {
  const t = (template ?? "").trim() || "Hi {name},";
  return t.replace(/\{name\}/gi, name);
}
function renderSignaturePreview(template: string | null | undefined, businessName: string): string {
  // Mirror the server helper exactly (artifacts/api-server/src/lib/email.ts):
  // default template is "— {businessName}", and {businessName} is replaced with
  // the literal value (no fallback string) so admin preview never drifts from
  // what's actually sent.
  const t = (template ?? "").trim() || "— {businessName}";
  return t.replace(/\{businessName\}/gi, businessName);
}

function EmailPreview({
  customerName, customerEmail, status, message, trackingId,
  greetingTemplate, signatureTemplate, footerNote, businessName,
}: {
  customerName: string;
  customerEmail: string;
  status: string;
  message: string;
  trackingId: string;
  greetingTemplate: string | null | undefined;
  signatureTemplate: string | null | undefined;
  footerNote: string | null | undefined;
  businessName: string;
}) {
  const cfg = getStatusVisual(status);
  const copy = statusCopy(status);
  const greeting = renderGreetingPreview(greetingTemplate, customerName || "Customer");
  const signature = renderSignaturePreview(signatureTemplate, businessName);

  return (
    <div className="border bg-muted/20">
      {/* Email header bar (fake inbox row) */}
      <div className="px-3 py-2 border-b bg-background flex items-center gap-2 text-[11px] text-muted-foreground">
        <Mail className="h-3 w-3" />
        <span className="truncate">To: <span className="font-medium text-foreground">{customerEmail || "—"}</span></span>
        <span className="ml-auto font-medium text-foreground/70">Preview</span>
      </div>
      {/* Email body preview */}
      <div className="p-4 bg-white text-black">
        <p className="text-[10px] uppercase tracking-widest text-zinc-500 font-semibold mb-2">
          {cfg.label.toUpperCase()}
        </p>
        <h3 className="text-base font-bold leading-tight mb-1">{copy.headline}</h3>
        <p className="text-xs text-zinc-800 leading-relaxed mb-1">{greeting}</p>
        <p className="text-xs text-zinc-600 leading-relaxed">{copy.intro}</p>
        {message.trim() && (
          <div className="mt-3 pl-3 border-l-2 bg-zinc-50 py-2 pr-2" style={{ borderColor: "#a1a1aa" }}>
            <p className="text-[9px] uppercase tracking-wider text-zinc-500 font-semibold mb-0.5">
              A note from our team
            </p>
            <p className="text-xs text-zinc-800 whitespace-pre-wrap">{message.trim()}</p>
          </div>
        )}
        <div className="mt-3 flex items-center justify-between gap-2 pt-3 border-t border-zinc-100">
          <div className="min-w-0">
            <p className="text-[9px] uppercase tracking-wider text-zinc-500 font-semibold leading-none">Tracking</p>
            <p className="text-[11px] font-mono font-semibold truncate">{trackingId}</p>
          </div>
          <span className="text-[10px] px-2 py-1 bg-zinc-900 text-white font-semibold flex-shrink-0">
            Track your order →
          </span>
        </div>
        <p className="mt-3 text-xs text-zinc-800 whitespace-pre-wrap leading-relaxed">{signature}</p>
        {footerNote?.trim() && (
          <p className="mt-2 text-[11px] text-zinc-500 whitespace-pre-wrap leading-relaxed border-t border-zinc-100 pt-2">
            {footerNote.trim()}
          </p>
        )}
      </div>
    </div>
  );
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
      type="button"
      onClick={copy}
      className="ml-1 p-1 text-muted-foreground hover:text-foreground transition-colors"
      title={copied ? "Copied" : "Copy"}
      aria-label={copied ? "Copied to clipboard" : "Copy to clipboard"}
    >
      {copied ? <Check className="h-3.5 w-3.5 text-green-600" /> : <Copy className="h-3.5 w-3.5" />}
    </button>
  );
}

export default function OrderDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { data: order, isLoading, refetch } = useGetOrder(id ?? "");
  const { data: business } = useGetBusiness();
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
              <CardTitle className="text-base">Update Order Status</CardTitle>
              <p className="text-xs text-muted-foreground mt-1">
                Pick the next status. We'll log the change and email{" "}
                <span className="font-medium text-foreground">{order.customer?.fullName ?? "the customer"}</span> automatically.
              </p>
            </CardHeader>
            <CardContent>
              {isTerminal(order.currentStatus) ? (
                <div className="border bg-muted/40 px-4 py-6 text-center">
                  <p className="text-sm">
                    This order is <span className="font-semibold">{order.currentStatus}</span>.
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    No further status changes are possible.
                  </p>
                </div>
              ) : (
                <form onSubmit={handleStatusUpdate} className="space-y-5">
                  {/* Step 1: pick the next status — visual current → new */}
                  <div className="space-y-2">
                    <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Step 1 · Choose the next status
                    </Label>

                    <div className="flex items-stretch gap-2">
                      {/* Current */}
                      <StatusChip status={order.currentStatus} subtle />
                      <div className="flex items-center text-muted-foreground/50">
                        <ArrowRight className="h-4 w-4" />
                      </div>
                      {/* New */}
                      <div className="flex-1 min-w-0">
                        {(() => {
                          const choices = statusChoices(order.currentStatus);
                          if (!choices) return null;
                          return (
                            <Select
                              value={statusForm.status}
                              onValueChange={v => setStatusForm(f => ({ ...f, status: v, message: "" }))}
                            >
                              <SelectTrigger className="h-auto py-2">
                                {statusForm.status
                                  ? <StatusChip status={statusForm.status} inline />
                                  : <span className="text-muted-foreground text-sm">Pick the new status...</span>}
                              </SelectTrigger>
                              <SelectContent>
                                <SelectGroup>
                                  <SelectLabel className="text-[10px] uppercase tracking-widest text-muted-foreground">Next step (recommended)</SelectLabel>
                                  <SelectItem value={choices.primary}>
                                    <StatusChip status={choices.primary} inline />
                                  </SelectItem>
                                </SelectGroup>
                                <SelectSeparator />
                                <SelectGroup>
                                  <SelectLabel className="text-[10px] uppercase tracking-widest text-muted-foreground">Exceptions</SelectLabel>
                                  {choices.exceptions.map(s => (
                                    <SelectItem key={s} value={s}>
                                      <StatusChip status={s} inline />
                                    </SelectItem>
                                  ))}
                                </SelectGroup>
                              </SelectContent>
                            </Select>
                          );
                        })()}
                      </div>
                    </div>
                  </div>

                  {/* Step 2: optional note + location */}
                  <div className="space-y-3">
                    <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Step 2 · Add a note <span className="font-normal normal-case text-muted-foreground/70">(optional, shown in the email)</span>
                    </Label>

                    <Textarea
                      value={statusForm.message}
                      onChange={e => setStatusForm(f => ({ ...f, message: e.target.value }))}
                      placeholder="Write a short note to the customer..."
                      rows={2}
                    />

                    {/* Suggested message chips */}
                    {statusForm.status && suggestedMessages(statusForm.status).length > 0 && (
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="text-[11px] text-muted-foreground inline-flex items-center gap-1">
                          <Sparkles className="h-3 w-3" /> Suggested:
                        </span>
                        {suggestedMessages(statusForm.status).map((msg, i) => (
                          <button
                            key={i}
                            type="button"
                            onClick={() => setStatusForm(f => ({ ...f, message: msg }))}
                            className="text-[11px] px-2 py-1 border border-border bg-muted/40 hover:bg-muted text-foreground/80 hover:text-foreground transition-colors text-left max-w-full truncate"
                            title={msg}
                          >
                            {msg.length > 50 ? msg.slice(0, 50) + "…" : msg}
                          </button>
                        ))}
                      </div>
                    )}

                    <div className="space-y-1.5">
                      <Label className="text-xs font-normal text-muted-foreground">
                        Location <span className="text-muted-foreground/70">(optional, shown in timeline only)</span>
                      </Label>
                      <Input
                        value={statusForm.location}
                        onChange={e => setStatusForm(f => ({ ...f, location: e.target.value }))}
                        placeholder="e.g. Johannesburg Hub"
                      />
                    </div>
                  </div>

                  {/* Step 3: email preview */}
                  {statusForm.status && (
                    <div className="space-y-2">
                      <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                        Step 3 · What the customer will receive
                      </Label>
                      <EmailPreview
                        customerName={order.customer?.fullName ?? "Customer"}
                        customerEmail={order.customer?.email ?? ""}
                        status={statusForm.status}
                        message={statusForm.message}
                        trackingId={order.trackingId}
                        greetingTemplate={business?.emailGreeting}
                        signatureTemplate={business?.emailSignature}
                        footerNote={business?.emailFooterNote}
                        businessName={business?.name ?? ""}
                      />
                    </div>
                  )}

                  <Button
                    type="submit"
                    disabled={!statusForm.status || updateStatusMutation.isPending}
                    className="gap-2 w-full"
                    size="lg"
                  >
                    <Mail className="h-4 w-4" />
                    {updateStatusMutation.isPending
                      ? "Saving & sending..."
                      : statusForm.status
                      ? `Save & email ${order.customer?.fullName?.split(" ")[0] ?? "customer"}`
                      : "Save & send email"}
                  </Button>
                </form>
              )}
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
                // Clean two-column layout: fixed icon rail (40px) + content.
                // The vertical connector lives inside the icon column and is
                // drawn between rows (not under the bubble), so nothing
                // overlaps and every bubble sits centered on the line.
                <ol className="space-y-0">
                  {order.trackingEvents.map((event, idx) => {
                    const cfg = getStatusConfig(event.status);
                    const Icon = cfg.icon;
                    const isLatest = idx === 0;
                    const isLast = idx === order.trackingEvents!.length - 1;
                    const isDelivered = event.status === "Delivered";

                    return (
                      <li key={event.id} className="flex gap-4">
                        {/* Icon rail — fixed width keeps every row aligned. */}
                        <div className="flex flex-col items-center w-10 flex-shrink-0">
                          <div
                            className={`h-9 w-9 flex items-center justify-center border-2 ${
                              isLatest
                                ? `${cfg.bg} ${cfg.border}`
                                : "bg-background border-border"
                            }`}
                          >
                            <Icon
                              className={`h-4 w-4 ${
                                isLatest ? cfg.iconColor : "text-muted-foreground/50"
                              }`}
                            />
                          </div>
                          {/* Connector line — only between rows, never below
                              the last one, so the rail doesn't dangle. */}
                          {!isLast && <div className="w-px flex-1 bg-border min-h-[1.5rem]" />}
                        </div>

                        {/* Content — bottom padding only when more rows follow. */}
                        <div className={`min-w-0 flex-1 pt-1 ${isLast ? "" : "pb-6"}`}>
                          <div className="flex items-center gap-2 flex-wrap">
                            <span
                              className={`text-sm font-semibold ${
                                isLatest ? "" : "text-muted-foreground"
                              }`}
                            >
                              {cfg.label}
                            </span>
                            {isLatest && (
                              <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground border px-1.5 py-0.5">
                                Latest
                              </span>
                            )}
                            <span className="text-xs text-muted-foreground ml-auto">
                              {format(new Date(event.createdAt), "MMM d, yyyy · HH:mm")}
                            </span>
                          </div>

                          {/* Delivered confirmation chip — inline, no longer
                              overlaps the icon column. */}
                          {isDelivered && isLatest && (
                            <div className="mt-2 inline-flex items-center gap-2 px-2.5 py-1 bg-green-50 border border-green-200 w-fit">
                              <House className="h-3.5 w-3.5 text-green-600" />
                              <span className="text-[11px] font-semibold text-green-700 tracking-wide uppercase">
                                Package received by customer
                              </span>
                            </div>
                          )}

                          {event.message && (
                            <p className="text-sm text-muted-foreground mt-1.5 leading-relaxed">
                              {event.message}
                            </p>
                          )}
                          {event.location && (
                            <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1.5">
                              <MapPin className="h-3 w-3" /> {event.location}
                            </div>
                          )}
                        </div>
                      </li>
                    );
                  })}
                </ol>
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
