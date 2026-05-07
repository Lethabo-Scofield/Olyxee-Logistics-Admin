import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema";

const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

const isServerless =
  !!process.env.VERCEL ||
  !!process.env.AWS_LAMBDA_FUNCTION_NAME ||
  process.env.SERVERLESS === "true";

const url = process.env.DATABASE_URL;

if (isServerless) {
  const usingPooler =
    url.includes("pooler.supabase.com") || url.includes(":6543");
  if (!usingPooler) {
    console.warn(
      "[db] DATABASE_URL appears to be a direct connection. " +
        "On Vercel/serverless, use Supabase's pooled connection (port 6543, host *.pooler.supabase.com) " +
        "to avoid exhausting Postgres connections.",
    );
  }
}

export const pool = new Pool({
  connectionString: url,
  // In serverless, each invocation has its own pool. Cap at 1 to avoid
  // exhausting the upstream Postgres connection limit during traffic spikes.
  max: isServerless ? 1 : 10,
  idleTimeoutMillis: isServerless ? 10_000 : 30_000,
  connectionTimeoutMillis: 10_000,
});

export const db = drizzle(pool, { schema });

export * from "./schema";
