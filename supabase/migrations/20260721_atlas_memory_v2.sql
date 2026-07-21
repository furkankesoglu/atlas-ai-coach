create table if not exists public.atlas_memory (
  id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  category text not null check (category in ('injury','preference','goal','habit','performance','nutrition','recovery','other')),
  content text not null check (char_length(content) between 1 and 1000),
  importance integer not null default 60 check (importance between 0 and 100),
  confidence integer not null default 100 check (confidence between 0 and 100),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_used_at timestamptz,
  archived boolean not null default false
);

create index if not exists atlas_memory_user_active_idx
  on public.atlas_memory(user_id, archived, importance desc, updated_at desc);

alter table public.atlas_memory enable row level security;

drop policy if exists "Users can read own atlas memory" on public.atlas_memory;
create policy "Users can read own atlas memory"
  on public.atlas_memory for select
  using (auth.uid() = user_id);

drop policy if exists "Users can insert own atlas memory" on public.atlas_memory;
create policy "Users can insert own atlas memory"
  on public.atlas_memory for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users can update own atlas memory" on public.atlas_memory;
create policy "Users can update own atlas memory"
  on public.atlas_memory for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Users can delete own atlas memory" on public.atlas_memory;
create policy "Users can delete own atlas memory"
  on public.atlas_memory for delete
  using (auth.uid() = user_id);
