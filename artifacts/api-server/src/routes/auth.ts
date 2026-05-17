import { Router } from "express";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { db, usersTable, businessesTable } from "@workspace/db";
import { generateId } from "../lib/id";
import {
  SESSION_COOKIE,
  signSession,
  sessionCookieOptions,
  verifySession,
} from "../lib/session";

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
    req.log?.error({ err }, "login failed");
    res.status(500).json({ error: "Login failed" });
  }
});

router.post("/auth/logout", (req, res) => {
  res.clearCookie(SESSION_COOKIE, { ...sessionCookieOptions(), maxAge: 0 });
  res.json({ ok: true });
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
