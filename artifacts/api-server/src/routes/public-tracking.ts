import { Router } from "express";
import {
  db,
  ordersTable,
  businessesTable,
  trackingEventsTable,
} from "@workspace/db";
import { eq, asc } from "drizzle-orm";

const router = Router();

// Map internal status labels (free-form, defined in lib/order-statuses) to the
// stable public enum the FreightShift brief specifies. Anything we don't
// recognize falls back to "pending" so the customer page can still render.
const STATUS_LABEL_MAP: Record<string, string> = {
  "Created": "pending",
  "Order received": "pending",
  "Processing": "processing",
  "Picked up": "picked_up",
  "In transit": "in_transit",
  "Out for delivery": "out_for_delivery",
  "Delivered": "delivered",
  "Delayed": "delayed",
  "Cancelled": "cancelled",
  "Failed delivery": "failed_delivery",
  "Customs": "customs",
  "Returned": "returned",
};

function publicStatusFor(internal: string | null | undefined): string {
  if (!internal) return "pending";
  return STATUS_LABEL_MAP[internal] ?? "pending";
}

// Public, unauthenticated tracking endpoint. Returns ONLY what a customer
// needs to see their parcel — no customer PII, no business internals, no
// pricing. Mounted before auth and the write-mutation rate limiter in app.ts.
// The cache header lets browsers and our edge proxy de-dupe the polling that
// happens when a customer leaves the tracking page open.
router.get("/public/track/:trackingId", async (req, res) => {
  try {
    const trackingId = String(req.params.trackingId ?? "").trim();
    // Cheap shape guard so we don't burn a query on obvious junk like
    // `/public/track/<script>` from crawlers and probes.
    if (!trackingId || trackingId.length > 40 || !/^[A-Z0-9-]+$/i.test(trackingId)) {
      res.status(404).json({ error: "Not found" });
      return;
    }

    const order = await db.query.ordersTable.findFirst({
      where: eq(ordersTable.trackingId, trackingId.toUpperCase()),
    });
    if (!order) {
      res.status(404).json({ error: "Not found" });
      return;
    }

    const [business, events] = await Promise.all([
      db.query.businessesTable.findFirst({
        where: eq(businessesTable.id, order.businessId),
      }),
      db
        .select()
        .from(trackingEventsTable)
        .where(eq(trackingEventsTable.orderId, order.id))
        .orderBy(asc(trackingEventsTable.createdAt)),
    ]);

    // 30-second cache: matches the brief's "≈ once per page load" polling
    // expectation and keeps the public endpoint cheap under sudden load
    // (e.g. an email blast). Public so CDNs can cache too.
    res.setHeader("Cache-Control", "public, max-age=30");

    res.json({
      trackingId: order.trackingId,
      orderReference: order.orderReference ?? null,
      status: publicStatusFor(order.currentStatus),
      statusLabel: order.currentStatus ?? "Pending",
      estimatedDeliveryDate: order.estimatedDeliveryDate ?? null,
      lastUpdated: order.updatedAt.toISOString(),
      businessName: business?.name ?? "",
      events: events.map((e) => ({
        status: publicStatusFor(e.status),
        statusLabel: e.status,
        location: e.location ?? null,
        // tracking_events stores the free-text update as `message`; expose
        // it on the public payload as `notes` so the customer-facing field
        // name reads naturally on the tracking page.
        notes: e.message ?? null,
        timestamp: e.createdAt.toISOString(),
      })),
    });
  } catch (err) {
    req.log.error({ err }, "Public tracking lookup failed");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;

export { STATUS_LABEL_MAP };
