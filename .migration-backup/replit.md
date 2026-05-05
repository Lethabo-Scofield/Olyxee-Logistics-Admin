# Workspace

## Overview

pnpm workspace monorepo using TypeScript. Each package manages its own dependencies.

## Database

- **Development (Replit preview)**: uses the auto-provisioned Replit Postgres via `DATABASE_URL` secret. Schema applied via `pnpm --filter @workspace/db run push`. Seeded with one `businesses` row (slug `olyxee`).
- **Production (Vercel + Supabase)**: schema has been pushed to the user's Supabase project (`SUPABASE_DATABASE_URL` secret in Replit, **must use the Transaction pooler URL** — host `aws-*.pooler.supabase.com:6543`, not the IPv6-only direct connection on `db.*.supabase.co:5432`). Same `businesses` seed row already inserted. For Vercel, set `DATABASE_URL` env var = the Supabase pooler URL (URL-encode any `@` in the password as `%40`).

## Authentication

Clerk Auth (Replit-managed) wired into `artifacts/olyxee-admin` (web) and `artifacts/api-server`.
- Sign-in page: `/sign-in`, sign-up page: `/sign-up`. After successful auth, users land on `/dashboard`.
- All admin routes are guarded client-side via `<Show when="signed-in">`; unauthenticated visitors are redirected to `/sign-in`.
- Server-side: `clerkMiddleware()` is mounted in `artifacts/api-server/src/app.ts`. The `requireAuth` middleware in `artifacts/api-server/src/lib/auth.ts` reads `getAuth(req).userId`, then looks up (or auto-provisions on first sign-in) a row in our `users` table linked to that `clerkUserId`, scoped to the seeded `olyxee` business. The signed-in user's name + email are pulled from Clerk and stored in our DB.
- Sign-out is available in the sidebar user widget (LogOut icon).

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)

## Key Commands

- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- `pnpm --filter @workspace/api-server run dev` — run API server locally

See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details.
