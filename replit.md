# Olyxee Enterprise Logistics — Admin Panel

## Overview
Production-ready multi-tenant logistics admin panel for **Olyxee Enterprise Logistics**. Admin side only (no /track page yet).

## Tech Stack
- **Frontend**: React + Vite (`artifacts/olyxee-admin`) at path `/`
- **Backend**: Express 5 (`artifacts/api-server`) at path `/api`
- **Database**: PostgreSQL + Drizzle ORM (`lib/db`)
- **Auth**: Clerk (white-label, proxy via `/api/clerk`)
- **Email**: Resend (configured, needs `RESEND_API_KEY` env var)
- **API Codegen**: OpenAPI spec → React Query hooks + Zod schemas

## Architecture
```
artifacts/
  api-server/       — Express 5 backend (port 8080)
  olyxee-admin/     — React+Vite frontend (port 23915)
lib/
  api-spec/         — OpenAPI YAML + Orval codegen config
  api-zod/          — Zod request/response schemas (generated)
  api-client-react/ — React Query hooks (generated)
  db/               — Drizzle ORM schema + migrations
```

## Database Schema
- `businesses` — multi-tenant root (demo: "Olyxee Enterprise Logistics", id: `71a469ca8c66c3e60e2b5a77b119c335`)
- `users` — admin users linked to businesses via Clerk user ID
- `customers` — shippers/receivers
- `orders` — shipments with auto-generated `OLY-YYYY-XXXXXX` tracking IDs
- `tracking_events` — timeline of order status changes
- `email_notifications` — history of Resend-delivered emails
- `audit_logs` — full activity trail

## Key Files
- `lib/api-spec/openapi.yaml` — Full OpenAPI spec (source of truth)
- `lib/db/src/schema/` — Drizzle table definitions
- `artifacts/api-server/src/lib/auth.ts` — Clerk `requireAuth` middleware (auto-provisions users to demo business)
- `artifacts/api-server/src/lib/email.ts` — Resend email service
- `artifacts/api-server/src/routes/orders.ts` — Order status update + email flow
- `artifacts/olyxee-admin/src/App.tsx` — Router + Clerk provider
- `artifacts/olyxee-admin/src/components/layout.tsx` — Sidebar navigation

## Frontend Pages
- `/` — Landing page (dark hero)
- `/sign-in`, `/sign-up` — Clerk auth pages
- `/dashboard` — Summary metrics + recent orders + status breakdown
- `/customers` — List with search + create
- `/customers/:id` — Detail + edit + order history
- `/orders` — List with search/filter by status + create
- `/orders/:id` — Detail + status update + tracking timeline + email history + resend
- `/audit-logs` — Filterable activity log

## Codegen Workflow
After changing `lib/api-spec/openapi.yaml`, run:
```bash
pnpm --filter @workspace/api-spec run codegen
```
Then ensure `lib/api-zod/src/index.ts` only exports from `"./generated/api"`.

## Demo Data
Pre-seeded: 1 business, 3 customers, 4 orders (statuses: In transit, Delivered, Delayed, Processing), tracking events, email notifications, audit logs.

## Auth Flow
New Clerk sign-ups are auto-provisioned to the demo business (Olyxee) as `admin` role. The `requireAuth` middleware in `auth.ts` handles this with `onConflictDoNothing()` to prevent race conditions.

## Email
Resend integration is wired up. Set `RESEND_API_KEY` in environment secrets to enable live email delivery. Without it, email sends will fail gracefully (status logged as "failed").

## TypeScript
- Frontend: `pnpm --filter @workspace/olyxee-admin exec tsc --noEmit`
- Backend: `pnpm --filter @workspace/api-server exec tsc --noEmit` (requires `pnpm run typecheck:libs` first)
- Libs: `pnpm run typecheck:libs`
