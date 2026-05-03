import { db, usersTable, businessesTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import type { Request, Response, NextFunction } from "express";
import { generateId } from "./id";

const DEV_USER_ID = "dev-admin";

export async function requireAuth(
  req: Request,
  _res: Response,
  next: NextFunction,
): Promise<void> {
  let user = await db.query.usersTable.findFirst({
    where: eq(usersTable.clerkUserId, DEV_USER_ID),
  });

  if (!user) {
    const business = await db.query.businessesTable.findFirst({
      where: eq(businessesTable.slug, "olyxee"),
    });

    if (!business) {
      _res.status(500).json({
        error: "No business found. Run `pnpm --filter @workspace/db run seed`.",
      });
      return;
    }

    const inserted = await db
      .insert(usersTable)
      .values({
        id: generateId(),
        businessId: business.id,
        clerkUserId: DEV_USER_ID,
        name: "Admin User",
        email: "admin@olyxee.local",
        role: "admin",
      })
      .onConflictDoNothing()
      .returning();

    user = inserted[0] ?? await db.query.usersTable.findFirst({
      where: eq(usersTable.clerkUserId, DEV_USER_ID),
    });
  }

  if (!user) {
    _res.status(500).json({ error: "Failed to provision dev user" });
    return;
  }

  (req as any).businessId = user.businessId;
  (req as any).userId = user.id;
  next();
}
