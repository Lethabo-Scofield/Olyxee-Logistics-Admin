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
    description: "Postgres connection string.",
  },
];

const REQUIRED_IN_PRODUCTION: EnvCheck[] = [
  {
    name: "SESSION_SECRET",
    required: true,
    description: "Long random string (>=16 chars) used to sign session cookies.",
  },
];

const RECOMMENDED: EnvCheck[] = [
  {
    name: "ALLOWED_ORIGINS",
    required: false,
    description:
      "Comma-separated list of origins allowed to call the API cross-origin (e.g. https://admin.example.com). Not needed when the SPA and API are served from the same domain.",
  },
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

  if (missing.length > 0) {
    const lines = missing
      .map((m) => `  - ${m.name}: ${m.description}`)
      .join("\n");
    const msg = `Missing required environment variables:\n${lines}`;
    if (isProd) {
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
  if (process.env.CORS_ALLOW_ALL === "1") {
    return true;
  }
  if (process.env.NODE_ENV !== "production") {
    const origins = new Set<string>();
    const dev = process.env.REPLIT_DEV_DOMAIN;
    if (dev) origins.add(`https://${dev}`);
    const list = (process.env.REPLIT_DOMAINS ?? "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    for (const d of list) origins.add(`https://${d}`);
    origins.add("http://localhost:80");
    return Array.from(origins);
  }
  return [];
}
