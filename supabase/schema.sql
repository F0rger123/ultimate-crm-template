-- CRM Starter — baseline database schema.
-- Run once in a fresh Supabase project: Dashboard → SQL Editor → paste → Run.
-- Safe to re-run (IF NOT EXISTS / CREATE OR REPLACE / DROP POLICY IF EXISTS).
--
-- Conventions (see docs/ARCHITECTURE.md):
--   * Every business table carries owner_id and one owner-scoped RLS policy:
--     owner_id = current_owner_id(). current_owner_id() resolves the signed-in
--     user to their employer's owner id (or their own id, for the owner).
--   * camelCase columns are double-quoted on purpose — the app reads/writes
--     them by exact name.
--   * New schema changes after this baseline go in supabase/migrations/ as
--     numbered files (0001_description.sql, ...).

set check_function_bodies = off;

create extension if not exists pgcrypto;

-- ─── Functions ───────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.current_owner_id()
 RETURNS text
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
  select coalesce(
    (select e.owner_id from public.employees e where e.user_id = auth.uid() limit 1),
    auth.uid()::text
  );
$function$;

CREATE OR REPLACE FUNCTION public.append_inbox_message(p_thread_id text, p_message jsonb, p_unread boolean DEFAULT true)
 RETURNS void
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
  update public.inbox_threads
  set messages = coalesce(messages, '[]'::jsonb) || jsonb_build_array(p_message),
      unread = p_unread,
      last_message_at = (p_message->>'ts')::bigint,
      updated_at = now()
  where id = p_thread_id
    and (auth.role() = 'service_role' or owner_id = current_owner_id());
$function$;

CREATE OR REPLACE FUNCTION public.find_or_create_inbox_thread(p_owner_id text, p_channel text, p_contact_phone text, p_contact_name text, p_customer_id text, p_message jsonb, p_unread boolean DEFAULT true)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_id text;
  v_digits text;
  v_owner_id text;
begin
  if auth.role() = 'service_role' then
    v_owner_id := p_owner_id;
  else
    v_owner_id := coalesce(p_owner_id, current_owner_id());
    if p_owner_id is not null and p_owner_id is distinct from current_owner_id() then
      raise exception 'not authorized';
    end if;
  end if;

  v_digits := case when length(regexp_replace(coalesce(p_contact_phone,''), '\D', '', 'g')) = 11
                        and left(regexp_replace(coalesce(p_contact_phone,''), '\D', '', 'g'), 1) = '1'
                   then substring(regexp_replace(coalesce(p_contact_phone,''), '\D', '', 'g') from 2)
                   else regexp_replace(coalesce(p_contact_phone,''), '\D', '', 'g')
              end;

  perform pg_advisory_xact_lock(hashtext(coalesce(v_owner_id, '') || '|' || coalesce(p_channel, '') || '|' || v_digits));

  select id into v_id
  from public.inbox_threads
  where channel = p_channel
    and coalesce(owner_id, '') = coalesce(v_owner_id, '')
    and contact_phone_digits = v_digits
    and v_digits <> ''
  limit 1;

  if v_id is not null then
    update public.inbox_threads
    set messages = coalesce(messages, '[]'::jsonb) || jsonb_build_array(p_message),
        unread = p_unread,
        last_message_at = (p_message->>'ts')::bigint,
        updated_at = now(),
        customer_id = coalesce(customer_id, p_customer_id)
    where id = v_id;
    return v_id;
  end if;

  v_id := gen_random_uuid()::text;
  insert into public.inbox_threads (id, channel, contact_name, contact_phone, customer_id, unread, messages, last_message_at, updated_at, owner_id)
  values (v_id, p_channel, p_contact_name, p_contact_phone, p_customer_id, p_unread, jsonb_build_array(p_message), (p_message->>'ts')::bigint, now(), v_owner_id);
  return v_id;
end;
$function$;

CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  INSERT INTO public.profiles (id, full_name, username)
  VALUES (
    new.id,
    COALESCE(new.raw_user_meta_data->>'full_name', ''),
    COALESCE(new.raw_user_meta_data->>'username', split_part(new.email, '@', 1) || '_' || substr(new.id::text, 1, 4))
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN new;
END;
$function$;

CREATE OR REPLACE FUNCTION public.is_registered_customer_email()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
  select exists (
    select 1 from public.customers
    where lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  );
$function$;

CREATE OR REPLACE FUNCTION public.link_own_employee_by_email()
 RETURNS TABLE(id text, role text, owner_id text, user_id uuid, status text)
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
  update public.employees e
  set user_id = auth.uid()
  where e.id = (
    select id from public.employees
    where lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''))
      and user_id is null
    limit 1
  )
  returning e.id, e.role, e.owner_id, e.user_id, e.status;
$function$;

-- Platform admin (product feedback board moderation). Add your own email:
--   insert into public.platform_admins (email) values ('you@example.com');
CREATE OR REPLACE FUNCTION public.is_platform_admin()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
  select exists (
    select 1 from public.platform_admins
    where lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  );
$function$;

-- ─── Tables ──────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.platform_admins (
  email text NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT platform_admins_pkey PRIMARY KEY (email)
);

