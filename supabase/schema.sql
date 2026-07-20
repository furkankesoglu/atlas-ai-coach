-- ATLAS AI Coach v3 - Supabase database setup
-- Run this entire file in Supabase Dashboard > SQL Editor.

create table if not exists public.atlas_user_state (
  user_id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  app_state jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.atlas_user_state enable row level security;

create policy "Users can read their own ATLAS state"
on public.atlas_user_state
for select
to authenticated
using ((select auth.uid()) = user_id);

create policy "Users can insert their own ATLAS state"
on public.atlas_user_state
for insert
to authenticated
with check ((select auth.uid()) = user_id);

create policy "Users can update their own ATLAS state"
on public.atlas_user_state
for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists atlas_user_state_updated_at on public.atlas_user_state;
create trigger atlas_user_state_updated_at
before update on public.atlas_user_state
for each row execute function public.set_updated_at();
