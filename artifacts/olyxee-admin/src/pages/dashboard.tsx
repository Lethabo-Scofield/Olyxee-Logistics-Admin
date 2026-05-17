import { useEffect, useState, useMemo } from "react";
import { Link } from "wouter";
import {
  useGetDashboardSummary, useGetRecentOrders,
  useGetStatusBreakdown, useListOrders,
} from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusBadge } from "@/components/status-badge";
import {
  Package, Truck, CheckCircle, Mail, AlertTriangle,
  ChevronLeft, ChevronRight, CalendarDays, ArrowRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  format, startOfMonth, endOfMonth, startOfWeek, endOfWeek,
  eachDayOfInterval, isSameMonth, isToday, isSameDay,
  addMonths, subMonths, isBefore, startOfDay,
} from "date-fns";

// ─── Live Clock ───────────────────────────────────────────────────────────────
function LiveClock() {
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  return (
    <div className="text-right select-none">
      <p className="text-3xl font-mono font-bold tabular-nums tracking-tight leading-none">
        {format(now, "HH:mm:ss")}
      </p>
      <p className="text-xs text-muted-foreground mt-1 tracking-wide">
        {format(now, "EEEE, MMMM d, yyyy")}
      </p>
    </div>
  );
}

// ─── Calendar ─────────────────────────────────────────────────────────────────
type OrderSummary = {
  id: string;
  trackingId: string;
  currentStatus: string;
  customer?: { fullName: string } | null;
};

// Group statuses into 4 colored buckets so each calendar cell can show an
// at-a-glance health bar. Keeps the visual vocabulary small enough to read
// in a 40px-wide cell.
type Bucket = "done" | "active" | "warning" | "pending";
function bucket(status: string): Bucket {
  if (status === "Delivered") return "done";
  if (status === "Delayed" || status === "Failed delivery") return "warning";
  if (status === "In transit" || status === "Out for delivery") return "active";
  return "pending"; // Order received, Processing, Cancelled
}
const BUCKET_BG: Record<Bucket, string> = {
  done: "bg-green-500",
  active: "bg-blue-500",
  warning: "bg-amber-500",
  pending: "bg-slate-400",
};
const BUCKET_LABEL: Record<Bucket, string> = {
  done: "Delivered",
  active: "In progress",
  warning: "Needs attention",
  pending: "Scheduled",
};

const DAY_HEADERS = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"];

