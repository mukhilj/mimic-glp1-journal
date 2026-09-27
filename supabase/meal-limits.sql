-- Per-user configurable meal limits.
-- Adds a jsonb column to user_preferences holding an overall bowl cap and
-- per-type (P, V, G, C, R) min/max. A NULL column means "use app defaults"
-- (DEFAULT_MEAL_LIMITS in lib/types.ts). Idempotent: safe to run more than once.
-- Run this in the Supabase SQL Editor BEFORE deploying the code that reads it.

alter table public.user_preferences
  add column if not exists meal_limits jsonb;

comment on column public.user_preferences.meal_limits is
  'Configurable meal limits: { overallMax: number|null, types: { P|V|G|C|R: { min: number, max: number|null } } }. NULL = app default.';
