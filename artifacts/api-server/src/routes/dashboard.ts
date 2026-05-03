import { Router } from "express";
import { db, ordersTable, emailNotificationsTable, customersTable } from "@workspace/db";
import { eq, and, gte, sql, desc } from "drizzle-orm";
import { requireAuth } from "../lib/auth";

const router = Router();

router.get("/dashboard/summary", requireAuth, async (req, res) => {
  try {
    const businessId = (req as any).businessId;

    const [orders, emailsToday] = await Promise.all([
      db.select().from(ordersTable).where(eq(ordersTable.businessId, businessId)),
      db
        .select()
        .from(emailNotificationsTable)
        .leftJoin(ordersTable, eq(emailNotificationsTable.orderId, ordersTable.id))
        .where(
          and(
            eq(ordersTable.businessId, businessId),
            eq(emailNotificationsTable.status, "sent"),
            gte(
              emailNotificationsTable.createdAt,
              new Date(new Date().setHours(0, 0, 0, 0)),
            ),
          ),
        ),
    ]);

    const activeStatuses = [
      "Order received",
      "Processing",
      "Driver assigned",
      "In transit",
      "Out for delivery",
    ];

    const summary = {
      totalOrders: orders.length,
      activeDeliveries: orders.filter((o) => activeStatuses.includes(o.currentStatus)).length,
      delayedOrders: orders.filter((o) => o.currentStatus === "Delayed").length,
      deliveredOrders: orders.filter((o) => o.currentStatus === "Delivered").length,
      cancelledOrders: orders.filter((o) =>
        ["Cancelled", "Failed delivery"].includes(o.currentStatus),
      ).length,
      emailsSentToday: emailsToday.length,
    };

    res.json(summary);
  } catch (err) {
    req.log.error({ err }, "Failed to get dashboard summary");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/dashboard/recent-orders", requireAuth, async (req, res) => {
  try {
    const businessId = (req as any).businessId;

    const orders = await db
      .select()
      .from(ordersTable)
      .leftJoin(customersTable, eq(ordersTable.customerId, customersTable.id))
      .where(eq(ordersTable.businessId, businessId))
      .orderBy(desc(ordersTable.updatedAt))
      .limit(10);

    const result = orders.map(({ orders: o, customers: c }) => ({
      id: o.id,
      trackingId: o.trackingId,
      orderReference: o.orderReference,
      currentStatus: o.currentStatus,
      estimatedDeliveryDate: o.estimatedDeliveryDate,
      createdAt: o.createdAt.toISOString(),
      updatedAt: o.updatedAt.toISOString(),
      customer: c
        ? {
            id: c.id,
            businessId: c.businessId,
            fullName: c.fullName,
            email: c.email,
            phone: c.phone,
            companyName: c.companyName,
            address: c.address,
            createdAt: c.createdAt.toISOString(),
          }
        : null,
    }));

    res.json(result);
  } catch (err) {
    req.log.error({ err }, "Failed to get recent orders");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/dashboard/status-breakdown", requireAuth, async (req, res) => {
  try {
    const businessId = (req as any).businessId;

    const breakdown = await db
      .select({
        status: ordersTable.currentStatus,
        count: sql<number>`count(*)::int`,
      })
      .from(ordersTable)
      .where(eq(ordersTable.businessId, businessId))
      .groupBy(ordersTable.currentStatus);

    res.json(breakdown);
  } catch (err) {
    req.log.error({ err }, "Failed to get status breakdown");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
