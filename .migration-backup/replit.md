# Olyxee Admin

Logistics admin panel for managing businesses, customers, orders, tracking events, and email notifications.

## Run & Operate

- Use the configured workflows (`artifacts/olyxee-admin: web`, `artifacts/api-server: API Server`) — do not run `pnpm dev` at the workspace root.
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- `pnpm run typecheck` / `pnpm run build` — full typecheck / build across packages
- Required env: `DATABASE_URL` (provisioned). Optional: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` (frontend auth), `SUPABASE_SERVICE_ROLE_KEY` (server token verification), `RESEND_API_KEY` (order status emails), `ALLOWED_ORIGINS` (prod CORS).

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- Frontend: React 18 + Vite, Tailwind v4, wouter, TanStack Query, Radix UI / shadcn
- API: Express 5, pino logging, helmet, express-rate-limit
- DB: PostgreSQL + Drizzle ORM
- Auth: Supabase (JWT verified server-side)
- API codegen: Orval (React Query hooks + Zod schemas) from OpenAPI

## Where things live

- `artifacts/olyxee-admin/` — frontend (Vite/React)
- `artifacts/api-server/` — Express backend; routes in `src/routes/`
- `lib/api-spec/openapi.yaml` — single source of truth for the API contract
- `lib/api-client-react/src/generated/` — generated React Query hooks
- `lib/api-zod/src/generated/api.ts` — generated Zod schemas
- `lib/db/src/schema/` — Drizzle table definitions

## Architecture decisions

- Ported from a Vercel/Next-style deployment to the Replit `pnpm_workspace` stack; the frontend was already Vite + React, so no Next.js conversion was needed.
- Supabase is used only for auth (JWT issuance + verification); domain data lives in the Replit Postgres via Drizzle.
- API contract is OpenAPI-first — clients and Zod validators are codegenerated; never edit `lib/api-*/src/generated/`.

## Product

Multi-tenant admin app: dashboard summary, customers CRUD, orders CRUD with status updates and email notifications, tracking event timeline, and audit log.

## Gotchas

- After OpenAPI changes, run codegen before typecheck.
- `lib/api-zod/src/index.ts` only re-exports `./generated/api` (no `./generated/types`).
- Workflows wire `PORT` and `BASE_PATH` for the Vite app — running it standalone will throw.

## Pointers

- See the `pnpm-workspace` skill for workspace structure and conventions.
- See the `react-vite` skill for frontend patterns.
