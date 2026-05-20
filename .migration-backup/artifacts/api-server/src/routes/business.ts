import { Router } from "express";
import { db, businessesTable, auditLogsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { UpdateBusinessBody } from "@workspace/api-zod";
import { requireAuth } from "../lib/auth";
import { generateId } from "../lib/id";

const router = Router();

function serialize(business: typeof businessesTable.$inferSelect) {
  return {
    id: business.id,
    name: business.name,
    slug: business.slug,
    websiteUrl: business.websiteUrl,
    supportEmail: business.supportEmail,
    industry: business.industry,
    employeeCount: business.employeeCount,
    location: business.location,
    phone: business.phone,
    emailGreeting: business.emailGreeting,
    emailSignature: business.emailSignature,
    emailFooterNote: business.emailFooterNote,
    onboardingCompleted: business.onboardingCompleted,
    createdAt: business.createdAt.toISOString(),
  };
}

router.get("/business", requireAuth, async (req, res) => {
  try {
    const businessId = (req as any).businessId;
    const business = await db.query.businessesTable.findFirst({
      where: eq(businessesTable.id, businessId),
    });

    if (!business) {
      res.status(404).json({ error: "Business not found" });
      return;
    }

    res.json(serialize(business));
  } catch (err) {
    req.log.error({ err }, "Failed to get business");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.put("/business", requireAuth, async (req, res) => {
  try {
    const businessId = (req as any).businessId;
    const userId = (req as any).userId;
    const parse = UpdateBusinessBody.safeParse(req.body);
    if (!parse.success) {
      res.status(400).json({ error: "Invalid input", details: parse.error.issues });
      return;
    }

    const updated = await db.transaction(async (tx) => {
      const existing = await tx.query.businessesTable.findFirst({
        where: eq(businessesTable.id, businessId),
      });
      if (!existing) return null;

      // Email customization fields use `in` to distinguish "explicitly cleared
      // by the admin" (null/empty → fall back to defaults in the template) from
      // "not in payload" (keep existing value).
      const next = {
        name: parse.data.name ?? existing.name,
        industry: parse.data.industry ?? existing.industry,
        employeeCount: parse.data.employeeCount ?? existing.employeeCount,
        location: parse.data.location ?? existing.location,
        phone: parse.data.phone ?? existing.phone,
        websiteUrl: parse.data.websiteUrl ?? existing.websiteUrl,
        supportEmail: parse.data.supportEmail ?? existing.supportEmail,
        emailGreeting: "emailGreeting" in parse.data
          ? parse.data.emailGreeting ?? null : existing.emailGreeting,
        emailSignature: "emailSignature" in parse.data
          ? parse.data.emailSignature ?? null : existing.emailSignature,
        emailFooterNote: "emailFooterNote" in parse.data
          ? parse.data.emailFooterNote ?? null : existing.emailFooterNote,
        onboardingCompleted:
          parse.data.onboardingCompleted ?? existing.onboardingCompleted,
      };

      const rows = await tx
        .update(businessesTable)
        .set(next)
        .where(eq(businessesTable.id, businessId))
        .returning();

      await tx.insert(auditLogsTable).values({
        id: generateId(),
        businessId,
        userId,
        action: "UPDATE_BUSINESS",
        entityType: "business",
        entityId: businessId,
        metadata: { changes: parse.data },
      });

      return rows[0]!;
    });

    if (!updated) {
      res.status(404).json({ error: "Business not found" });
      return;
    }

    res.json(serialize(updated));
  } catch (err) {
    req.log.error({ err }, "Failed to update business");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
