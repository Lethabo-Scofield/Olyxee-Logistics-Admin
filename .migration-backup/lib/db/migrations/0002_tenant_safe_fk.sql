-- =============================================================================
-- Tenant-safe foreign keys between orders and customers
-- =============================================================================
--
-- This migration enforces at the database level that an order's customer must
-- belong to the same business as the order. Before this migration the only
-- guarantee was application-level (verified at insert time) — a buggy code
-- path or a direct DB write could create cross-tenant linkage.
--
-- Run order:
--   1. pnpm --filter @workspace/db run push
--      (drizzle-kit will detect the new constraint + composite FK and apply
--       them; if it asks about dropping the old single-column FK it should
--       be replaced, not dropped without a replacement.)
--   2. If push prompts about data conflicts, run the diagnostic queries
--      in the "Pre-flight checks" section below to find and fix them
--      first.
--
-- Pre-flight checks (run before pushing if you have existing data):
--
--   -- Find any orders whose customer is in a different business:
--   select o.id, o.business_id as order_business, c.business_id as customer_business
--   from orders o
--   join customers c on c.id = o.customer_id
--   where o.business_id <> c.business_id;
--
--   -- The above query MUST return zero rows before this migration succeeds.
--   -- If it returns rows, those orders were created in a state that should
--   -- not have been possible — investigate before continuing.
--
-- Equivalent raw SQL (drizzle-kit will generate this automatically from the
-- updated schema, included here for reference and for manual application):

-- 1. Composite UNIQUE on (id, business_id) so a child table can reference it.
alter table public.customers
  add constraint customers_id_business_id_key unique (id, business_id);

-- 2. Drop the existing single-column FK from orders.customer_id.
alter table public.orders
  drop constraint if exists orders_customer_id_customers_id_fk;

-- 3. Add the composite FK enforcing same-business linkage.
alter table public.orders
  add constraint orders_customer_business_fk
  foreign key (customer_id, business_id)
  references public.customers (id, business_id);
