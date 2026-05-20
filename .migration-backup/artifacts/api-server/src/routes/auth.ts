import crypto from "node:crypto";
import { Router } from "express";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { and, eq, gt, isNull } from "drizzle-orm";
import {
  db,
  usersTable,
  businessesTable,
  passwordResetTokensTable,
} from "@workspace/db";
import { generateId } from "../lib/id";
import {
  SESSION_COOKIE,
  signSession,
  sessionCookieOptions,
  verifySession,
} from "../lib/session";
import { sendPasswordResetEmail } from "../lib/email";

const RESET_TOKEN_TTL_MINUTES = 30;

function hashResetToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

function buildResetLink(req: import("express").Request, token: string): string {
  // Prefer the first configured ALLOWED_ORIGINS entry (the production app
  // origin); fall back to the request's host so it still works in dev.
  const origins = (process.env.ALLOWED_ORIGINS ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const base =
    origins[0] ??
    `${req.protocol}://${req.get("host") ?? "localhost"}`;
  return `${base.replace(/\/+$/, "")}/reset-password?token=${encodeURIComponent(token)}`;
}

const router = Router();

const SignupBody = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(8).max(200),
  fullName: z.string().trim().min(1).max(120),
  businessName: z.string().trim().min(1).max(120),
});

const LoginBody = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(1).max(200),
});

function slugify(input: string): string {
  return (
    input
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "")
      .slice(0, 40) || "workspace"
  );
}

router.post("/auth/signup", async (req, res) => {
  const parsed = SignupBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid signup details" });
    return;
  }
  const { email, password, fullName, businessName } = parsed.data;

  try {
    const existing = await db.query.usersTable.findFirst({
      where: eq(usersTable.email, email),
    });
    if (existing) {
      res.status(409).json({ error: "An account with this email already exists." });
      return;
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const businessId = generateId();
    const userId = generateId();
    const slug = `${slugify(businessName)}-${businessId.slice(0, 6)}`;

    await db.transaction(async (tx) => {
      await tx.insert(businessesTable).values({
        id: businessId,
        name: businessName,
        slug,
        websiteUrl: "",
        supportEmail: email,
      });
      await tx.insert(usersTable).values({
        id: userId,
        businessId,
        name: fullName,
        email,
        passwordHash,
        role: "owner",
      });
    });

    const token = signSession(userId);
    res.cookie(SESSION_COOKIE, token, sessionCookieOptions());
    res.status(201).json({
      user: { id: userId, email, name: fullName, role: "owner", businessId },
    });
  } catch (err) {
    // Use console.error in addition to req.log because pino's async writes
    // sometimes don't flush before a serverless function freezes.
    const e = err as { message?: string; code?: string; detail?: string };
    console.error("[signup] failed:", e?.code, e?.message, e?.detail);
    req.log?.error({ err }, "signup failed");
    res.status(500).json({ error: "Could not create account" });
  }
});

router.post("/auth/login", async (req, res) => {
  const parsed = LoginBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid email or password" });
    return;
  }
  const { email, password } = parsed.data;

  try {
    const user = await db.query.usersTable.findFirst({
      where: eq(usersTable.email, email),
    });
    if (!user || !user.passwordHash) {
      res.status(401).json({ error: "Invalid email or password" });
      return;
    }
    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) {
      res.status(401).json({ error: "Invalid email or password" });
      return;
    }
    const token = signSession(user.id);
    res.cookie(SESSION_COOKIE, token, sessionCookieOptions());
    res.json({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        businessId: user.businessId,
      },
    });
  } catch (err) {
    const e = err as { message?: string; code?: string; detail?: string };
    console.error("[login] failed:", e?.code, e?.message, e?.detail);
    req.log?.error({ err }, "login failed");
    res.status(500).json({ error: "Login failed" });
  }
});

const ForgotBody = z.object({
  email: z.string().trim().toLowerCase().email(),
});

router.post("/auth/forgot-password", async (req, res) => {
  const parsed = ForgotBody.safeParse(req.body);
  // Always return 200 to avoid leaking which emails exist (account enumeration).
  if (!parsed.success) {
    res.json({ ok: true });
    return;
  }
  const { email } = parsed.data;
  try {
    const user = await db.query.usersTable.findFirst({
      where: eq(usersTable.email, email),
    });
    if (user) {
      const token = crypto.randomBytes(32).toString("base64url");
      const tokenHash = hashResetToken(token);
      const expiresAt = new Date(Date.now() + RESET_TOKEN_TTL_MINUTES * 60 * 1000);
      await db.insert(passwordResetTokensTable).values({
        id: generateId(),
        userId: user.id,
        tokenHash,
        expiresAt,
      });
      const link = buildResetLink(req, token);
      const result = await sendPasswordResetEmail({
        to: user.email,
        name: user.name,
        resetLink: link,
        expiresInMinutes: RESET_TOKEN_TTL_MINUTES,
      });
      if (!result.success) {
        req.log?.warn(
          { err: result.error },
          "password reset email send failed (token still issued)",
        );
      }
    }
  } catch (err) {
    const e = err as { message?: string; code?: string };
    console.error("[forgot_password] failed:", e?.code, e?.message);
    req.log?.error({ err }, "forgot_password failed");
    // Still respond ok so the response shape is identical to the
    // happy path (no information leak based on errors).
  }
  res.json({ ok: true });
});

