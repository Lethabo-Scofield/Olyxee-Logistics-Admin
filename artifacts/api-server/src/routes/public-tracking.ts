import { Router } from "express";
import { db, ordersTable, trackingEventsTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";

const router = Router();

// Map internal status labels (free-form, defined in lib/order-statuses) to the
// stable public enum the FreightShift brief specifies. Anything we don't
// recognize falls back to "pending" so the customer page can still render.
const STATUS_LABEL_MAP: Record<string, string> = {
  "Created": "pending",
  "Order received": "pending",
  // "Processing" isn't in the brief's allowed enum; collapse to "pending"
  // so the customer page (which keys a colour/tone map by status) doesn't
  // crash on an unknown value.
  "Processing": "pending",
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

// Human-friendly label for each public status enum value. Used when the
// event row stores a free-form label we can't map, so we always send back
// something readable for `events[].label` / top-level statusLabel.
const STATUS_DISPLAY: Record<string, string> = {
  pending: "Pending",
  picked_up: "Picked up",
  in_transit: "In transit",
  customs: "Customs",
  out_for_delivery: "Out for delivery",
  delivered: "Delivered",
  delayed: "Delayed",
  failed_delivery: "Failed delivery",
  returned: "Returned",
  cancelled: "Cancelled",
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

    // No business lookup here — the brief explicitly forbids leaking the
    // owning business's name on the public payload.
    const events = await db
      .select()
      .from(trackingEventsTable)
      .where(eq(trackingEventsTable.orderId, order.id))
      // Brief specifies events MUST be newest first.
      .orderBy(desc(trackingEventsTable.createdAt));

    // 30-second cache: matches the brief's "≈ once per page load" polling
    // expectation and keeps the public endpoint cheap under sudden load
    // (e.g. an email blast). Public so CDNs can cache too.
    res.setHeader("Cache-Control", "public, max-age=30");

    const currentStatus = publicStatusFor(order.currentStatus);
    const currentStatusLabel =
      order.currentStatus && order.currentStatus.trim().length > 0
        ? order.currentStatus
        : STATUS_DISPLAY[currentStatus] ?? "Pending";

    // Response shape matches the customer-integration brief exactly
    // (`currentStatus`, `reference`, `events[].at`, `events[].label`, …).
    // Legacy field names (`status`, `orderReference`, `events[].timestamp`,
    // `events[].statusLabel`, `events[].notes`) are kept alongside so any
    // older integrators don't break while migrating. `businessName` is
    // intentionally omitted per the brief — public payloads must not leak
    // the owning business across tenants.
    res.json({
      trackingId: order.trackingId,
      reference: order.orderReference ?? null,
      orderReference: order.orderReference ?? null,
      currentStatus,
      status: currentStatus,
      statusLabel: currentStatusLabel,
      estimatedDeliveryDate: order.estimatedDeliveryDate ?? null,
      lastUpdated: order.updatedAt.toISOString(),
      events: events.map((e) => {
        const status = publicStatusFor(e.status);
        const label =
          e.status && e.status.trim().length > 0
            ? e.status
            : STATUS_DISPLAY[status] ?? status;
        const at = e.createdAt.toISOString();
        return {
          at,
          timestamp: at,
          status,
          label,
          statusLabel: label,
          message: e.message ?? null,
          notes: e.message ?? null,
          location: e.location ?? null,
        };
      }),
    });
  } catch (err) {
    req.log.error({ err }, "Public tracking lookup failed");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;

export { STATUS_LABEL_MAP };