CREATE TABLE IF NOT EXISTS public.alfred_actions_log (
  id text NOT NULL,
  owner_id text NOT NULL,
  tool_name text NOT NULL,
  label text NOT NULL,
  undo_kind text NOT NULL,
  undo_payload jsonb DEFAULT '{}'::jsonb NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  undone_at timestamp with time zone,
  CONSTRAINT alfred_actions_log_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.alfred_conversations (
  id text NOT NULL,
  owner_id text DEFAULT current_owner_id() NOT NULL,
  title text,
  messages jsonb DEFAULT '[]'::jsonb,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT alfred_conversations_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.alfred_memory (
  id text NOT NULL,
  owner_id text DEFAULT current_owner_id() NOT NULL,
  text text NOT NULL,
  category text DEFAULT 'general'::text,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT alfred_memory_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.alfred_pending_actions (
  id text NOT NULL,
  owner_id text DEFAULT current_owner_id() NOT NULL,
  customer_id text,
  job_id text,
  kind text NOT NULL,
  proposed jsonb DEFAULT '{}'::jsonb NOT NULL,
  customer_phone text,
  status text DEFAULT 'pending'::text NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  resolved_at timestamp with time zone,
  CONSTRAINT alfred_pending_actions_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.alfred_reminders (
  id text NOT NULL,
  owner_id text DEFAULT current_owner_id() NOT NULL,
  phone text NOT NULL,
  message text NOT NULL,
  due_at timestamp with time zone NOT NULL,
  sent boolean DEFAULT false NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  recurring text,
  CONSTRAINT alfred_reminders_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.alfred_scripts (
  id text NOT NULL,
  owner_id text DEFAULT current_owner_id() NOT NULL,
  category text DEFAULT 'informational'::text NOT NULL,
  title text,
  script_content text NOT NULL,
  status text DEFAULT 'saved'::text NOT NULL,
  source text DEFAULT 'ai_generated'::text NOT NULL,
  photo_url text,
  job_id text,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT alfred_scripts_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.alfred_sms_threads (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  owner_id text DEFAULT current_owner_id() NOT NULL,
  phone text NOT NULL,
  messages jsonb DEFAULT '[]'::jsonb NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT alfred_sms_threads_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.app_settings (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  owner_id text DEFAULT current_owner_id(),
  data jsonb DEFAULT '{}'::jsonb,
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT app_settings_owner_id_key UNIQUE (owner_id),
  CONSTRAINT app_settings_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.automations (
  id text NOT NULL,
  owner_id text NOT NULL,
  data jsonb DEFAULT '{}'::jsonb NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT automations_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.campaigns (
  id text DEFAULT (gen_random_uuid())::text NOT NULL,
  name text NOT NULL,
  description text,
  type text DEFAULT 'email'::text,
  status text DEFAULT 'draft'::text,
  scheduled_at timestamp with time zone,
  sent_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  audience jsonb DEFAULT '[]'::jsonb,
  template_id text,
  sequence jsonb DEFAULT '[]'::jsonb,
  sequenceactive boolean DEFAULT false,
  "sequenceActive" boolean DEFAULT false,
  owner_id text DEFAULT current_owner_id(),
  CONSTRAINT campaigns_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.candidates (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  owner_id text DEFAULT current_owner_id() NOT NULL,
  "firstName" text NOT NULL,
  "lastName" text,
  email text,
  phone text,
  phase text DEFAULT 'Applied'::text NOT NULL,
  notes text,
  source text,
  "resumeUrl" text,
  "sortOrder" bigint DEFAULT (EXTRACT(epoch FROM now()) * (1000)::numeric) NOT NULL,
  "createdAt" timestamp with time zone DEFAULT now() NOT NULL,
  answers jsonb DEFAULT '{}'::jsonb,
  "photoUrl" text,
  strengths text,
  weaknesses text,
  CONSTRAINT candidates_pkey PRIMARY KEY (id)
);

-- Inventory & equipment items (table name kept as "chemicals" for app compatibility).
CREATE TABLE IF NOT EXISTS public.chemicals (
  id text NOT NULL,
  owner_id text DEFAULT current_owner_id() NOT NULL,
  name text NOT NULL,
  "itemType" text DEFAULT 'chemical'::text,
  stock numeric DEFAULT 0,
  unit text,
  "unitCost" numeric DEFAULT 0,
  "reorderLevel" numeric DEFAULT 0,
  supplier text,
  suppliers jsonb DEFAULT '[]'::jsonb,
  notes text,
  "lastOrdered" text,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL,
  brand text,
  "maintenanceContactName" text,
  "maintenanceContactPhone" text,
  category text,
  "itemLink" text,
  photos jsonb DEFAULT '[]'::jsonb,
  CONSTRAINT chemicals_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.cockpit_items (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  owner_id text NOT NULL,
  title text NOT NULL,
  description text DEFAULT ''::text,
  type text DEFAULT 'bug'::text NOT NULL,
  status text DEFAULT 'backlog'::text NOT NULL,
  claude_notes text DEFAULT ''::text,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT cockpit_items_pkey PRIMARY KEY (id),
  CONSTRAINT cockpit_items_status_check CHECK ((status = ANY (ARRAY['backlog'::text, 'in_progress'::text, 'done'::text]))),
  CONSTRAINT cockpit_items_type_check CHECK ((type = ANY (ARRAY['bug'::text, 'idea'::text, 'question'::text])))
);

CREATE TABLE IF NOT EXISTS public.customers (
  id text DEFAULT gen_random_uuid() NOT NULL,
  org_id uuid,
  first_name text,
  last_name text,
  email text,
  phone text,
  address text,
  notes text,
  tags text[] DEFAULT '{}'::text[],
  lead_source text,
  total_spent numeric(12,2) DEFAULT 0,
  created_at timestamp with time zone DEFAULT now(),
  "createdAt" text,
  "totalSpent" numeric DEFAULT 0,
  "leadSource" text,
  "firstName" text,
  "lastName" text,
  addresses jsonb DEFAULT '[]'::jsonb,
  "referralCode" text,
  "customFields" jsonb DEFAULT '[]'::jsonb,
  "dogName" text,
  "propertyNotes" text,
  "sqFootage" text,
  "gateCode" text,
  "hasDog" boolean DEFAULT false,
  "sensitivePlants" text,
  folder text,
  "smsOptIn" boolean DEFAULT false,
  "smsOptInAt" text,
  documents jsonb DEFAULT '[]'::jsonb,
  "smsOptInPending" boolean DEFAULT false,
  "smsOptInPendingAt" text,
  "smsOptOut" boolean DEFAULT false,
  "optOutDate" text,
  "isTestClient" boolean DEFAULT false,
  owner_id text DEFAULT current_owner_id(),
  "leadArchived" boolean DEFAULT false,
  "alfredAutoRespond" boolean DEFAULT false NOT NULL,
  "stripeCustomerId" text,
  "savedPaymentMethodId" text,
  "savedPaymentMethodLabel" text,
  "cardConsentAt" text,
  "recurringPlan" jsonb,
  "referredBy" text,
  "referralCreditOwed" numeric DEFAULT 0,
  "referralCreditApplied" numeric DEFAULT 0,
  "autoChargeRecurringJobs" boolean DEFAULT false,
  "reviewSubmittedAt" timestamp with time zone,
  "pipelineStage" text,
  "utmSource" text,
  "utmMedium" text,
  "utmCampaign" text,
  "utmContent" text,
  "refCode" text,
  "city" text,
  "state" text,
  "zip" text,
  "company" text,
  "isCommercial" boolean,
  "birthday" text,
  CONSTRAINT customers_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.employee_onboarding (
  id text NOT NULL,
  owner_id text DEFAULT current_owner_id() NOT NULL,
  employee_id text NOT NULL,
  items jsonb DEFAULT '[]'::jsonb NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT employee_onboarding_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.employees (
  id text DEFAULT gen_random_uuid() NOT NULL,
  org_id uuid,
  first_name text,
  last_name text,
  email text,
  phone text,
  role text DEFAULT 'technician'::text,
  hourly_rate numeric DEFAULT 20,
  status text DEFAULT 'active'::text,
  permissions jsonb DEFAULT '{"can_clock_in": true, "can_view_pay": true, "can_add_notes": true, "can_view_jobs": true, "can_get_signoff": true, "can_upload_photos": true, "can_view_calendar": true, "can_complete_checklist": true}'::jsonb,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  user_id uuid,
  availability jsonb DEFAULT '[]'::jsonb,
  google_token text,
  google_token_expires_at timestamp with time zone,
  google_refresh_token text,
  google_email text,
  autosynccalendar boolean DEFAULT false,
  shift_start timestamp with time zone,
  lunch_start timestamp with time zone,
  lunch_minutes numeric DEFAULT 0,
  last_shift_hours numeric DEFAULT 0,
  location jsonb,
  "dayClockInAt" bigint,
  "dayLunchStartAt" bigint,
  "dayPausedMinutes" numeric,
  "locationSharing" boolean,
  "lastLocation" jsonb,
  "jobTypeRates" jsonb DEFAULT '{}'::jsonb,
  "managerPermissions" jsonb DEFAULT '{}'::jsonb,
  "recurringDaysOff" jsonb,
  "maxDaysOffPerWeek" numeric,
  "maxDaysOffPerMonth" numeric,
  "firstName" text,
  "lastName" text,
  "hourlyRate" numeric DEFAULT 0,
  "paymentLog" jsonb DEFAULT '[]'::jsonb,
  "paidPeriods" jsonb DEFAULT '[]'::jsonb,
  "paidDays" jsonb DEFAULT '[]'::jsonb,
  "paidJobs" jsonb DEFAULT '{}'::jsonb,
  can_create_invoices boolean DEFAULT false,
  can_send_invoices boolean DEFAULT false,
  can_process_payments boolean DEFAULT false,
  owner_id text,
  "lastShiftHours" numeric,
  "lastShiftDate" text,
  "autoSyncCalendar" boolean DEFAULT true,
  skills jsonb DEFAULT '[]'::jsonb,
  strengths text,
  weaknesses text,
  "isNewHire" boolean DEFAULT false,
  "homeBaseAddress" text,
  CONSTRAINT employees_pkey PRIMARY KEY (id)
);

-- Quotes AND invoices (an invoice is an estimate row with invoiced = true).
CREATE TABLE IF NOT EXISTS public.estimates (
  id text DEFAULT gen_random_uuid() NOT NULL,
  org_id uuid,
  customer_id uuid,
  line_items jsonb DEFAULT '[]'::jsonb,
  subtotal numeric(12,2) DEFAULT 0,
  discount numeric(12,2) DEFAULT 0,
  tax numeric(12,2) DEFAULT 0,
  total numeric(12,2) DEFAULT 0,
  status text DEFAULT 'pending'::text,
  created_at timestamp with time zone DEFAULT now(),
  "createdAt" text,
  "invoicedAt" text,
  "paidAt" text,
  "viewedAt" text,
  "sentAt" text,
  "signedAt" text,
  "validUntil" text,
  viewed boolean DEFAULT false,
  invoiced boolean DEFAULT false,
  notes text,
  terms text,
  "depositRequired" numeric DEFAULT 0,
  "customerId" text,
  "lineItems" jsonb DEFAULT '[]'::jsonb,
  "internalNote" text,
  "estimateType" text DEFAULT 'standard'::text,
  "sigData" text,
  "paidDeposit" numeric DEFAULT 0,
  "paidFull" numeric DEFAULT 0,
  "clientViewedAt" text,
  "paymentFailedAt" text,
  standalone boolean DEFAULT false,
  title text,
  "depositType" text,
  "depositPaidAt" text,
  discounts jsonb,
  "mandatoryDeposit" boolean DEFAULT false,
  "depositAmount" numeric DEFAULT 0,
  owner_id text DEFAULT current_owner_id(),
  "declinedAt" text,
  "declineReason" text,
  "declineReasonCategory" text,
  "refundedAt" text,
  "disputedAt" text,
  "paymentLog" jsonb DEFAULT '[]'::jsonb,
  "depositMandatory" boolean DEFAULT false,
  "jobId" text,
  "stripeInvoiceId" text,
  "squareInvoiceId" text,
  CONSTRAINT estimates_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.expenses (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  org_id uuid,
  date timestamp with time zone DEFAULT now(),
  category text,
  description text,
  amount numeric(12,2) DEFAULT 0,
  vendor text,
  is_cash boolean DEFAULT false,
  tax_deductible boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  owner_id text DEFAULT current_owner_id(),
  CONSTRAINT expenses_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.feedback_items (
  id text NOT NULL,
  title text NOT NULL,
  description text,
  type text DEFAULT 'feature'::text NOT NULL,
  status text DEFAULT 'submitted'::text NOT NULL,
  submitted_by_email text,
  submitted_by_name text,
  submitted_by_uid text,
  admin_note text,
  edited_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT feedback_items_pkey PRIMARY KEY (id),
  CONSTRAINT feedback_items_status_check CHECK ((status = ANY (ARRAY['submitted'::text, 'planned'::text, 'in_progress'::text, 'done'::text, 'declined'::text]))),
  CONSTRAINT feedback_items_type_check CHECK ((type = ANY (ARRAY['bug'::text, 'feature'::text])))
);

CREATE TABLE IF NOT EXISTS public.feedback_votes (
  feedback_id text NOT NULL,
  voter_id text NOT NULL,
  value smallint NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT feedback_votes_pkey PRIMARY KEY (feedback_id, voter_id),
  CONSTRAINT feedback_votes_value_check CHECK ((value = ANY (ARRAY['-1'::integer, 1])))
);

CREATE TABLE IF NOT EXISTS public.general_suppliers (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  owner_id text NOT NULL,
  name text NOT NULL,
  category text,
  phone text,
  email text,
  address text,
  website text,
  notes text,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT general_suppliers_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.inbox_threads (
  id text NOT NULL,
  channel text DEFAULT 'sms'::text NOT NULL,
  contact_name text,
  contact_phone text,
  contact_email text,
  customer_id text,
  unread boolean DEFAULT false,
  messages jsonb DEFAULT '[]'::jsonb,
  last_message_at bigint,
  updated_at timestamp with time zone DEFAULT now(),
  dir text,
  phone text,
  email text,
  owner_id text DEFAULT current_owner_id(),
  contact_phone_digits text GENERATED ALWAYS AS (
    CASE
      WHEN ((length(regexp_replace(COALESCE(contact_phone, ''::text), '\D'::text, ''::text, 'g'::text)) = 11) AND ("left"(regexp_replace(COALESCE(contact_phone, ''::text), '\D'::text, ''::text, 'g'::text), 1) = '1'::text))
        THEN SUBSTRING(regexp_replace(COALESCE(contact_phone, ''::text), '\D'::text, ''::text, 'g'::text) FROM 2)
      ELSE regexp_replace(COALESCE(contact_phone, ''::text), '\D'::text, ''::text, 'g'::text)
    END) STORED,
  CONSTRAINT inbox_threads_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.invites (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  code text NOT NULL,
  employee_name text NOT NULL,
  employee_email text NOT NULL,
  role text DEFAULT 'technician'::text,
  hourly_rate numeric DEFAULT 0,
  created_by uuid,
  used boolean DEFAULT false,
  used_by uuid,
  created_at timestamp with time zone DEFAULT now(),
  used_at timestamp with time zone,
  owner_id text DEFAULT current_owner_id(),
  CONSTRAINT invites_code_key UNIQUE (code),
  CONSTRAINT invites_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.job_requests (
  id text DEFAULT gen_random_uuid() NOT NULL,
  job_id text,
  employee_id text,
  owner_id text DEFAULT current_owner_id(),
  status text DEFAULT 'pending'::text,
  message text,
  denial_reason text,
  created_at timestamp with time zone DEFAULT now(),
  responded_at timestamp with time zone,
  scheduled_date text,
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT job_requests_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.jobs (
  id text DEFAULT gen_random_uuid() NOT NULL,
  status text DEFAULT 'scheduled'::text,
  address text,
  amount numeric(12,2) DEFAULT 0,
  priority text DEFAULT 'normal'::text,
  crew text[] DEFAULT '{}'::text[],
  checklist jsonb DEFAULT '[]'::jsonb,
  photos jsonb DEFAULT '[]'::jsonb,
  equipment text[] DEFAULT '{}'::text[],
  is_recurring boolean DEFAULT false,
  notes text,
  lat numeric,
  lng numeric,
  "customerId" text,
  "scheduledDate" text,
  "scheduledTime" text,
  "pipelineStage" text,
  "isCash" boolean DEFAULT false,
  "internalNotes" text,
  "loggedHours" numeric DEFAULT 0,
  "isRecurring" boolean DEFAULT false,
  "recurringFreq" text,
  "clockInAt" text,
  "noShow" boolean DEFAULT false,
  "cancelReason" text,
  "createdAt" text,
  "laborCost" numeric DEFAULT 0,
  "materialCost" numeric DEFAULT 0,
  "commLog" jsonb DEFAULT '[]'::jsonb,
  "chemicalsUsed" jsonb DEFAULT '[]'::jsonb,
  tags text[],
  attachments jsonb DEFAULT '[]'::jsonb,
  "_showProfit" boolean DEFAULT false,
  "stageChangedAt" text,
  "lostReason" text,
  "googleEventId" text,
  "preChecklist" jsonb DEFAULT '[]'::jsonb,
  "duringChecklist" jsonb DEFAULT '[]'::jsonb,
  "postChecklist" jsonb DEFAULT '[]'::jsonb,
  "signOff" jsonb,
  "rainGuarantee" boolean DEFAULT false,
  "rainGuaranteeDate" text,
  "weatherOverride" boolean DEFAULT false,
  "sqFootage" text,
  "sqFtRate" text,
  "paymentType" text,
  "paymentStatus" text,
  "amountCollected" numeric DEFAULT 0,
  "customerAccepted" boolean DEFAULT false,
  "estimatedDuration" text,
  duration numeric,
  "crewAssignedAt" jsonb,
  "jobType" text DEFAULT 'residential'::text,
  "recurringMode" text,
  "recurringInterval" numeric,
  "recurringWeekdays" jsonb,
  discounts jsonb,
  "completedAt" text,
  "invoiceSentAt" text,
  "organizationId" text,
  "assignedTo" text[],
  "jobNumber" text,
  "customerName" text,
  phone text,
  email text,
  "serviceType" text,
  "estimatedRevenue" numeric DEFAULT 0,
  "actualRevenue" numeric DEFAULT 0,
  "updatedAt" text,
  "jobDate" text,
  tip numeric DEFAULT 0,
  owner_id text DEFAULT current_owner_id(),
  "arrivedAt" bigint,
  "crewGoogleEventIds" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "rescheduleRequested" boolean DEFAULT false,
  "rescheduleRequestNote" text,
  "rescheduleRequestedAt" text,
  "serviceIds" jsonb DEFAULT '[]'::jsonb,
  "needsReschedule" boolean DEFAULT false,
  "skipReviewRequest" boolean DEFAULT false NOT NULL,
  "isWorkOrder" boolean DEFAULT false NOT NULL,
  "workOrderNumber" text,
  "workOrderClient" text,
  "requiresManagerSignoff" boolean DEFAULT false NOT NULL,
  "photoRequirements" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "photoRequirementTags" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "managerSignatureDataUrl" text,
  "managerSignedAt" timestamp with time zone,
  "managerSignedBy" text,
  "workOrderSummary" text,
  "workOrderSummarySentAt" timestamp with time zone,
  "workOrderNotes" jsonb DEFAULT '[]'::jsonb NOT NULL,
  CONSTRAINT jobs_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.mileage_logs (
  id text NOT NULL,
  owner_id text DEFAULT current_owner_id(),
  employee_id text NOT NULL,
  date text NOT NULL,
  "from" text,
  "to" text,
  miles numeric DEFAULT 0 NOT NULL,
  purpose text,
  status text DEFAULT 'pending'::text NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  reviewed_at timestamp with time zone,
  CONSTRAINT mileage_logs_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.organizations (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  name text NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT organizations_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.owner_referral_credits (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  referrer_owner_id text NOT NULL,
  referred_owner_id text NOT NULL,
  referral_code text NOT NULL,
  referrer_discount_percent integer DEFAULT 20 NOT NULL,
  referee_discount_percent integer DEFAULT 20 NOT NULL,
  applied_at timestamp with time zone DEFAULT now() NOT NULL,
  status text DEFAULT 'active'::text NOT NULL,
  CONSTRAINT owner_referral_credits_referred_owner_id_key UNIQUE (referred_owner_id),
  CONSTRAINT owner_referral_credits_pkey PRIMARY KEY (id),
  CONSTRAINT owner_referral_credits_status_check CHECK ((status = ANY (ARRAY['active'::text, 'reversed'::text])))
);

-- Server-only secrets (Twilio, Google refresh token, AI model keys). Only the
-- service role (Cloudflare Functions) can read these — no client policy.
CREATE TABLE IF NOT EXISTS public.owner_secrets (
  owner_id text NOT NULL,
  twilio_account_sid text,
  twilio_auth_token text,
  twilio_from_number text,
  twilio_messaging_service_sid text,
  google_refresh_token text,
  model_keys jsonb DEFAULT '{}'::jsonb NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT owner_secrets_pkey PRIMARY KEY (owner_id)
);

CREATE TABLE IF NOT EXISTS public.owner_square_accounts (
  owner_id text NOT NULL,
  square_access_token text,
  square_location_id text,
  square_application_id text,
  square_mode text DEFAULT 'sandbox'::text NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL,
  square_webhook_signature_key text,
  CONSTRAINT owner_square_accounts_pkey PRIMARY KEY (owner_id),
  CONSTRAINT owner_square_accounts_square_mode_check CHECK ((square_mode = ANY (ARRAY['sandbox'::text, 'production'::text])))
);

CREATE TABLE IF NOT EXISTS public.owner_stripe_accounts (
  owner_id text NOT NULL,
  stripe_publishable_key text,
  stripe_secret_key text,
  stripe_webhook_secret text,
  stripe_mode text DEFAULT 'test'::text NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL,
  stripe_account_id text,
  CONSTRAINT owner_stripe_accounts_pkey PRIMARY KEY (owner_id),
  CONSTRAINT owner_stripe_accounts_stripe_mode_check CHECK ((stripe_mode = ANY (ARRAY['test'::text, 'live'::text])))
);

-- Optional: SaaS billing for the platform itself (functions/api/platform-billing*.ts).
-- An owner with no row here is treated as unlimited.
CREATE TABLE IF NOT EXISTS public.platform_subscriptions (
  owner_id text NOT NULL,
  stripe_customer_id text,
  stripe_subscription_id text,
  status text DEFAULT 'trialing'::text NOT NULL,
  plan text,
  "interval" text,
  trial_ends_at timestamp with time zone,
  current_period_end timestamp with time zone,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL,
  "referralCode" text,
  "referredByCode" text,
  "referralDiscountAppliedAt" timestamp with time zone,
  "trialDiscountEmailSentAt" timestamp with time zone,
  CONSTRAINT platform_subscriptions_pkey PRIMARY KEY (owner_id)
);

CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid NOT NULL,
  org_id uuid,
  full_name text,
  username text,
  role text DEFAULT 'user'::text,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT profiles_username_key UNIQUE (username),
  CONSTRAINT profiles_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.promotions (
  id text NOT NULL,
  owner_id text DEFAULT current_owner_id() NOT NULL,
  name text NOT NULL,
  code text NOT NULL,
  discount_type text DEFAULT 'percentage'::text,
  discount_value numeric DEFAULT 0,
  valid_from text,
  valid_until text,
  usage_limit integer,
  usage_count integer DEFAULT 0,
  created_at timestamp with time zone DEFAULT now(),
  audience jsonb DEFAULT '[]'::jsonb,
  "targetFolders" jsonb DEFAULT '[]'::jsonb,
  "targetTags" jsonb DEFAULT '[]'::jsonb,
  "smsSent" boolean DEFAULT false,
  description text,
  "discountType" text,
  "discountValue" numeric,
  "validFrom" text,
  "validTo" text,
  "serviceRestrictions" jsonb,
  "usageLimit" numeric,
  "audienceTag" text,
  "audienceFolder" text,
  "audienceCity" text,
  "audienceLastServiceBefore" numeric,
  "audienceCustomerIds" jsonb,
  channel text,
  status text DEFAULT 'draft'::text,
  "sentAt" text,
  "sentCount" numeric,
  "openedCount" numeric,
  "redeemedCount" numeric,
  "createdAt" text,
  CONSTRAINT promotions_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.push_subscriptions (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  owner_id text NOT NULL,
  employee_id text,
  customer_id uuid,
  endpoint text NOT NULL,
  p256dh text NOT NULL,
  auth text NOT NULL,
  user_agent text,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT push_subscriptions_endpoint_key UNIQUE (endpoint),
  CONSTRAINT push_subscriptions_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.reviews (
  id text DEFAULT (gen_random_uuid())::text NOT NULL,
  customer_id text NOT NULL,
  job_id text,
  rating integer NOT NULL,
  comment text,
  status text DEFAULT 'pending'::text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  owner_id text DEFAULT current_owner_id(),
  "customerId" text,
  "customerName" text,
  text text,
  "createdAt" text,
  source text,
  CONSTRAINT reviews_pkey PRIMARY KEY (id),
  CONSTRAINT reviews_rating_check CHECK (((rating >= 1) AND (rating <= 5)))
);

CREATE TABLE IF NOT EXISTS public.services (
  id text NOT NULL,
  name text NOT NULL,
  description text,
  price numeric DEFAULT 0,
  category text DEFAULT 'General'::text,
  taxable boolean DEFAULT true,
  "checklistTemplate" jsonb,
  owner_id text DEFAULT current_owner_id(),
  CONSTRAINT services_pkey PRIMARY KEY (id)
);

-- Twilio webhook redelivery guard (MessageSid). Written by the service role.
CREATE TABLE IF NOT EXISTS public.sms_dedupe (
  sid text NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT sms_dedupe_pkey PRIMARY KEY (sid)
);

CREATE TABLE IF NOT EXISTS public.sop_documents (
  id text NOT NULL,
  owner_id text DEFAULT current_owner_id(),
  title text NOT NULL,
  kind text DEFAULT 'markdown'::text NOT NULL,
  content text,
  file_url text,
  frequency text DEFAULT 'general'::text,
  "assignedEmployeeIds" jsonb DEFAULT '[]'::jsonb,
  checklist jsonb DEFAULT '[]'::jsonb,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  is_template boolean DEFAULT false NOT NULL,
  CONSTRAINT sop_documents_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.training_completions (
  id text NOT NULL,
  owner_id text NOT NULL,
  module_id text NOT NULL,
  employee_id text NOT NULL,
  employee_name text,
  score numeric,
  passed boolean DEFAULT false NOT NULL,
  answers jsonb,
  completed_at timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT training_completions_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.training_modules (
  id text NOT NULL,
  owner_id text NOT NULL,
  data jsonb DEFAULT '{}'::jsonb NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT training_modules_pkey PRIMARY KEY (id)
);

-- ─── Indexes ─────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS alfred_actions_log_owner_created_idx ON public.alfred_actions_log USING btree (owner_id, created_at DESC);
CREATE INDEX IF NOT EXISTS alfred_conversations_owner_id_idx ON public.alfred_conversations USING btree (owner_id);
CREATE INDEX IF NOT EXISTS alfred_memory_owner_id_idx ON public.alfred_memory USING btree (owner_id);
CREATE INDEX IF NOT EXISTS alfred_pending_actions_owner_status_idx ON public.alfred_pending_actions USING btree (owner_id, status);
CREATE INDEX IF NOT EXISTS alfred_reminders_due_idx ON public.alfred_reminders USING btree (due_at) WHERE (NOT sent);
CREATE INDEX IF NOT EXISTS alfred_scripts_owner_status_idx ON public.alfred_scripts USING btree (owner_id, status);
CREATE UNIQUE INDEX IF NOT EXISTS alfred_sms_threads_owner_phone_idx ON public.alfred_sms_threads USING btree (owner_id, phone);
CREATE INDEX IF NOT EXISTS automations_owner_id_idx ON public.automations USING btree (owner_id);
CREATE INDEX IF NOT EXISTS chemicals_owner_id_idx ON public.chemicals USING btree (owner_id);
CREATE UNIQUE INDEX IF NOT EXISTS employee_onboarding_employee_id_idx ON public.employee_onboarding USING btree (employee_id);
CREATE INDEX IF NOT EXISTS employee_onboarding_owner_id_idx ON public.employee_onboarding USING btree (owner_id);
CREATE INDEX IF NOT EXISTS employees_email_idx ON public.employees USING btree (email);
CREATE INDEX IF NOT EXISTS employees_user_id_idx ON public.employees USING btree (user_id);
CREATE INDEX IF NOT EXISTS estimates_square_invoice_id_idx ON public.estimates USING btree ("squareInvoiceId") WHERE ("squareInvoiceId" IS NOT NULL);
CREATE INDEX IF NOT EXISTS estimates_stripe_invoice_id_idx ON public.estimates USING btree ("stripeInvoiceId") WHERE ("stripeInvoiceId" IS NOT NULL);
CREATE INDEX IF NOT EXISTS inbox_threads_channel_idx ON public.inbox_threads USING btree (channel);
CREATE INDEX IF NOT EXISTS inbox_threads_contact_phone_idx ON public.inbox_threads USING btree (contact_phone);
CREATE INDEX IF NOT EXISTS inbox_threads_phone_digits_idx ON public.inbox_threads USING btree (owner_id, channel, contact_phone_digits);
CREATE INDEX IF NOT EXISTS job_requests_employee_id_idx ON public.job_requests USING btree (employee_id);
CREATE INDEX IF NOT EXISTS job_requests_job_id_idx ON public.job_requests USING btree (job_id);
CREATE INDEX IF NOT EXISTS job_requests_status_idx ON public.job_requests USING btree (status);
CREATE INDEX IF NOT EXISTS idx_jobs_jobdate ON public.jobs USING btree ("jobDate");
CREATE INDEX IF NOT EXISTS idx_jobs_owner_id ON public.jobs USING btree (owner_id);
CREATE INDEX IF NOT EXISTS idx_jobs_status ON public.jobs USING btree (status);
CREATE INDEX IF NOT EXISTS mileage_logs_employee_id_idx ON public.mileage_logs USING btree (employee_id);
CREATE INDEX IF NOT EXISTS mileage_logs_owner_id_idx ON public.mileage_logs USING btree (owner_id);
CREATE INDEX IF NOT EXISTS mileage_logs_status_idx ON public.mileage_logs USING btree (status);
CREATE UNIQUE INDEX IF NOT EXISTS platform_subscriptions_referral_code_idx ON public.platform_subscriptions USING btree ("referralCode") WHERE ("referralCode" IS NOT NULL);
CREATE INDEX IF NOT EXISTS push_subscriptions_owner_idx ON public.push_subscriptions USING btree (owner_id);
CREATE INDEX IF NOT EXISTS reviews_customerid_idx ON public.reviews USING btree ("customerId");
CREATE INDEX IF NOT EXISTS training_completions_employee_id_idx ON public.training_completions USING btree (employee_id);
CREATE INDEX IF NOT EXISTS training_completions_module_id_idx ON public.training_completions USING btree (module_id);
CREATE INDEX IF NOT EXISTS training_completions_owner_id_idx ON public.training_completions USING btree (owner_id);
CREATE INDEX IF NOT EXISTS training_modules_owner_id_idx ON public.training_modules USING btree (owner_id);

-- ─── Row level security ──────────────────────────────────────────────────────

do $$
declare t text;
begin
  foreach t in array array[
    'platform_admins','alfred_actions_log','alfred_conversations','alfred_memory','alfred_pending_actions',
    'alfred_reminders','alfred_scripts','alfred_sms_threads','app_settings','automations','campaigns',
    'candidates','chemicals','cockpit_items','customers','employee_onboarding','employees','estimates',
    'expenses','feedback_items','feedback_votes','general_suppliers','inbox_threads','invites',
    'job_requests','jobs','mileage_logs','organizations','owner_referral_credits','owner_secrets',
    'owner_square_accounts','owner_stripe_accounts','platform_subscriptions','profiles','promotions',
    'push_subscriptions','reviews','services','sms_dedupe','sop_documents','training_completions',
    'training_modules'
  ] loop
    execute format('alter table public.%I enable row level security', t);
  end loop;
end $$;

-- Standard owner-scoped policy for every business table.
do $$
declare t text;
begin
  foreach t in array array[
    'alfred_actions_log','alfred_conversations','alfred_memory','alfred_pending_actions','alfred_reminders',
    'alfred_scripts','app_settings','automations','campaigns','candidates','chemicals','cockpit_items',
    'customers','employee_onboarding','employees','estimates','expenses','general_suppliers',
    'inbox_threads','job_requests','jobs','mileage_logs','promotions','reviews','services',
    'sop_documents','training_completions','training_modules'
  ] loop
    execute format('drop policy if exists %I on public.%I', t || '_owner_scoped', t);
    execute format('create policy %I on public.%I for all using (owner_id = current_owner_id()) with check (owner_id = current_owner_id())', t || '_owner_scoped', t);
  end loop;
end $$;

drop policy if exists alfred_sms_threads_owner_read on public.alfred_sms_threads;
create policy alfred_sms_threads_owner_read on public.alfred_sms_threads for select using (owner_id = current_owner_id());

drop policy if exists see_own_record on public.employees;
create policy see_own_record on public.employees for select using (user_id = auth.uid());

drop policy if exists invites_delete on public.invites;
create policy invites_delete on public.invites for delete to authenticated using (auth.uid() = created_by);
drop policy if exists invites_owner_scoped_insert on public.invites;
create policy invites_owner_scoped_insert on public.invites for insert to authenticated with check (owner_id = current_owner_id());
drop policy if exists invites_owner_scoped_select on public.invites;
create policy invites_owner_scoped_select on public.invites for select using (owner_id = current_owner_id());
drop policy if exists invites_owner_scoped_update on public.invites;
create policy invites_owner_scoped_update on public.invites for update using (owner_id = current_owner_id());

drop policy if exists "Users can view their organization" on public.organizations;
create policy "Users can view their organization" on public.organizations for select
  using (id in (select profiles.org_id from public.profiles where profiles.id = auth.uid()));

drop policy if exists "Users can view their own profile" on public.profiles;
create policy "Users can view their own profile" on public.profiles for select using (auth.uid() = id);
drop policy if exists "Users can update their own profile" on public.profiles;
create policy "Users can update their own profile" on public.profiles for update using (auth.uid() = id);

drop policy if exists owner_referral_credits_owner_scoped on public.owner_referral_credits;
create policy owner_referral_credits_owner_scoped on public.owner_referral_credits for select
  using ((referrer_owner_id = current_owner_id()) or (referred_owner_id = current_owner_id()));

drop policy if exists platform_subscriptions_owner_read on public.platform_subscriptions;
create policy platform_subscriptions_owner_read on public.platform_subscriptions for select using (owner_id = current_owner_id());

drop policy if exists push_subscriptions_insert on public.push_subscriptions;
create policy push_subscriptions_insert on public.push_subscriptions for insert with check ((owner_id is not null) and (endpoint is not null));
drop policy if exists push_subscriptions_owner_delete on public.push_subscriptions;
create policy push_subscriptions_owner_delete on public.push_subscriptions for delete using (owner_id = current_owner_id());
drop policy if exists push_subscriptions_owner_read on public.push_subscriptions;
create policy push_subscriptions_owner_read on public.push_subscriptions for select using (owner_id = current_owner_id());
drop policy if exists push_subscriptions_update_own on public.push_subscriptions;
create policy push_subscriptions_update_own on public.push_subscriptions for update
  using (owner_id = current_owner_id()) with check ((owner_id is not null) and (endpoint is not null));

drop policy if exists reviews_insert_public on public.reviews;
create policy reviews_insert_public on public.reviews for insert with check (owner_id is not null);

drop policy if exists sms_dedupe_all on public.sms_dedupe;
create policy sms_dedupe_all on public.sms_dedupe for all using (true) with check (true);

-- Product feedback board: everyone reads, signed-in users submit/vote and
-- edit their own items, platform admins moderate.
drop policy if exists feedback_items_public_read on public.feedback_items;
create policy feedback_items_public_read on public.feedback_items for select using (true);
drop policy if exists feedback_items_auth_insert on public.feedback_items;
create policy feedback_items_auth_insert on public.feedback_items for insert with check (auth.uid() is not null);
drop policy if exists feedback_items_admin_update on public.feedback_items;
create policy feedback_items_admin_update on public.feedback_items for update using (is_platform_admin()) with check (is_platform_admin());
drop policy if exists feedback_items_admin_delete on public.feedback_items;
create policy feedback_items_admin_delete on public.feedback_items for delete using (is_platform_admin());
drop policy if exists feedback_items_owner_update on public.feedback_items;
create policy feedback_items_owner_update on public.feedback_items for update
  using (submitted_by_uid = auth.uid()::text) with check (submitted_by_uid = auth.uid()::text);
drop policy if exists feedback_items_owner_delete on public.feedback_items;
create policy feedback_items_owner_delete on public.feedback_items for delete using (submitted_by_uid = auth.uid()::text);
drop policy if exists feedback_votes_public_read on public.feedback_votes;
create policy feedback_votes_public_read on public.feedback_votes for select using (true);
drop policy if exists feedback_votes_own_write on public.feedback_votes;
create policy feedback_votes_own_write on public.feedback_votes for all
  using (voter_id = auth.uid()::text) with check (voter_id = auth.uid()::text);

-- owner_secrets, owner_stripe_accounts, owner_square_accounts, platform_admins:
-- RLS enabled with NO client policies — service role only.

-- ─── Auth trigger ────────────────────────────────────────────────────────────

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- ─── Storage ─────────────────────────────────────────────────────────────────
-- Buckets are public-read (files are addressed by unguessable paths);
-- writes are owner-scoped by the policies below.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
  ('job-media', 'job-media', true, 52428800, '{image/jpeg,image/png,image/webp,image/gif,video/mp4,video/webm,video/quicktime}'::text[]),
  ('customer-docs', 'customer-docs', true, null, null),
  ('alfred-voice', 'alfred-voice', true, null, null)
on conflict (id) do nothing;

drop policy if exists customer_docs_owner_scoped on storage.objects;
create policy customer_docs_owner_scoped on storage.objects for all
  using ((bucket_id = 'customer-docs') and (
    exists (select 1 from public.customers c where c.id = (storage.foldername(objects.name))[1] and c.owner_id = current_owner_id())
    or ((storage.foldername(name))[1] = '_alfred-inbound' and (storage.foldername(name))[2] = current_owner_id())))
  with check ((bucket_id = 'customer-docs') and (
    exists (select 1 from public.customers c where c.id = (storage.foldername(objects.name))[1] and c.owner_id = current_owner_id())
    or ((storage.foldername(name))[1] = '_alfred-inbound' and (storage.foldername(name))[2] = current_owner_id())));

drop policy if exists job_media_owner_scoped on storage.objects;
create policy job_media_owner_scoped on storage.objects for all
  using ((bucket_id = 'job-media') and exists (select 1 from public.jobs j where j.id = (storage.foldername(objects.name))[1] and j.owner_id = current_owner_id()))
  with check ((bucket_id = 'job-media') and exists (select 1 from public.jobs j where j.id = (storage.foldername(objects.name))[1] and j.owner_id = current_owner_id()));

-- ─── Optional: nightly cleanup of stale Alfred chats (requires pg_cron) ──────
-- create extension if not exists pg_cron;
-- select cron.schedule('delete-stale-alfred-conversations', '0 3 * * *',
--   $$ delete from public.alfred_conversations where updated_at < now() - interval '7 days' $$);

-- ─── owner_records + manual_budget_entries (migration 0003) ─────────────────
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
