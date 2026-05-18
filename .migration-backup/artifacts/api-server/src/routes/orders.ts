import { Router } from "express";
import {
  db,
  ordersTable,
  customersTable,
  trackingEventsTable,
  emailNotificationsTable,
  auditLogsTable,
  businessesTable,
} from "@workspace/db";
import { eq, and, ilike, or, desc, sql } from "drizzle-orm";
import { requireAuth } from "../lib/auth";
import { generateId, generateTrackingId } from "../lib/id";
import { sendStatusEmail, buildEmailBody } from "../lib/email";
import {
  CreateOrderBody,
  UpdateOrderStatusBody,
} from "@workspace/api-zod";
import { z } from "zod";
import {
  FSM_ORDER_STATUSES,
  transitionOrder,
  findStuckOrders,
  ConcurrentTransitionError,
  type OrderFsmStatus,
} from "../lib/order-fsm";

const router = Router();

function buildTrackingLink(websiteUrl: string, trackingId: string): string {
  const base = websiteUrl.replace(/\/$/, "");
  return `${base}/track?code=${trackingId}`;
}

function serializeOrder(o: typeof ordersTable.$inferSelect) {
  return {
    ...o,
    createdAt: o.createdAt.toISOString(),
    updatedAt: o.updatedAt.toISOString(),
  };
}

function serializeCustomer(c: typeof customersTable.$inferSelect) {
  return { ...c, createdAt: c.createdAt.toISOString() };
}