const ResetBody = z.object({
  token: z.string().min(10).max(200),
  password: z.string().min(8).max(200),
});

router.post("/auth/reset-password", async (req, res) => {
  const parsed = ResetBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid token or password" });
    return;
  }
  const { token, password } = parsed.data;
  const tokenHash = hashResetToken(token);
  try {
    const passwordHash = await bcrypt.hash(password, 10);
    // Atomic single-use: only one concurrent reset wins the race because
    // the UPDATE is guarded by `used_at IS NULL AND expires_at > now()`.
    // Whoever loses gets 0 rows back and we treat it as invalid.
    const claimed = await db
      .update(passwordResetTokensTable)
      .set({ usedAt: new Date() })
      .where(
        and(
          eq(passwordResetTokensTable.tokenHash, tokenHash),
          isNull(passwordResetTokensTable.usedAt),
          gt(passwordResetTokensTable.expiresAt, new Date()),
        ),
      )
      .returning({
        id: passwordResetTokensTable.id,
        userId: passwordResetTokensTable.userId,
      });
    const row = claimed[0];
    if (!row) {
      res.status(400).json({ error: "This reset link is invalid or has expired." });
      return;
    }
    await db
      .update(usersTable)
      .set({ passwordHash })
      .where(eq(usersTable.id, row.userId));
    res.json({ ok: true });
  } catch (err) {
    const e = err as { message?: string; code?: string };
    console.error("[reset_password] failed:", e?.code, e?.message);
    req.log?.error({ err }, "reset_password failed");
    res.status(500).json({ error: "Could not reset password" });
  }
});

router.post("/auth/logout", (req, res) => {
  res.clearCookie(SESSION_COOKIE, { ...sessionCookieOptions(), maxAge: 0 });
  res.json({ ok: true });
});

// Allow the currently signed-in admin to edit their own profile. Two
// independent concerns share this endpoint:
//   1. Update name / email (lightweight — email uniqueness re-checked).
//   2. Change password — requires `currentPassword` + `newPassword` so a
//      stolen-session attacker can't silently rotate the password.
// Any field can be omitted; only what's provided is touched.
const UpdateMeBody = z
  .object({
    name: z.string().trim().min(1).max(120).optional(),
    email: z.string().trim().toLowerCase().email().optional(),
    currentPassword: z.string().min(1).max(200).optional(),
    newPassword: z.string().min(8).max(200).optional(),
  })
  .refine(
    (d) =>
      // Password change is all-or-nothing.
      (d.currentPassword == null && d.newPassword == null) ||
      (d.currentPassword != null && d.newPassword != null),
    { message: "Both currentPassword and newPassword are required to change password." },
  );

router.put("/auth/me", async (req, res) => {
  const token = (req as any).cookies?.[SESSION_COOKIE] as string | undefined;
  const payload = verifySession(token);
  if (!payload) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const parsed = UpdateMeBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({
      error: parsed.error.issues[0]?.message ?? "Invalid input",
    });
    return;
  }
  const { name, email, currentPassword, newPassword } = parsed.data;

  try {
    const user = await db.query.usersTable.findFirst({
      where: eq(usersTable.id, payload.userId),
    });
    if (!user) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    // Email uniqueness check — only if the email is actually changing.
    if (email && email !== user.email) {
      const clash = await db.query.usersTable.findFirst({
        where: eq(usersTable.email, email),
      });
      if (clash) {
        res.status(409).json({ error: "Another account already uses this email." });
        return;
      }
    }

    // Password change path — verify current password before rotating.
    let nextPasswordHash: string | undefined;
    if (currentPassword && newPassword) {
      if (!user.passwordHash) {
        res.status(400).json({ error: "This account has no password set." });
        return;
      }
      const ok = await bcrypt.compare(currentPassword, user.passwordHash);
      if (!ok) {
        res.status(400).json({ error: "Current password is incorrect." });
        return;
      }
      nextPasswordHash = await bcrypt.hash(newPassword, 10);
    }

    const updated = await db
      .update(usersTable)
      .set({
        name: name ?? user.name,
        email: email ?? user.email,
        ...(nextPasswordHash ? { passwordHash: nextPasswordHash } : {}),
      })
      .where(eq(usersTable.id, user.id))
      .returning();

    const u = updated[0]!;
    res.json({
      user: {
        id: u.id,
        email: u.email,
        name: u.name,
        role: u.role,
        businessId: u.businessId,
      },
    });
  } catch (err) {
    const e = err as { message?: string; code?: string; detail?: string };
    console.error("[update_me] failed:", e?.code, e?.message, e?.detail);
    req.log?.error({ err }, "update_me failed");
    res.status(500).json({ error: "Could not update profile" });
  }
});

router.get("/auth/me", async (req, res) => {
  const token = (req as any).cookies?.[SESSION_COOKIE] as string | undefined;
  const payload = verifySession(token);
  if (!payload) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const user = await db.query.usersTable.findFirst({
    where: eq(usersTable.id, payload.userId),
  });
  if (!user) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  res.json({
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      businessId: user.businessId,
    },
  });
});

export default router;
