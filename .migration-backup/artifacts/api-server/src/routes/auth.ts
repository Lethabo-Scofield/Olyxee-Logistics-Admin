import { Router } from "express";
import { CheckEmailExistsBody } from "@workspace/api-zod";
import { getSupabaseAdmin, hasServiceRole } from "../lib/supabase";

const router = Router();

/**
 * Lightweight existence check used by the email-first auth flow on the
 * client. Returns whether a Supabase user exists for the given email so the
 * UI can decide between showing the sign-in or sign-up form.
 *
 * NOTE: this endpoint reveals user existence. That is acceptable here because
 * Supabase already leaks the same signal via "user already registered" errors
 * during sign-up; we only require the service-role key to perform a clean
 * lookup. Rate limited by the global write limiter in `app.ts`.
 */
router.post("/auth/check-email", async (req, res) => {
  try {
    const parse = CheckEmailExistsBody.safeParse(req.body);
    if (!parse.success) {
      res.status(400).json({ error: "Invalid email" });
      return;
    }

    if (!hasServiceRole()) {
      // Without service-role we cannot enumerate. Fall back to "unknown" so
      // the client treats every email as new (Supabase will then surface the
      // duplicate-account error from the standard signUp call).
      res.json({ exists: false, fallback: true });
      return;
    }

    const supabase = getSupabaseAdmin();
    const adminAuth = (supabase.auth as unknown as {
      admin: {
        listUsers: (opts: {
          page?: number;
          perPage?: number;
        }) => Promise<{ data: { users: Array<{ email?: string | null }> }; error: unknown }>;
      };
    }).admin;

    // Supabase JS doesn't expose a direct "find by email" admin call yet, so
    // we walk pages until we find a match or exhaust results. Most projects
    // have small user counts; we cap pagination defensively.
    const target = parse.data.email.toLowerCase();
    let exists = false;
    for (let page = 1; page <= 50; page++) {
      const { data, error } = await adminAuth.listUsers({ page, perPage: 200 });
      if (error) {
        req.log?.error({ err: error }, "Failed to list users");
        res.status(500).json({ error: "Lookup failed" });
        return;
      }
      const users = data?.users ?? [];
      if (users.some((u) => (u.email ?? "").toLowerCase() === target)) {
        exists = true;
        break;
      }
      if (users.length < 200) break;
    }

    res.json({ exists });
  } catch (err) {
    req.log?.error({ err }, "check-email failed");
    res.status(500).json({ error: "Lookup failed" });
  }
});

export default router;
