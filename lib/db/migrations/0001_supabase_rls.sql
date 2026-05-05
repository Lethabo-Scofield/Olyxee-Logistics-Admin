-- =============================================================================
-- Multi-tenant Row Level Security policies for Supabase
-- =============================================================================
--
-- Run this migration after `pnpm --filter @workspace/db run push` against your
-- Supabase Postgres. It enables RLS on all tenant-scoped tables and adds
-- policies that restrict every authenticated user to rows belonging to their
-- own `business_id` (looked up via the `users` table by `auth_user_id`).
--
-- The API server uses the service-role key, which bypasses RLS — these
-- policies are defense-in-depth for any direct PostgREST/Supabase client
-- access from the browser.

-- Helper: resolve the current Supabase user's business_id.
create or replace function public.current_business_id()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select business_id
  from public.users
  where auth_user_id = auth.uid()
  limit 1;
$$;

-- ---------- businesses ----------
alter table public.businesses enable row level security;

drop policy if exists businesses_select on public.businesses;
create policy businesses_select on public.businesses
  for select to authenticated
  using (id = public.current_business_id());

drop policy if exists businesses_update on public.businesses;
create policy businesses_update on public.businesses
  for update to authenticated
  using (id = public.current_business_id())
  with check (id = public.current_business_id());

-- ---------- users ----------
alter table public.users enable row level security;

drop policy if exists users_select_self_or_business on public.users;
create policy users_select_self_or_business on public.users
  for select to authenticated
  using (
    auth_user_id = auth.uid()
    or business_id = public.current_business_id()
  );

drop policy if exists users_update_self on public.users;
create policy users_update_self on public.users
  for update to authenticated
  using (auth_user_id = auth.uid())
  with check (auth_user_id = auth.uid());

-- ---------- customers ----------
alter table public.customers enable row level security;

drop policy if exists customers_business_isolation on public.customers;
create policy customers_business_isolation on public.customers
  for all to authenticated
  using (business_id = public.current_business_id())
  with check (business_id = public.current_business_id());

-- ---------- orders ----------
alter table public.orders enable row level security;

drop policy if exists orders_business_isolation on public.orders;
create policy orders_business_isolation on public.orders
  for all to authenticated
  using (business_id = public.current_business_id())
  with check (business_id = public.current_business_id());

-- ---------- tracking_events ----------
alter table public.tracking_events enable row level security;

drop policy if exists tracking_events_business_isolation on public.tracking_events;
create policy tracking_events_business_isolation on public.tracking_events
  for all to authenticated
  using (
    exists (
      select 1
      from public.orders o
      where o.id = tracking_events.order_id
        and o.business_id = public.current_business_id()
    )
  )
  with check (
    exists (
      select 1
      from public.orders o
      where o.id = tracking_events.order_id
        and o.business_id = public.current_business_id()
    )
  );

-- ---------- email_notifications ----------
alter table public.email_notifications enable row level security;

drop policy if exists email_notifications_business_isolation on public.email_notifications;
create policy email_notifications_business_isolation on public.email_notifications
  for all to authenticated
  using (
    exists (
      select 1
      from public.orders o
      where o.id = email_notifications.order_id
        and o.business_id = public.current_business_id()
    )
  )
  with check (
    exists (
      select 1
      from public.orders o
      where o.id = email_notifications.order_id
        and o.business_id = public.current_business_id()
    )
  );

-- ---------- audit_logs ----------
alter table public.audit_logs enable row level security;

drop policy if exists audit_logs_business_isolation on public.audit_logs;
create policy audit_logs_business_isolation on public.audit_logs
  for all to authenticated
  using (business_id = public.current_business_id())
  with check (business_id = public.current_business_id());
