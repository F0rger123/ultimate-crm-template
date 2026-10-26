-- Campaigns, goals, vehicles, maintenance, expenses, accountability check-ins
-- and wins used to live only in each browser's localStorage. So:
--   - text-Alfred (server side) "created a campaign" the owner never saw in
--     the CRM — it had nowhere the app reads to put it,
--   - a vehicle / expense / goal added on the phone never showed on the
--     laptop, and a delete on one device came back from the other.
-- One table holds all of them, one row per item, keyed by (owner, kind, id).
-- A delete sets deleted_at instead of removing the row, so every device
-- (and Alfred) sees the delete and nothing comes back from a stale copy.
-- src/hooks/useCloudCollection.ts syncs it; alfredSmsAgent.ts writes to it.
--
-- Run in your Supabase project's SQL Editor.
create table if not exists public.owner_records (
  owner_id text not null,
  kind text not null,
  id text not null,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  primary key (owner_id, kind, id)
);
alter table public.owner_records enable row level security;

drop policy if exists owner_records_owner_scoped on public.owner_records;
create policy owner_records_owner_scoped on public.owner_records for all
  using (owner_id = current_owner_id()::text)
  with check (owner_id = current_owner_id()::text);

create index if not exists owner_records_owner_kind_updated_idx on public.owner_records (owner_id, kind, updated_at);

-- updated_at moves on every write, so devices can ask "what changed since".
create or replace function public.owner_records_touch() returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;
drop trigger if exists owner_records_touch on public.owner_records;
create trigger owner_records_touch before insert or update on public.owner_records
  for each row execute function public.owner_records_touch();

-- Birthdays (Alfred's birthday campaigns) — also in 0002, repeated here so
-- running only this file is enough.
alter table public.customers add column if not exists "birthday" text;

-- Manual income/expense lines (Budget page; Alfred's imported income).
create table if not exists public.manual_budget_entries (
  id text primary key,
  owner_id text not null,
  kind text not null check (kind in ('income', 'expense')),
  category text not null default 'misc',
  label text not null default '',
  amount numeric not null default 0,
  date date not null default current_date,
  created_at timestamptz not null default now()
);
create index if not exists manual_budget_entries_owner_id_idx on public.manual_budget_entries (owner_id);

alter table public.manual_budget_entries enable row level security;
drop policy if exists manual_budget_entries_owner_scoped on public.manual_budget_entries;
create policy manual_budget_entries_owner_scoped on public.manual_budget_entries
  for all
  using (owner_id = current_owner_id())
  with check (owner_id = current_owner_id());
