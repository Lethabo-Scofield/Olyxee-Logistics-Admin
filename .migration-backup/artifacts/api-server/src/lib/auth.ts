import { db, usersTable, businessesTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import type { Request, Response, NextFunction } from "express";
import { getAuth, clerkClient } from "@clerk/express";
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

  let user = await db.query.usersTable.findFirst({
    where: eq(usersTable.clerkUserId, clerkUserId),
  });

  if (!user) {
    const business = await db.query.businessesTable.findFirst({
      where: eq(businessesTable.slug, "olyxee"),
    });

    if (!business) {
      res.status(500).json({ error: "No business configured" });
      return;
    }

    let name = "User";
    let email = "";
    try {
      const cu = await clerkClient.users.getUser(clerkUserId);
      name =
        [cu.firstName, cu.lastName].filter(Boolean).join(" ") ||
        cu.username ||
        "User";
      email = cu.primaryEmailAddress?.emailAddress ?? "";
    } catch (err) {
      req.log?.warn({ err }, "Failed to fetch Clerk user profile");
    }

    const inserted = await db
      .insert(usersTable)
      .values({
        id: generateId(),
        businessId: business.id,
        clerkUserId,
        name,
        email,
        role: "admin",
      })
      .onConflictDoNothing()
      .returning();

    user =
      inserted[0] ??
      (await db.query.usersTable.findFirst({
        where: eq(usersTable.clerkUserId, clerkUserId),
      }));
  }

  if (!user) {
    res.status(500).json({ error: "Failed to provision user" });
    return;
  }

  (req as any).businessId = user.businessId;
  (req as any).userId = user.id;
  next();
}
