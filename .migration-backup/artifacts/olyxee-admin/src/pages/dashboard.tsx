import { useEffect, useState, useMemo } from "react";
import { Link } from "wouter";
import {
  useGetDashboardSummary, useGetRecentOrders,
  useGetStatusBreakdown, useListOrders,
} from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusBadge } from "@/components/status-badge";
import { Package, Truck, CheckCircle, Mail, AlertTriangle, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  format, startOfMonth, endOfMonth, startOfWeek, endOfWeek,
  eachDayOfInterval, isSameMonth, isToday, isSameDay,
  addMonths, subMonths,
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

function CalendarWidget({ ordersByDate }: { ordersByDate: Map<string, OrderSummary[]> }) {
  const [month, setMonth] = useState(new Date());

  const days = useMemo(() => {
    const start = startOfWeek(startOfMonth(month), { weekStartsOn: 1 });
    const end = endOfWeek(endOfMonth(month), { weekStartsOn: 1 });
    return eachDayOfInterval({ start, end });
  }, [month]);

  const DAY_HEADERS = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"];

  return (
    <div className="space-y-3">
      {/* Month nav */}
      <div className="flex items-center justify-between">
        <Button
          variant="ghost" size="sm" className="h-7 w-7 p-0"
          onClick={() => setMonth(m => subMonths(m, 1))}
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <span className="text-sm font-semibold">{format(month, "MMMM yyyy")}</span>
        <Button
          variant="ghost" size="sm" className="h-7 w-7 p-0"
          onClick={() => setMonth(m => addMonths(m, 1))}
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-7 gap-0.5">
        {DAY_HEADERS.map(d => (
          <div key={d} className="text-center text-[10px] font-semibold text-muted-foreground py-1 uppercase tracking-wider">
            {d}
          </div>
        ))}

        {days.map(day => {
          const key = format(day, "yyyy-MM-dd");
          const orders = ordersByDate.get(key) ?? [];
          const inMonth = isSameMonth(day, month);
          const today = isToday(day);

          const cell = (
            <div
              className={`
                relative flex flex-col items-center justify-start pt-1.5 pb-1 min-h-[36px] text-xs font-medium transition-colors cursor-default
                ${!inMonth ? "text-muted-foreground/30" : ""}
                ${today ? "bg-primary text-primary-foreground" : inMonth ? "hover:bg-muted/60" : ""}
                ${orders.length > 0 && !today ? "hover:bg-muted" : ""}
              `}
            >
              <span>{format(day, "d")}</span>
              {orders.length > 0 && (
                <span className={`mt-0.5 h-1 w-1 rounded-full ${today ? "bg-primary-foreground/70" : "bg-primary"}`} />
              )}
            </div>
          );

          if (orders.length === 0) return <div key={key}>{cell}</div>;

          return (
            <Tooltip key={key} delayDuration={80}>
              <TooltipTrigger asChild>
                <div className="w-full">{cell}</div>
              </TooltipTrigger>
              <TooltipContent
                side="bottom"
                align="center"
                className="max-w-[220px] p-0 overflow-hidden"
                sideOffset={4}
              >
                <div className="px-3 py-2 border-b bg-muted/40">
                  <p className="text-xs font-semibold">{format(day, "EEEE, MMM d")}</p>
                  <p className="text-[10px] text-muted-foreground">{orders.length} order{orders.length > 1 ? "s" : ""} due</p>
                </div>
                <div className="divide-y max-h-[180px] overflow-y-auto">
                  {orders.map(o => (
                    <Link key={o.id} href={`/orders/${o.id}`}>
                      <div className="px-3 py-2 hover:bg-muted/50 transition-colors cursor-pointer">
                        <p className="text-xs font-mono font-semibold">{o.trackingId}</p>
                        {o.customer?.fullName && (
                          <p className="text-[10px] text-muted-foreground truncate">{o.customer.fullName}</p>
                        )}
                        <div className="mt-1">
                          <StatusBadge status={o.currentStatus} />
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              </TooltipContent>
            </Tooltip>
          );
        })}
      </div>

      {/* Legend */}
      <div className="flex items-center gap-2 pt-1 border-t">
        <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
          <span className="h-1.5 w-1.5 rounded-full bg-primary inline-block" />
          Orders due
        </div>
        <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
          <span className="h-3 w-3 bg-primary inline-block" />
          Today
        </div>
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
            <p className="text-xs text-muted-foreground">Hover a date to see orders due.</p>
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
