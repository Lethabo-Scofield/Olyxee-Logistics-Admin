import { getAuth } from "@clerk/express";
import { db, usersTable, businessesTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import type { Request, Response, NextFunction } from "express";
import { generateId } from "./id";

export async function requireAuth(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const auth = getAuth(req);
  const clerkUserId = auth?.userId;

  if (!clerkUserId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  // Find the user's record in our DB
  let user = await db.query.usersTable.findFirst({
    where: eq(usersTable.clerkUserId, clerkUserId),
  });

  // Auto-create user linked to the demo business if not found
  if (!user) {
    const business = await db.query.businessesTable.findFirst({
      where: eq(businessesTable.slug, "olyxee"),
    });

    if (!business) {
      res.status(403).json({ error: "No business found. Please contact your administrator." });
      return;
    }

    const clerkEmail = (auth as any)?.sessionClaims?.email as string | undefined;
    const clerkName = (auth as any)?.sessionClaims?.name as string | undefined;

    const inserted = await db
      .insert(usersTable)
      .values({
        id: generateId(),
        businessId: business.id,
        clerkUserId,
        name: clerkName ?? "Admin User",
        email: clerkEmail ?? `${clerkUserId}@olyxee-admin.local`,
        role: "admin",
      })
      .onConflictDoNothing()
      .returning();

    // If another concurrent request already inserted the row, fetch it
    user = inserted[0] ?? await db.query.usersTable.findFirst({
      where: eq(usersTable.clerkUserId, clerkUserId),
    });
  }

  (req as any).businessId = user.businessId;
  (req as any).userId = user.id;
  (req as any).clerkUserId = clerkUserId;
  next();
}
