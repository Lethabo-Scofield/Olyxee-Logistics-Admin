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
        .leftJoin(customersTable, eq(ordersTable.customerId, customersTable.id))
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
        currentStatus: "Order received",
        estimatedDeliveryDate: parse.data.estimatedDeliveryDate ?? null,
      })
      .returning();

    const o = order[0];

    // Create initial tracking event
    await db.insert(trackingEventsTable).values({
      id: generateId(),
      orderId: o.id,
      status: "Order received",
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
      db.query.customersTable.findFirst({ where: eq(customersTable.id, order.customerId) }),
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
      db.query.customersTable.findFirst({ where: eq(customersTable.id, order.customerId) }),
      db.query.businessesTable.findFirst({ where: eq(businessesTable.id, businessId) }),
    ]);

    // 1. Save tracking event
    const trackingEvent = await db
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

    // 2. Update order status
    const updatedOrder = await db
      .update(ordersTable)
      .set({ currentStatus: status, updatedAt: new Date() })
      .where(eq(ordersTable.id, orderId))
      .returning();

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
      db.query.customersTable.findFirst({ where: eq(customersTable.id, order.customerId) }),
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