router.get("/orders", requireAuth, async (req, res) => {
  try {
    const businessId = (req as any).businessId;
    const search = req.query.search as string | undefined;
    const status = req.query.status as string | undefined;
    const customerId = req.query.customerId as string | undefined;
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 20));
    const offset = (page - 1) * limit;

    const whereConditions: any[] = [eq(ordersTable.businessId, businessId)];
    if (status) whereConditions.push(eq(ordersTable.currentStatus, status));
    if (customerId) whereConditions.push(eq(ordersTable.customerId, customerId));
    if (search) {
      whereConditions.push(
        or(
          ilike(ordersTable.trackingId, `%${search}%`),
          ilike(ordersTable.orderReference, `%${search}%`),
        ),
      );
    }

    const [rows, countResult] = await Promise.all([
      db
        .select()
        .from(ordersTable)
        .leftJoin(
          customersTable,
          and(
            eq(ordersTable.customerId, customersTable.id),
            eq(customersTable.businessId, businessId),
          ),
        )
        .where(and(...whereConditions))
        .orderBy(desc(ordersTable.updatedAt))
        .limit(limit)
        .offset(offset),
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(ordersTable)
        .where(and(...whereConditions)),
    ]);

    const data = rows.map(({ orders: o, customers: c }) => ({
      id: o.id,
      trackingId: o.trackingId,
      orderReference: o.orderReference,
      currentStatus: o.currentStatus,
      estimatedDeliveryDate: o.estimatedDeliveryDate,
      createdAt: o.createdAt.toISOString(),
      updatedAt: o.updatedAt.toISOString(),
      customer: c ? serializeCustomer(c) : null,
    }));

    res.json({ data, total: countResult[0]?.count ?? 0, page, limit });
  } catch (err) {
    req.log.error({ err }, "Failed to list orders");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/orders", requireAuth, async (req, res) => {
  try {
    const businessId = (req as any).businessId;
    const userId = (req as any).userId;
    const parse = CreateOrderBody.safeParse(req.body);
    if (!parse.success) {
      res.status(400).json({ error: "Invalid input", details: parse.error.issues });
      return;
    }

    // Verify customer belongs to business
    const customer = await db.query.customersTable.findFirst({
      where: and(
        eq(customersTable.id, parse.data.customerId),
        eq(customersTable.businessId, businessId),
      ),
    });
    if (!customer) {
      res.status(400).json({ error: "Customer not found" });
      return;
    }

    const business = await db.query.businessesTable.findFirst({
      where: eq(businessesTable.id, businessId),
    });

    // Generate unique tracking ID
    let trackingId: string;
    let attempts = 0;
    do {
      trackingId = generateTrackingId(business?.slug ?? "OLY");
      const existing = await db.query.ordersTable.findFirst({
        where: eq(ordersTable.trackingId, trackingId),
      });
      if (!existing) break;
      attempts++;
    } while (attempts < 10);

    const order = await db
      .insert(ordersTable)
      .values({
        id: generateId(),
        businessId,
        customerId: parse.data.customerId,
        trackingId: trackingId!,
        orderReference: parse.data.orderReference ?? null,
        description: parse.data.description ?? null,
        currentStatus: "Created",
        estimatedDeliveryDate: parse.data.estimatedDeliveryDate ?? null,
      })
      .returning();

    const o = order[0];

    // Create initial tracking event — the order enters the FSM at "Created".
    await db.insert(trackingEventsTable).values({
      id: generateId(),
      orderId: o.id,
      status: "Created",
      message: "Order has been created",
      createdBy: userId,
    });

    // Audit log
    await db.insert(auditLogsTable).values({
      id: generateId(),
      businessId,
      userId,
      action: "CREATE_ORDER",
      entityType: "order",
      entityId: o.id,
      metadata: { trackingId: o.trackingId },
    });

    res.status(201).json(serializeOrder(o));
  } catch (err) {
    req.log.error({ err }, "Failed to create order");
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /orders/stuck — must be declared BEFORE /orders/:orderId so Express
// doesn't treat "stuck" as an order ID param. Returns orders whose dwell
// time in a watched lifecycle state exceeds the configured threshold.
router.get("/orders/stuck", requireAuth, async (req, res) => {
  try {
    const businessId = (req as any).businessId;
    const stuck = await findStuckOrders(businessId);
    res.json({ data: stuck, total: stuck.length });
  } catch (err) {
    req.log.error({ err }, "Failed to list stuck orders");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/orders/:orderId", requireAuth, async (req, res) => {
  try {
    const businessId = (req as any).businessId;
    const orderId = req.params.orderId as string;

    const order = await db.query.ordersTable.findFirst({
      where: and(eq(ordersTable.id, orderId), eq(ordersTable.businessId, businessId)),
    });

    if (!order) {
      res.status(404).json({ error: "Order not found" });
      return;
    }

    const [customer, business, trackingEvents, emailNotifications] = await Promise.all([
      db.query.customersTable.findFirst({
        where: and(
          eq(customersTable.id, order.customerId),
          eq(customersTable.businessId, businessId),
        ),
      }),
      db.query.businessesTable.findFirst({ where: eq(businessesTable.id, businessId) }),
      db
        .select()
        .from(trackingEventsTable)
        .where(eq(trackingEventsTable.orderId, orderId))
        .orderBy(desc(trackingEventsTable.createdAt)),
      db
        .select()
        .from(emailNotificationsTable)
        .where(eq(emailNotificationsTable.orderId, orderId))
        .orderBy(desc(emailNotificationsTable.createdAt)),
    ]);

    const trackingLink = business
      ? buildTrackingLink(business.websiteUrl, order.trackingId)
      : "";

    res.json({
      ...serializeOrder(order),
      trackingLink,
      customer: customer ? serializeCustomer(customer) : null,
      trackingEvents: trackingEvents.map((e) => ({
        ...e,
        createdAt: e.createdAt.toISOString(),
      })),
      emailNotifications: emailNotifications.map((e) => ({
        ...e,
        createdAt: e.createdAt.toISOString(),
      })),
    });
  } catch (err) {
    req.log.error({ err }, "Failed to get order");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/orders/:orderId/status", requireAuth, async (req, res) => {
  try {
    const businessId = (req as any).businessId;
    const userId = (req as any).userId;
    const orderId = req.params.orderId as string;
    const parse = UpdateOrderStatusBody.safeParse(req.body);
    if (!parse.success) {
      res.status(400).json({ error: "Invalid input", details: parse.error.issues });
      return;
    }

    const { status, message, location } = parse.data;

    const order = await db.query.ordersTable.findFirst({
      where: and(eq(ordersTable.id, orderId), eq(ordersTable.businessId, businessId)),
    });
    if (!order) {
      res.status(404).json({ error: "Order not found" });
      return;
    }

    const [customer, business] = await Promise.all([
      db.query.customersTable.findFirst({
        where: and(
          eq(customersTable.id, order.customerId),
          eq(customersTable.businessId, businessId),
        ),
      }),
      db.query.businessesTable.findFirst({ where: eq(businessesTable.id, businessId) }),
    ]);

    // Wrap the DB writes (tracking event + order update) in a transaction so a
    // partial failure can't leave the order with a bumped tracking event but
    // an out-of-date currentStatus. Email send + email_notifications write are
    // intentionally OUTSIDE the transaction so a slow SMTP call never holds a
    // DB transaction open.
    const { trackingEvent: tev, updatedOrder } = await db.transaction(async (tx) => {
      const trackingEvent = await tx
        .insert(trackingEventsTable)
        .values({
          id: generateId(),
          orderId,
          status,
          message: message ?? null,
          location: location ?? null,
          createdBy: userId,
        })
        .returning();

      const updatedOrder = await tx
        .update(ordersTable)
        .set({ currentStatus: status, updatedAt: new Date() })
        .where(
          and(eq(ordersTable.id, orderId), eq(ordersTable.businessId, businessId)),
        )
        .returning();

      // Belt-and-braces: if the update affected 0 rows (the order was deleted
      // or its business_id changed between the read above and this write),
      // throw to roll back the tracking event so we never end up with an
      // orphan event for a status that didn't actually take effect.
      if (!updatedOrder[0]) {
        throw new Error("Order disappeared mid-update");
      }

      return { trackingEvent, updatedOrder };
    });

    const trackingEvent = tev;

    // 3. Build tracking link
    const trackingLink = business
      ? buildTrackingLink(business.websiteUrl, order.trackingId)
      : "";

    // 4. Send email
    let emailStatus: "sent" | "failed" | "skipped" = "skipped";
    let emailNotificationId: string | undefined;

    if (customer && business) {
      const emailParams = {
        customerEmail: customer.email,
        customerName: customer.fullName,
        trackingId: order.trackingId,
        status,
        statusMessage: message ?? null,
        trackingLink,
        businessName: business.name,
        supportEmail: business.supportEmail,
        emailGreeting: business.emailGreeting,
        emailSignature: business.emailSignature,
        emailFooterNote: business.emailFooterNote,
      };

      const { subject, body } = buildEmailBody(emailParams);

      const emailResult = await sendStatusEmail(emailParams);
      emailStatus = emailResult.success ? "sent" : "failed";

      // 5. Save email notification
      const notif = await db
        .insert(emailNotificationsTable)
        .values({
          id: generateId(),
          orderId,
          customerEmail: customer.email,
          subject,
          body,
          status: emailStatus,
          providerMessageId: emailResult.messageId ?? null,
        })
        .returning();
      emailNotificationId = notif[0]?.id;
    }

    // 6. Audit log
    await db.insert(auditLogsTable).values({
      id: generateId(),
      businessId,
      userId,
      action: "UPDATE_ORDER_STATUS",
      entityType: "order",
      entityId: orderId,
      metadata: { previousStatus: order.currentStatus, newStatus: status, emailStatus },
    });

    res.json({
      order: serializeOrder(updatedOrder[0]),
      trackingEvent: {
        ...trackingEvent[0],
        createdAt: trackingEvent[0].createdAt.toISOString(),
      },
      emailStatus,
      emailNotificationId,
    });
  } catch (err) {
    req.log.error({ err }, "Failed to update order status");
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /orders/:orderId/transition — FSM-gated status change.
//
// Distinct from the legacy /status endpoint above: that one accepts any
// free-text status (used for "In transit", "Out for delivery", etc., which
// are tracking waypoints rather than lifecycle states). This endpoint
// enforces the typed Created→…→Delivered lifecycle and writes both a
// tracking-event row and a typed audit-log row inside one transaction.
const TransitionBody = z.object({
  toStatus: z.enum(FSM_ORDER_STATUSES),
  reason: z.string().trim().max(500).optional(),
});

router.post("/orders/:orderId/transition", requireAuth, async (req, res) => {
  try {
    const businessId = (req as any).businessId;
    const userId = (req as any).userId;
    const orderId = req.params.orderId as string;

    // Wire format follows the spec: snake_case keys (`current_status`,
    // `event_id`). The FSM module stays camelCase internally — we serialize
    // at the route boundary so the public contract is exactly what was
    // requested without polluting the TS types.
    const parse = TransitionBody.safeParse(req.body);
    if (!parse.success) {
      res.status(400).json({
        success: false,
        current_status: null,
        message: "Invalid input",
        event_id: null,
        details: parse.error.issues,
      });
      return;
    }

    const result = await transitionOrder({
      orderId,
      businessId,
      toStatus: parse.data.toStatus as OrderFsmStatus,
      updatedBy: userId,
      reason: parse.data.reason ?? null,
    });

    if (!result.success) {
      // Map FSM failure codes onto HTTP statuses. 422 for "request understood
      // but the state machine refused it" reads more accurately than 400,
      // which we reserve for malformed input.
      const statusCode =
        result.code === "not_found"
          ? 404
          : result.code === "unknown_status"
            ? 400
            : 422;
      res.status(statusCode).json({
        success: false,
        current_status: result.currentStatus,
        message: result.message,
        event_id: null,
        code: result.code,
      });
      return;
    }

    res.json({
      success: true,
      current_status: result.currentStatus,
      message: result.message,
      event_id: result.eventId,
    });
  } catch (err) {
    if (err instanceof ConcurrentTransitionError) {
      // Another writer beat us between read and update — caller should
      // re-fetch and retry with the latest state.
      res.status(409).json({
        success: false,
        current_status: null,
        message: "Order was modified by another request. Please retry.",
        event_id: null,
        code: "conflict",
      });
      return;
    }
    req.log.error({ err }, "Failed to transition order");
    res.status(500).json({
      success: false,
      current_status: null,
      message: "Internal server error",
      event_id: null,
    });
  }
});

router.post("/orders/:orderId/resend-email", requireAuth, async (req, res) => {
  try {
    const businessId = (req as any).businessId;
    const userId = (req as any).userId;
    const orderId = req.params.orderId as string;

    const order = await db.query.ordersTable.findFirst({
      where: and(eq(ordersTable.id, orderId), eq(ordersTable.businessId, businessId)),
    });
    if (!order) {
      res.status(404).json({ error: "Order not found" });
      return;
    }

    const [customer, business] = await Promise.all([
      db.query.customersTable.findFirst({
        where: and(
          eq(customersTable.id, order.customerId),
          eq(customersTable.businessId, businessId),
        ),
      }),
      db.query.businessesTable.findFirst({ where: eq(businessesTable.id, businessId) }),
    ]);

    if (!customer || !business) {
      res.status(400).json({ error: "Cannot resend email — missing customer or business data" });
      return;
    }

    const trackingLink = buildTrackingLink(business.websiteUrl, order.trackingId);
    const emailParams = {
      customerEmail: customer.email,
      customerName: customer.fullName,
      trackingId: order.trackingId,
      status: order.currentStatus,
      statusMessage: null,
      trackingLink,
      businessName: business.name,
      supportEmail: business.supportEmail,
      emailGreeting: business.emailGreeting,
      emailSignature: business.emailSignature,
      emailFooterNote: business.emailFooterNote,
    };

    const { subject, body } = buildEmailBody(emailParams);
    const emailResult = await sendStatusEmail(emailParams);
    const emailStatus = emailResult.success ? "sent" : "failed";

    const notif = await db
      .insert(emailNotificationsTable)
      .values({
        id: generateId(),
        orderId,
        customerEmail: customer.email,
        subject,
        body,
        status: emailStatus,
        providerMessageId: emailResult.messageId ?? null,
      })
      .returning();

    await db.insert(auditLogsTable).values({
      id: generateId(),
      businessId,
      userId,
      action: "RESEND_EMAIL",
      entityType: "order",
      entityId: orderId,
      metadata: { emailStatus },
    });

    res.json({
      success: emailResult.success,
      emailNotificationId: notif[0]?.id,
      message: emailResult.success ? "Email resent successfully" : emailResult.error,
    });
  } catch (err) {
    req.log.error({ err }, "Failed to resend email");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/orders/:orderId/tracking-events", requireAuth, async (req, res) => {
  try {
    const businessId = (req as any).businessId;
    const orderId = req.params.orderId as string;

    const order = await db.query.ordersTable.findFirst({
      where: and(eq(ordersTable.id, orderId), eq(ordersTable.businessId, businessId)),
    });
    if (!order) {
      res.status(404).json({ error: "Order not found" });
      return;
    }

    const events = await db
      .select()
      .from(trackingEventsTable)
      .where(eq(trackingEventsTable.orderId, orderId))
      .orderBy(desc(trackingEventsTable.createdAt));

    res.json(events.map((e) => ({ ...e, createdAt: e.createdAt.toISOString() })));
  } catch (err) {
    req.log.error({ err }, "Failed to get tracking events");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/orders/:orderId/email-notifications", requireAuth, async (req, res) => {
  try {
    const businessId = (req as any).businessId;
    const orderId = req.params.orderId as string;

    const order = await db.query.ordersTable.findFirst({
      where: and(eq(ordersTable.id, orderId), eq(ordersTable.businessId, businessId)),
    });
    if (!order) {
      res.status(404).json({ error: "Order not found" });
      return;
    }

    const notifications = await db
      .select()
      .from(emailNotificationsTable)
      .where(eq(emailNotificationsTable.orderId, orderId))
      .orderBy(desc(emailNotificationsTable.createdAt));

    res.json(
      notifications.map((n) => ({ ...n, createdAt: n.createdAt.toISOString() })),
    );
  } catch (err) {
    req.log.error({ err }, "Failed to get email notifications");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