function CalendarWidget({ ordersByDate }: { ordersByDate: Map<string, OrderSummary[]> }) {
  const [month, setMonth] = useState(() => startOfDay(new Date()));
  const [selectedKey, setSelectedKey] = useState<string>(() => format(new Date(), "yyyy-MM-dd"));
  const today = useMemo(() => startOfDay(new Date()), []);

  const days = useMemo(() => {
    const start = startOfWeek(startOfMonth(month), { weekStartsOn: 1 });
    const end = endOfWeek(endOfMonth(month), { weekStartsOn: 1 });
    return eachDayOfInterval({ start, end });
  }, [month]);

  // Per-cell bucket breakdown — computed once per render.
  const breakdownFor = (key: string) => {
    const orders = ordersByDate.get(key) ?? [];
    const counts: Record<Bucket, number> = { warning: 0, active: 0, pending: 0, done: 0 };
    for (const o of orders) counts[bucket(o.currentStatus)]++;
    return { orders, counts };
  };

  const selected = breakdownFor(selectedKey);
  const selectedDate = useMemo(() => {
    const [y, m, d] = selectedKey.split("-").map(Number);
    return new Date(y, m - 1, d);
  }, [selectedKey]);

  const jumpToToday = () => {
    const t = startOfDay(new Date());
    setMonth(t);
    setSelectedKey(format(t, "yyyy-MM-dd"));
  };

  return (
    <div className="space-y-4">
      {/* Month nav */}
      <div className="flex items-center justify-between gap-2">
        <Button
          variant="ghost" size="sm" className="h-8 w-8 p-0"
          onClick={() => setMonth(m => subMonths(m, 1))}
          aria-label="Previous month"
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1 text-center">
          <p className="text-sm font-semibold">{format(month, "MMMM yyyy")}</p>
        </div>
        <Button
          variant="ghost" size="sm" className="h-8 w-8 p-0"
          onClick={() => setMonth(m => addMonths(m, 1))}
          aria-label="Next month"
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
        <Button
          variant="outline" size="sm" className="h-8 px-2 gap-1 text-xs"
          onClick={jumpToToday}
          disabled={isSameDay(month, today) && selectedKey === format(today, "yyyy-MM-dd")}
        >
          <CalendarDays className="h-3.5 w-3.5" />
          Today
        </Button>
      </div>

      {/* Weekday headers */}
      <div className="grid grid-cols-7 gap-1">
        {DAY_HEADERS.map(d => (
          <div key={d} className="text-center text-[10px] font-semibold text-muted-foreground py-1 uppercase tracking-wider">
            {d}
          </div>
        ))}
      </div>

      {/* Grid */}
      <div className="grid grid-cols-7 gap-1">
        {days.map(day => {
          const key = format(day, "yyyy-MM-dd");
          const { orders, counts } = breakdownFor(key);
          const inMonth = isSameMonth(day, month);
          const isTodayCell = isToday(day);
          const isSelected = selectedKey === key;
          const isPast = isBefore(day, today) && !isTodayCell;
          const total = orders.length;

          // Order matters: warning shows leftmost so it's the first thing
          // your eye lands on.
          const segs: Array<{ b: Bucket; n: number }> = (["warning", "active", "pending", "done"] as Bucket[])
            .map(b => ({ b, n: counts[b] }))
            .filter(s => s.n > 0);

          return (
            <button
              key={key}
              type="button"
              onClick={() => setSelectedKey(key)}
              aria-label={`${format(day, "EEEE, MMMM d")} — ${total} order${total === 1 ? "" : "s"}`}
              aria-pressed={isSelected}
              className={`
                relative flex flex-col items-stretch justify-between p-1.5 min-h-[58px] text-left transition-all
                border
                ${isSelected
                  ? "border-primary ring-1 ring-primary z-10"
                  : "border-transparent hover:border-border"}
                ${isTodayCell ? "bg-primary/5" : ""}
                ${!inMonth ? "opacity-40" : ""}
                ${total === 0 && !isTodayCell ? "hover:bg-muted/40" : ""}
                ${total > 0 && !isTodayCell && !isSelected ? "bg-muted/30 hover:bg-muted/60" : ""}
              `}
            >
              {/* Date + count row */}
              <div className="flex items-start justify-between gap-1">
                <span className={`
                  text-xs font-semibold tabular-nums
                  ${isTodayCell ? "text-primary" : isPast && inMonth ? "text-muted-foreground" : ""}
                `}>
                  {format(day, "d")}
                </span>
                {total > 0 && (
                  <span className={`
                    text-[10px] font-bold tabular-nums leading-none px-1 py-0.5
                    ${counts.warning > 0
                      ? "bg-amber-500 text-white"
                      : "bg-foreground text-background"}
                  `}>
                    {total}
                  </span>
                )}
              </div>

              {/* Status bar — proportional buckets */}
              {total > 0 && (
                <div className="flex h-1 w-full overflow-hidden mt-1">
                  {segs.map(s => (
                    <div
                      key={s.b}
                      className={BUCKET_BG[s.b]}
                      style={{ width: `${(s.n / total) * 100}%` }}
                    />
                  ))}
                </div>
              )}

              {/* Today underline */}
              {isTodayCell && (
                <span className="absolute bottom-0 left-1 right-1 h-0.5 bg-primary" />
              )}
            </button>
          );
        })}
      </div>

      {/* Legend */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 pt-2 border-t">
        {(["warning", "active", "pending", "done"] as Bucket[]).map(b => (
          <div key={b} className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
            <span className={`h-2 w-2 inline-block ${BUCKET_BG[b]}`} />
            {BUCKET_LABEL[b]}
          </div>
        ))}
      </div>

      {/* Selected day — detail panel.
          Clicking a cell pulls everything you need below; works on mobile
          and keyboard-only, unlike the old hover-tooltip. */}
      <div className="border bg-muted/20">
        <div className="flex items-center justify-between gap-2 px-3 py-2 border-b bg-muted/40">
          <div className="min-w-0">
            <p className="text-xs font-semibold truncate">
              {format(selectedDate, "EEEE, MMMM d, yyyy")}
              {isSameDay(selectedDate, today) && (
                <span className="ml-2 text-[10px] font-semibold text-primary uppercase tracking-wider">Today</span>
              )}
            </p>
            <p className="text-[10px] text-muted-foreground">
              {selected.orders.length === 0
                ? "No deliveries scheduled"
                : `${selected.orders.length} order${selected.orders.length === 1 ? "" : "s"} due`}
            </p>
          </div>
          {selected.counts.warning > 0 && (
            <span className="flex items-center gap-1 text-[10px] font-semibold text-amber-700 bg-amber-50 border border-amber-200 px-1.5 py-0.5">
              <AlertTriangle className="h-3 w-3" /> {selected.counts.warning} need{selected.counts.warning === 1 ? "s" : ""} attention
            </span>
          )}
        </div>

        {selected.orders.length === 0 ? (
          <div className="px-3 py-6 text-center">
            <p className="text-xs text-muted-foreground">Nothing scheduled for this day.</p>
          </div>
        ) : (
          <div className="divide-y max-h-[220px] overflow-y-auto">
            {selected.orders.map(o => (
              <Link key={o.id} href={`/orders/${o.id}`}>
                <div className="group flex items-center gap-3 px-3 py-2 hover:bg-muted/60 transition-colors cursor-pointer">
                  <span className={`h-8 w-0.5 flex-shrink-0 ${BUCKET_BG[bucket(o.currentStatus)]}`} />
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-mono font-semibold truncate">{o.trackingId}</p>
                    {o.customer?.fullName && (
                      <p className="text-[10px] text-muted-foreground truncate">{o.customer.fullName}</p>
                    )}
                  </div>
                  <StatusBadge status={o.currentStatus} />
                  <ArrowRight className="h-3.5 w-3.5 text-muted-foreground/40 group-hover:text-foreground transition-colors flex-shrink-0" />
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Dashboard ────────────────────────────────────────────────────────────────
export default function DashboardPage() {
  const { data: summary, isLoading: loadingSummary } = useGetDashboardSummary();
  const { data: recentOrders, isLoading: loadingOrders } = useGetRecentOrders();
  const { data: statusBreakdown, isLoading: loadingBreakdown } = useGetStatusBreakdown();
  const { data: allOrders } = useListOrders({ limit: 300 });

  const ordersByDate = useMemo(() => {
    const map = new Map<string, OrderSummary[]>();
    for (const o of allOrders?.data ?? []) {
      if (!o.estimatedDeliveryDate) continue;
      const key = format(new Date(o.estimatedDeliveryDate), "yyyy-MM-dd");
      const existing = map.get(key) ?? [];
      map.set(key, [...existing, o]);
    }
    return map;
  }, [allOrders]);

  return (
    <div className="space-y-6">
      {/* Header row */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground text-sm mt-0.5">Overview of your logistics operations.</p>
        </div>
        <LiveClock />
      </div>

      {/* KPI cards */}
      {loadingSummary ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-28 w-full" />
          ))}
        </div>
      ) : summary ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total Orders</CardTitle>
              <Package className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{summary.totalOrders}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
              <CardTitle className="text-sm font-medium text-muted-foreground">Active Deliveries</CardTitle>
              <Truck className="h-4 w-4 text-blue-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{summary.activeDeliveries}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
              <CardTitle className="text-sm font-medium text-muted-foreground">Delayed</CardTitle>
              <AlertTriangle className="h-4 w-4 text-yellow-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-yellow-600">{summary.delayedOrders}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
              <CardTitle className="text-sm font-medium text-muted-foreground">Delivered</CardTitle>
              <CheckCircle className="h-4 w-4 text-green-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">{summary.deliveredOrders}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
              <CardTitle className="text-sm font-medium text-muted-foreground">Emails Today</CardTitle>
              <Mail className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{summary.emailsSentToday}</div>
            </CardContent>
          </Card>
        </div>
      ) : null}

      {/* Main row */}
      <div className="grid gap-6 lg:grid-cols-7">
        {/* Recent Orders */}
        <Card className="lg:col-span-4">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Recent Orders</CardTitle>
          </CardHeader>
          <CardContent>
            {loadingOrders ? (
              <div className="space-y-3">
                {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
              </div>
            ) : recentOrders?.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">No recent orders found.</p>
            ) : (
              <div className="space-y-2">
                {recentOrders?.map(order => (
                  <Link key={order.id} href={`/orders/${order.id}`}>
                    <div className="flex items-center justify-between p-3 border hover:bg-muted/40 transition-colors cursor-pointer">
                      <div>
                        <p className="font-mono font-semibold text-sm">{order.trackingId}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {order.customer.fullName} · {format(new Date(order.createdAt), "MMM d, h:mm a")}
                        </p>
                      </div>
                      <StatusBadge status={order.currentStatus} />
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Calendar */}
        <Card className="lg:col-span-3">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Delivery Calendar</CardTitle>
            <p className="text-xs text-muted-foreground">Click any day to see what's due.</p>
          </CardHeader>
          <CardContent>
            <CalendarWidget ordersByDate={ordersByDate} />
          </CardContent>
        </Card>
      </div>

      {/* Status breakdown — horizontal */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Status Breakdown</CardTitle>
        </CardHeader>
        <CardContent>
          {loadingBreakdown ? (
            <div className="flex gap-4">
              {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-10 flex-1" />)}
            </div>
          ) : (
            <div className="flex flex-wrap gap-3">
              {statusBreakdown?.map(item => (
                <div key={item.status} className="flex items-center gap-3 border px-4 py-2.5 flex-1 min-w-[160px]">
                  <StatusBadge status={item.status} />
                  <span className="text-lg font-bold ml-auto">{item.count}</span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
