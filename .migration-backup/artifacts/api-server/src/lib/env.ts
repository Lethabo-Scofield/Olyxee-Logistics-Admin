import { logger } from "./logger";

type EnvCheck = {
  name: string;
  required: boolean;
  description: string;
};

const REQUIRED_ALWAYS: EnvCheck[] = [
  {
    name: "DATABASE_URL",
    required: true,
    description: "Postgres connection string (use Supabase pooled URL on Vercel).",
  },
];

// These are checked as "at least one of" groups — many repos set
// VITE_SUPABASE_URL only, or SUPABASE_URL only, etc.
const REQUIRED_GROUPS: { names: string[]; description: string }[] = [
  {
    names: ["VITE_SUPABASE_URL", "SUPABASE_URL"],
    description: "Supabase project URL — required for token verification.",
  },
  {
    names: [
      "SUPABASE_SERVICE_ROLE_KEY",
      "VITE_SUPABASE_ANON_KEY",
      "SUPABASE_ANON_KEY",
    ],
    description:
      "Supabase key (service-role preferred for full admin verification, anon acceptable for read-only auth).",
  },
];

const REQUIRED_IN_PRODUCTION: EnvCheck[] = [
  {
    name: "ALLOWED_ORIGINS",
    required: true,
    description:
      "Comma-separated list of origins allowed to call the API (e.g. https://admin.example.com).",
  },
];

const RECOMMENDED: EnvCheck[] = [
  {
    name: "RESEND_API_KEY",
    required: false,
    description: "Resend API key — order status emails will be skipped without it.",
  },
];

export function validateEnv(): void {
  const isProd = process.env.NODE_ENV === "production";
  const checks = [
    ...REQUIRED_ALWAYS,
    ...(isProd ? REQUIRED_IN_PRODUCTION : []),
  ];

  const missing: EnvCheck[] = [];
  for (const c of checks) {
    if (!process.env[c.name]) missing.push(c);
  }
  for (const g of REQUIRED_GROUPS) {
    const ok = g.names.some((n) => !!process.env[n]);
    if (!ok) {
      missing.push({
        name: g.names.join(" or "),
        required: true,
        description: g.description,
      });
    }
  }

  if (missing.length > 0) {
    const lines = missing
      .map((m) => `  - ${m.name}: ${m.description}`)
      .join("\n");
    const msg = `Missing required environment variables:\n${lines}`;
    if (isProd) {
      // Fail closed in production rather than serving misconfigured traffic.
      throw new Error(msg);
    }
    logger.warn({ missing: missing.map((m) => m.name) }, msg);
  }

  for (const c of RECOMMENDED) {
    if (!process.env[c.name]) {
      logger.warn(
        { env: c.name },
        `Recommended env not set: ${c.name} — ${c.description}`,
      );
    }
  }
}

export function getAllowedOrigins(): string[] | true {
  const raw = process.env.ALLOWED_ORIGINS;
  if (raw) {
    return raw
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
  }
  // Fail closed: only an EXPLICIT escape hatch enables allow-all mode. This
  // protects against a misconfigured NODE_ENV silently turning a production
  // deploy into a wide-open CORS surface.
  if (process.env.CORS_ALLOW_ALL === "1") {
    return true;
  }
  // No allowlist and no escape hatch → only same-origin requests (no Origin
  // header) will succeed; all cross-origin requests are refused.
  return [];
}
