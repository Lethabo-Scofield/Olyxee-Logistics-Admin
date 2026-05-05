# Workspace

## Overview

pnpm workspace monorepo using TypeScript. Each package manages its own dependencies.

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

## Auth Architecture

- The frontend (`artifacts/olyxee-admin`) wraps the app in `AuthProvider` (`src/contexts/auth-context.tsx`), which hydrates the Supabase session and forwards the access token to the API client via `setAuthTokenGetter`.
- The backend (`artifacts/api-server`) reads the `Authorization: Bearer <jwt>` header in `requireAuth` (`src/lib/auth.ts`), verifies the JWT against Supabase, and resolves the user's `business_id` from the `users` table (provisioning a row + business on first sign-in).
- Multi-tenant isolation: every backend query is scoped by `business_id`. RLS policies in `lib/db/migrations/0001_supabase_rls.sql` add a defense-in-depth layer when running against Supabase Postgres.
- Olyxee employees (`@olyxee.com`) are auto-attached to the seeded `olyxee` business; everyone else gets a fresh business on first sign-in.

## Required Environment Variables

See `.env.example`:

- `DATABASE_URL` — Postgres connection string (Supabase Postgres in production).
- `VITE_SUPABASE_URL` — Supabase project URL (also used by the backend).
- `VITE_SUPABASE_ANON_KEY` — Supabase public anon key.
- `SUPABASE_SERVICE_ROLE_KEY` — Supabase service-role key (server-only).

## Key Commands

- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm run build:vercel` — Vercel-only build: bundles the admin SPA and the api-server serverless handler
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- `pnpm --filter @workspace/api-server run dev` — run API server locally

After pushing the schema to a Supabase Postgres, run `lib/db/migrations/0001_supabase_rls.sql` once via the Supabase SQL editor to enable RLS.

## Vercel Deployment

The whole project deploys to a single Vercel project at the repo root.

- **Frontend** (`olyxee-admin`) → static SPA served from `artifacts/olyxee-admin/dist/public`
- **Backend** (`api-server`) → bundled into `api/index.mjs` by `artifacts/api-server/build.mjs` (Build 2). Vercel auto-detects it as a serverless function. The Express app is exported as the default export — Express apps are valid Node HTTP handlers, so Vercel invokes them directly per request.
- **mockup-sandbox** → dev-only, not deployed.

Routing is configured in `vercel.json`:
- `/api/*` → the serverless function (Express handles its own routing via `app.use("/api", router)`)
- everything else → `/index.html` (SPA fallback)

Vercel project settings:
- **Root Directory**: repo root (not an artifact)
- **Build Command**, **Install Command**, **Output Directory**: configured in `vercel.json` — leave the dashboard fields blank/default
- **Environment variables** (set for Production + Preview): `DATABASE_URL`, `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`. For `DATABASE_URL` use the **pooled** Supabase connection (port 6543) — direct connections exhaust quickly under serverless cold-start patterns.

The `api/` directory at the repo root is gitignored — it's build output.

See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details.
