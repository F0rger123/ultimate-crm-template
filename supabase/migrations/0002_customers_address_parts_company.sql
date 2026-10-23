-- Customer import (CSV / Sheets / Google Contacts) and the address
-- autocomplete set city, state, zip and company on customers, but the table
-- never had those columns — saves dropped them (and, before the tolerant
-- saver in lib/customerImport.ts, failed outright). The full address is also
-- kept in "address", so nothing breaks before this runs; this just lets the
-- separate parts and company be stored too.
alter table public.customers add column if not exists "city" text;
alter table public.customers add column if not exists "state" text;
alter table public.customers add column if not exists "zip" text;
alter table public.customers add column if not exists "company" text;
alter table public.customers add column if not exists "isCommercial" boolean;
alter table public.customers add column if not exists "birthday" text;
