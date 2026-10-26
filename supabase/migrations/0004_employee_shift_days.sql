-- Every working day's shift total, per employee.
--
-- BUG FIX (audit 2026-10-26) — the employees row only keeps the MOST RECENT
-- shift (lastShiftHours / lastShiftDate). Time on the clock that wasn't
-- logged on a job (driving, shop time, a shift ended before a job was
-- marked complete) from earlier days dropped out of "Hours This Week",
-- the Pay tab and payroll as soon as the employee started a new shift.
-- "End My Day" now also saves the day's total here (one row per employee
-- per shift day, updated if they resume and end again the same day), and
-- weekly hours / pay add up every day in the period. Before this runs, the
-- app falls back to the single last shift as before.
--
-- Run in your Supabase project's SQL Editor. Safe to re-run.
create table if not exists public.employee_shift_days (
  owner_id text not null,
  employee_id text not null,
  date date not null,
  hours numeric not null default 0 check (hours >= 0 and hours <= 24),
  first_clock_in timestamptz,
  last_clock_out timestamptz,
  source text not null default 'app',
  updated_at timestamptz not null default now(),
  primary key (employee_id, date)
);
create index if not exists employee_shift_days_owner_date_idx on public.employee_shift_days (owner_id, date);

alter table public.employee_shift_days enable row level security;
drop policy if exists employee_shift_days_owner_scoped on public.employee_shift_days;
create policy employee_shift_days_owner_scoped on public.employee_shift_days for all
  using (owner_id = current_owner_id()::text)
  with check (owner_id = current_owner_id()::text);
