import { Router } from "express";
import { db, businessesTable, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { requireAuth } from "../lib/auth";

const router = Router();

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

    res.json({
      id: business.id,
      name: business.name,
      slug: business.slug,
      websiteUrl: business.websiteUrl,
      supportEmail: business.supportEmail,
      createdAt: business.createdAt.toISOString(),
    });
  } catch (err) {
    req.log.error({ err }, "Failed to get business");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
