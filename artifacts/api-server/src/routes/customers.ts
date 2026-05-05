import { Router } from "express";
import { db, customersTable, ordersTable } from "@workspace/db";
import { eq, and, ilike, or, desc, sql } from "drizzle-orm";
import { requireAuth } from "../lib/auth";
import { generateId } from "../lib/id";
import { CreateCustomerBody, UpdateCustomerBody } from "@workspace/api-zod";

const router = Router();

router.get("/customers", requireAuth, async (req, res) => {
  try {
    const businessId = (req as any).businessId;
    const search = req.query.search as string | undefined;
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 20));
    const offset = (page - 1) * limit;

    const whereConditions = [eq(customersTable.businessId, businessId)];
    if (search) {
      whereConditions.push(
        or(
          ilike(customersTable.fullName, `%${search}%`),
          ilike(customersTable.email, `%${search}%`),
          ilike(customersTable.companyName, `%${search}%`),
        ) as any,
      );
    }

    const [customers, countResult] = await Promise.all([
      db
        .select()
        .from(customersTable)
        .where(and(...whereConditions))
        .orderBy(desc(customersTable.createdAt))
        .limit(limit)
        .offset(offset),
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(customersTable)
        .where(and(...whereConditions)),
    ]);

    res.json({
      data: customers.map((c) => ({
        ...c,
        createdAt: c.createdAt.toISOString(),
      })),
      total: countResult[0]?.count ?? 0,
      page,
      limit,
    });
  } catch (err) {
    req.log.error({ err }, "Failed to list customers");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/customers", requireAuth, async (req, res) => {
  try {
    const businessId = (req as any).businessId;
    const parse = CreateCustomerBody.safeParse(req.body);
    if (!parse.success) {
      res.status(400).json({ error: "Invalid input", details: parse.error.issues });
      return;
    }

    const { fullName, email, phone, companyName, address } = parse.data;
    const customer = await db
      .insert(customersTable)
      .values({
        id: generateId(),
        businessId,
        fullName,
        email,
        phone: phone ?? null,
        companyName: companyName ?? null,
        address: address ?? null,
      })
      .returning();

    const c = customer[0];
    res.status(201).json({ ...c, createdAt: c.createdAt.toISOString() });
  } catch (err) {
    req.log.error({ err }, "Failed to create customer");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/customers/:customerId", requireAuth, async (req, res) => {
  try {
    const businessId = (req as any).businessId;
    const customerId = req.params.customerId as string;

    const customer = await db.query.customersTable.findFirst({
      where: and(
        eq(customersTable.id, customerId),
        eq(customersTable.businessId, businessId),
      ),
    });

    if (!customer) {
      res.status(404).json({ error: "Customer not found" });
      return;
    }

    res.json({ ...customer, createdAt: customer.createdAt.toISOString() });
  } catch (err) {
    req.log.error({ err }, "Failed to get customer");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.put("/customers/:customerId", requireAuth, async (req, res) => {
  try {
    const businessId = (req as any).businessId;
    const customerId = req.params.customerId as string;
    const parse = UpdateCustomerBody.safeParse(req.body);
    if (!parse.success) {
      res.status(400).json({ error: "Invalid input", details: parse.error.issues });
      return;
    }

    const existing = await db.query.customersTable.findFirst({
      where: and(
        eq(customersTable.id, customerId),
        eq(customersTable.businessId, businessId),
      ),
    });

    if (!existing) {
      res.status(404).json({ error: "Customer not found" });
      return;
    }

    const updated = await db
      .update(customersTable)
      .set({
        fullName: parse.data.fullName ?? existing.fullName,
        email: parse.data.email ?? existing.email,
        phone: parse.data.phone ?? existing.phone,
        companyName: parse.data.companyName ?? existing.companyName,
        address: parse.data.address ?? existing.address,
      })
      .where(eq(customersTable.id, customerId))
      .returning();

    const c = updated[0];
    res.json({ ...c, createdAt: c.createdAt.toISOString() });
  } catch (err) {
    req.log.error({ err }, "Failed to update customer");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/customers/:customerId/orders", requireAuth, async (req, res) => {
  try {
    const businessId = (req as any).businessId;
    const customerId = req.params.customerId as string;

    const orders = await db
      .select()
      .from(ordersTable)
      .where(
        and(
          eq(ordersTable.customerId, customerId),
          eq(ordersTable.businessId, businessId),
        ),
      )
      .orderBy(desc(ordersTable.createdAt));

    res.json(
      orders.map((o) => ({
        ...o,
        createdAt: o.createdAt.toISOString(),
        updatedAt: o.updatedAt.toISOString(),
      })),
    );
  } catch (err) {
    req.log.error({ err }, "Failed to get customer orders");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
