-- supabase/protocol-schema.sql
-- One-year protocol (Day 1 = 27 Sep 2026).
-- Run ONCE in Supabase > SQL Editor BEFORE deploying the code that uses it.
-- Safe to re-run: every statement is idempotent.

-- ─────────────────────────────────────────────────────────────
-- 1. New columns on daily_logs
--    Inputs:  no_sugar, fast_36h
--    Results: fasting_minutes + p_* flags, computed by the app on save (lib/protocol.ts)
-- ─────────────────────────────────────────────────────────────
alter table public.daily_logs
  add column if not exists no_sugar        boolean default false,
  add column if not exists fast_36h        boolean default false,
  add column if not exists fasting_minutes integer,
  add column if not exists p_fast16        boolean default false,
  add column if not exists p_diet          boolean default false,
  add column if not exists p_steps         boolean default false,
  add column if not exists p_sleep         boolean default false,
  add column if not exists p_strength      boolean default false;

-- ─────────────────────────────────────────────────────────────
-- 2. Partner link: each user stores their partner's login email.
--    A link is live only when both users point at each other.
-- ─────────────────────────────────────────────────────────────
create table if not exists public.protocol_partners (
  user_id       uuid primary key references auth.users(id) on delete cascade,
  partner_email text not null,
  updated_at    timestamptz default now()
);

alter table public.protocol_partners enable row level security;

drop policy if exists "protocol_partners_own_row" on public.protocol_partners;
create policy "protocol_partners_own_row" on public.protocol_partners
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ─────────────────────────────────────────────────────────────
-- 3. Resolve the partner's user id, only for a mutual link.
--    SECURITY DEFINER so it can read auth.users; it only ever answers for auth.uid().
-- ─────────────────────────────────────────────────────────────
create or replace function public.protocol_partner_id()
returns uuid
language sql
stable
security definer
set search_path = public, auth
as $$
  select pu.id
  from public.protocol_partners mine
  join auth.users me            on me.id = mine.user_id
  join auth.users pu            on lower(pu.email) = lower(mine.partner_email)
  join public.protocol_partners theirs on theirs.user_id = pu.id
  where mine.user_id = auth.uid()
    and lower(theirs.partner_email) = lower(me.email)
  limit 1;
$$;

-- ─────────────────────────────────────────────────────────────
-- 4. Partner's protocol flags ONLY. Daily_logs RLS stays owner-only;
--    this function is the single door, and it exposes no weight, food, notes or blood work.
-- ─────────────────────────────────────────────────────────────
create or replace function public.get_partner_protocol(p_from date, p_to date)
returns table (
  log_date   date,
  p_fast16   boolean,
  p_diet     boolean,
  p_steps    boolean,
  p_sleep    boolean,
  p_strength boolean,
  fast_36h   boolean
)
language sql
stable
security definer
set search_path = public
as $$
  select d.log_date::date,
         coalesce(d.p_fast16, false),
         coalesce(d.p_diet, false),
         coalesce(d.p_steps, false),
         coalesce(d.p_sleep, false),
         coalesce(d.p_strength, false),
         coalesce(d.fast_36h, false)
  from public.daily_logs d
  where d.user_id = public.protocol_partner_id()
    and d.log_date::date between p_from and p_to
  order by d.log_date::date;
$$;

-- Only signed-in users can call these
revoke all on function public.protocol_partner_id() from public, anon;
revoke all on function public.get_partner_protocol(date, date) from public, anon;
grant execute on function public.protocol_partner_id() to authenticated;
grant execute on function public.get_partner_protocol(date, date) to authenticated;
