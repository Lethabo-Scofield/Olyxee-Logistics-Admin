import { db, usersTable, businessesTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import type { Request, Response, NextFunction } from "express";
import { generateId } from "./id";
import { getSupabaseAdmin } from "./supabase";

const OLYXEE_EMAIL_DOMAINS = ["olyxee.com"];

function extractBearer(req: Request): string | null {
  const header = req.headers.authorization;
  if (!header) return null;
  const [scheme, token] = header.split(" ");
  if (scheme?.toLowerCase() !== "bearer" || !token) return null;
  return token.trim() || null;
}

export async function requireAuth(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const token = extractBearer(req);
  if (!token) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  let supabase;
  try {
    supabase = getSupabaseAdmin();
  } catch (err) {
    req.log?.error({ err }, "Supabase not configured");
    res.status(500).json({ error: "Auth not configured" });
    return;
  }

  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data?.user) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const authUserId = data.user.id;
  const email = data.user.email ?? "";
  const meta = (data.user.user_metadata ?? {}) as Record<string, unknown>;
  const fullName =
    (typeof meta.full_name === "string" && meta.full_name) ||
    (typeof meta.name === "string" && meta.name) ||
    email ||
    "User";

  let user = await db.query.usersTable.findFirst({
    where: eq(usersTable.authUserId, authUserId),
  });

  if (!user) {
    // First-time provisioning. Wrapped in a transaction so the user row +
    // any new business are created atomically, and so a concurrent request
    // for the same auth_user_id either re-uses the existing row or rolls
    // back without leaving an orphan business behind.
    try {
      user = await db.transaction(async (tx) => {
        const existing = await tx.query.usersTable.findFirst({
          where: eq(usersTable.authUserId, authUserId),
        });
        if (existing) return existing;

        const emailDomain = email.split("@")[1]?.toLowerCase();
        const isOlyxee =
          !!emailDomain && OLYXEE_EMAIL_DOMAINS.includes(emailDomain);

        let businessId: string;
        let role: "admin" | "owner";

        if (isOlyxee) {
          const olyxee = await tx.query.businessesTable.findFirst({
            where: eq(businessesTable.slug, "olyxee"),
          });
          if (!olyxee) {
            // Strict rule: an Olyxee employee must attach to the seeded
            // business. Failing fast prevents accidental tenant sprawl.
            throw new Error("Seeded olyxee business is missing");
          }
          businessId = olyxee.id;
          role = "admin";
        } else {
          const slugBase =
            (emailDomain?.split(".")[0] ?? "workspace").replace(
              /[^a-z0-9]/g,
              "",
            ) || "workspace";
          const slug = `${slugBase}-${generateId().slice(0, 6)}`.toLowerCase();
          const insertedBiz = await tx
            .insert(businessesTable)
            .values({
              id: generateId(),
              name:
                (meta.business_name as string) ?? `${fullName}'s Business`,
              slug,
              websiteUrl: "",
              supportEmail: email,
            })
            .returning();
          const biz = insertedBiz[0];
          if (!biz) throw new Error("Failed to create business");
          businessId = biz.id;
          role = "owner";
        }

        const insertedUsers = await tx
          .insert(usersTable)
          .values({
            id: generateId(),
            businessId,
            authUserId,
            name: fullName,
            email,
            role,
          })
          .onConflictDoNothing({ target: usersTable.authUserId })
          .returning();

        if (insertedUsers[0]) return insertedUsers[0];

        // Lost the race with a concurrent provision — fetch the winner.
        const winner = await tx.query.usersTable.findFirst({
          where: eq(usersTable.authUserId, authUserId),
        });
        if (!winner) throw new Error("Failed to provision user");
        return winner;
      });
    } catch (err) {
      req.log?.error({ err }, "Failed to provision user");
      const message =
        err instanceof Error && err.message === "Seeded olyxee business is missing"
          ? "Olyxee business is not configured"
          : "Failed to provision user";
      res.status(500).json({ error: message });
      return;
    }
  }

  if (!user) {
    res.status(500).json({ error: "Failed to provision user" });
    return;
  }

  (req as any).businessId = user.businessId;
  (req as any).userId = user.id;
  (req as any).authUserId = authUserId;
  next();
}
