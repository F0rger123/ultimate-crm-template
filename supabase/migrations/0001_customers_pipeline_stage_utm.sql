-- Leads live in `customers` with "pipelineStage" = 'lead' (Lead Intake,
-- website lead form, customer-portal "Connect" requests). The column was
-- never created on customers, so:
--   - every website lead and every customer-portal "Connect" request was
--     rejected by the database ("Could not find the 'pipelineStage' column"),
--   - Lead Intake could never show a lead after a reload.
-- UTM columns are recorded by the website lead form.
alter table public.customers add column if not exists "pipelineStage" text;
alter table public.customers add column if not exists "utmSource" text;
alter table public.customers add column if not exists "utmMedium" text;
alter table public.customers add column if not exists "utmCampaign" text;
alter table public.customers add column if not exists "utmContent" text;
alter table public.customers add column if not exists "refCode" text;
