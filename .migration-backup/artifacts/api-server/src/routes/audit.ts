import { Router } from "express";
import { db, auditLogsTable } from "@workspace/db";
import { eq, and, desc, sql } from "drizzle-orm";
import { requireAuth } from "../lib/auth";

const router = Router();

router.get("/audit-logs", requireAuth, async (req, res) => {
  try {
    const businessId = (req as any).businessId;
    const entityType = req.query.entityType as string | undefined;
    const entityId = req.query.entityId as string | undefined;
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 30));
    const offset = (page - 1) * limit;

    const whereConditions: any[] = [eq(auditLogsTable.businessId, businessId)];
    if (entityType) whereConditions.push(eq(auditLogsTable.entityType, entityType));
    if (entityId) whereConditions.push(eq(auditLogsTable.entityId, entityId));

    const [logs, countResult] = await Promise.all([
      db
        .select()
        .from(auditLogsTable)
        .where(and(...whereConditions))
        .orderBy(desc(auditLogsTable.createdAt))
        .limit(limit)
        .offset(offset),
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(auditLogsTable)
        .where(and(...whereConditions)),
    ]);

    res.json({
      data: logs.map((l) => ({ ...l, createdAt: l.createdAt.toISOString() })),
      total: countResult[0]?.count ?? 0,
      page,
      limit,
    });
  } catch (err) {
    req.log.error({ err }, "Failed to get audit logs");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
