# Workspace

## Overview

pnpm workspace monorepo using TypeScript. Each package manages its own dependencies.

The product is the **Logistics Admin Panel** — an enterprise B2B admin app for logistics businesses to manage customers, orders, and tracking events with email notifications.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **Auth**: Supabase Auth (email/password). Frontend uses `@supabase/supabase-js`; backend verifies JWTs via `supabase.auth.getUser(token)`.
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)
- **Security middleware**: `helmet`, `express-rate-limit`, strict allowlisted CORS

## Auth Architecture

- The frontend (`artifacts/olyxee-admin`) wraps the app in `AuthProvider` (`src/contexts/auth-context.tsx`), which hydrates the Supabase session and forwards the access token to the API client via `setAuthTokenGetter`.
- The backend (`artifacts/api-server`) reads the `Authorization: Bearer <jwt>` header in `requireAuth` (`src/lib/auth.ts`), verifies the JWT against Supabase, and resolves the user's `business_id` from the `users` table (provisioning a row + business on first sign-in).
- Multi-tenant isolation has three layers:
  1. **Application**: every backend query is scoped by `business_id`, including JOIN ON conditions for child tables (defense-in-depth in `routes/orders.ts` and `routes/dashboard.ts`).
  2. **Database**: composite foreign key on `orders(customer_id, business_id) → customers(id, business_id)` physically prevents cross-tenant linkage. See `lib/db/migrations/0002_tenant_safe_fk.sql`.
  3. **RLS**: policies in `lib/db/migrations/0001_supabase_rls.sql` restrict any direct PostgREST/Supabase client access to the requester's own `business_id`.
- Olyxee employees (`@olyxee.com`) are auto-attached to the seeded `olyxee` business; everyone else gets a fresh business on first sign-in.

## Production Hardening (security + reliability)

- **CORS**: strict allowlist via `ALLOWED_ORIGINS` env (comma-separated). Same-origin requests (no `Origin` header) are always allowed. **Fail-closed** by default — an unset allowlist refuses cross-origin requests unless `CORS_ALLOW_ALL=1` is set explicitly (dev escape hatch only).
- **Security headers**: `helmet()` enables HSTS, X-Frame-Options, X-Content-Type-Options, and the rest of the standard baseline.
- **Rate limiting**: 300 requests/minute/IP across `/api`, with a stricter 60/min/IP on writes (POST/PUT/PATCH/DELETE).
- **Body size**: JSON and URL-encoded bodies capped at 100kb; oversized payloads return 413.
- **Error mapping**: a final Express error handler maps body-too-large → 413, malformed JSON → 400, CORS rejection → 403; everything else → 500 with the error logged but never surfaced.
- **Env validation**: `artifacts/api-server/src/lib/env.ts` validates required env at boot. In `NODE_ENV=production` it throws if any of (`DATABASE_URL`, Supabase URL, Supabase key, `ALLOWED_ORIGINS`) are missing — the app fails closed instead of serving misconfigured traffic.
- **Audit trail**: `audit_logs` rows are written for `CREATE_ORDER`, `UPDATE_ORDER_STATUS`, `RESEND_EMAIL`, `CREATE_CUSTOMER`, and `UPDATE_CUSTOMER` (with before/after diffs).
- **Transactional writes**: customer create/update writes the customer row and audit row in a single transaction. Order status update writes the tracking event + order row atomically and rolls back if the order disappears mid-flight; the email side-effect is intentionally outside the transaction so a slow SMTP call never holds a DB transaction open.
- **Serverless DB pool**: `lib/db/src/index.ts` detects Vercel/Lambda and caps the pg pool at `max: 1` with shorter idle/connect timeouts; warns if `DATABASE_URL` is not the Supabase pooled URL (port 6543).
- **Trust proxy**: `app.set('trust proxy', 1)` so rate-limit and logging see the real client IP behind Vercel.

## Required Environment Variables

See `.env.example`. Required in **all** environments:

- `DATABASE_URL` — Postgres connection string (Supabase pooled URL on Vercel; port 6543).
- `VITE_SUPABASE_URL` — Supabase project URL (also used by the backend).
- `VITE_SUPABASE_ANON_KEY` — Supabase public anon key.
- `SUPABASE_SERVICE_ROLE_KEY` — Supabase service-role key (server-only).

Required additionally in **production**:

- `ALLOWED_ORIGINS` — comma-separated list of origins allowed to call the API with credentials (e.g. `https://admin.example.com`). Required, no fallback. To allow any origin in development, set `CORS_ALLOW_ALL=1` instead.

Optional:

- `RESEND_API_KEY` — Resend API key. Without it, order status emails are skipped (the order update still succeeds with `emailStatus: "skipped"`).

## Key Commands

- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm run build:vercel` — Vercel-only build: bundles the admin SPA and the api-server serverless handler
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- `pnpm --filter @workspace/api-server run dev` — run API server locally

After pushing the schema to a Supabase Postgres, run the migrations under `lib/db/migrations/` once via the Supabase SQL editor — in order:

1. `0001_supabase_rls.sql` — enables Row Level Security policies.
2. `0002_tenant_safe_fk.sql` — adds the composite tenant foreign key. Read the pre-flight check at the top of the file before running it on a database with existing data.

## Vercel Deployment

The whole project deploys to a single Vercel project at the repo root.

- **Frontend** (`olyxee-admin`) → static SPA served from `artifacts/olyxee-admin/dist/public`
- **Backend** (`api-server`) → bundled into `api/[[...path]].mjs` by `artifacts/api-server/build.mjs` (Build 2). Vercel auto-detects it as a serverless function. The Express app is exported as the default export — Express apps are valid Node HTTP handlers, so Vercel invokes them directly per request.
- **mockup-sandbox** → dev-only, not deployed.

Routing is configured in `vercel.json`:
- `/api/*` → the serverless function (Express handles its own routing via `app.use("/api", router)`)
- everything else → `/index.html` (SPA fallback)

Vercel project settings:
- **Root Directory**: repo root (not an artifact)
- **Build Command**, **Install Command**, **Output Directory**: configured in `vercel.json` — leave the dashboard fields blank/default
- **Environment variables** (set for Production + Preview): `DATABASE_URL`, `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `ALLOWED_ORIGINS`. For `DATABASE_URL` use the **pooled** Supabase connection (port 6543).

The `api/` directory at the repo root is gitignored — it's build output. `.env` and `.env.*` are also gitignored (only `.env.example` is committed).

See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details.
