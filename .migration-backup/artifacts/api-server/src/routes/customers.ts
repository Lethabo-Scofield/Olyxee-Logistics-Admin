import { Router } from "express";
import { db, customersTable, ordersTable, auditLogsTable } from "@workspace/db";
import { eq, and, ilike, or, desc, asc, sql, isNotNull, isNull, ne } from "drizzle-orm";
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

    // Query strings always arrive as strings; normalize the boolean filters
    // explicitly so that an absent param is treated as "no filter" rather
    // than falsy.
    const parseBool = (v: unknown): boolean | undefined => {
      if (v === "true") return true;
      if (v === "false") return false;
      return undefined;
    };
    const hasCompany = parseBool(req.query.hasCompany);
    const hasPhone = parseBool(req.query.hasPhone);
    const sort = (req.query.sort as string) ?? "newest";

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
    // For the "has X" filters we also treat empty strings as missing — older
    // records may have stored "" instead of NULL.
    if (hasCompany === true) {
      whereConditions.push(isNotNull(customersTable.companyName));
      whereConditions.push(ne(customersTable.companyName, ""));
    } else if (hasCompany === false) {
      whereConditions.push(
        or(isNull(customersTable.companyName), eq(customersTable.companyName, "")) as any,
      );
    }
    if (hasPhone === true) {
      whereConditions.push(isNotNull(customersTable.phone));
      whereConditions.push(ne(customersTable.phone, ""));
    } else if (hasPhone === false) {
      whereConditions.push(
        or(isNull(customersTable.phone), eq(customersTable.phone, "")) as any,
      );
    }

    const orderBy =
      sort === "oldest"
        ? asc(customersTable.createdAt)
        : sort === "name"
        ? asc(customersTable.fullName)
        : desc(customersTable.createdAt);

    const [customers, countResult] = await Promise.all([
      db
        .select()
        .from(customersTable)
        .where(and(...whereConditions))
        .orderBy(orderBy)
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
    const userId = (req as any).userId;
    const parse = CreateCustomerBody.safeParse(req.body);
    if (!parse.success) {
      res.status(400).json({ error: "Invalid input", details: parse.error.issues });
      return;
    }

    const { fullName, email, phone, companyName, address } = parse.data;

    // Customer + audit log written atomically so the audit trail can never
    // miss a successful create (or record one that didn't actually happen).
    const c = await db.transaction(async (tx) => {
      const inserted = await tx
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
      const customer = inserted[0]!;
      await tx.insert(auditLogsTable).values({
        id: generateId(),
        businessId,
        userId,
        action: "CREATE_CUSTOMER",
        entityType: "customer",
        entityId: customer.id,
        metadata: { fullName: customer.fullName, email: customer.email },
      });
      return customer;
    });

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
    const userId = (req as any).userId;
    const customerId = req.params.customerId as string;
    const parse = UpdateCustomerBody.safeParse(req.body);
    if (!parse.success) {
      res.status(400).json({ error: "Invalid input", details: parse.error.issues });
      return;
    }

    const updatedCustomer = await db.transaction(async (tx) => {
      const existing = await tx.query.customersTable.findFirst({
        where: and(
          eq(customersTable.id, customerId),
          eq(customersTable.businessId, businessId),
        ),
      });

      if (!existing) return null;

      const next = {
        fullName: parse.data.fullName ?? existing.fullName,
        email: parse.data.email ?? existing.email,
        phone: parse.data.phone ?? existing.phone,
        companyName: parse.data.companyName ?? existing.companyName,
        address: parse.data.address ?? existing.address,
      };

      const updated = await tx
        .update(customersTable)
        .set(next)
        .where(
          and(
            eq(customersTable.id, customerId),
            eq(customersTable.businessId, businessId),
          ),
        )
        .returning();

      // Capture before/after for audit trail. Only fields that changed.
      const changes: Record<string, { before: unknown; after: unknown }> = {};
      for (const key of Object.keys(next) as (keyof typeof next)[]) {
        if ((existing as any)[key] !== (next as any)[key]) {
          changes[key] = { before: (existing as any)[key], after: (next as any)[key] };
        }
      }

      await tx.insert(auditLogsTable).values({
        id: generateId(),
        businessId,
        userId,
        action: "UPDATE_CUSTOMER",
        entityType: "customer",
        entityId: customerId,
        metadata: { changes },
      });

      return updated[0]!;
    });

    if (!updatedCustomer) {
      res.status(404).json({ error: "Customer not found" });
      return;
    }

    res.json({ ...updatedCustomer, createdAt: updatedCustomer.createdAt.toISOString() });
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
