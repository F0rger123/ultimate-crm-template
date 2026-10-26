// MULTI-TENANT (Phase D) — customer-facing / anonymous data access.
//
// Once RLS is owner_id-scoped (migration 0033_multitenant_owner_scoping.sql),
// NOTHING readable by the anon key resolves for an anonymous visitor or a
// logged-in CUSTOMER session — current_owner_id() only knows how to resolve
// STAFF identity (owner/manager/employee, via the employees table).
// Customers are a third identity type: they sign in through the same
// Supabase Auth project (ClientAuthPortal.tsx) but have no employees row and
// no auth-linking column on `customers` at all — they're matched by email.
//
// Every function below uses the Supabase SERVICE ROLE key (bypasses RLS)
// and returns ONLY the minimal fields the calling page actually needs —
// never a raw table dump — so this is not a re-opening of the "public
// USING(true)" hole RLS just closed. Each action's own comment explains
// what bounds the query (an unguessable id, a verified session email, etc).
import { getOwnerSecrets } from "./_lib/ownerSecrets";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "./_lib/env";
import { getOwnerSecrets, resolveCallerOwnerId } from "./_lib/ownerSecrets";
import { promoUsable } from "../../src/lib/promoRules";


const sb = async (serviceRoleKey: string, path: string, init?: RequestInit) => {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...init,
    headers: { apikey: serviceRoleKey, Authorization: `Bearer ${serviceRoleKey}`, "Content-Type": "application/json", ...(init?.headers || {}) },
  });
  const data = await res.json().catch(() => null);
  return { ok: res.ok, status: res.status, data };
};

// Insert one row, dropping any column this database doesn't have yet
// (PostgREST rejects the whole row over one unknown column). Returns which
// columns were dropped so callers can log it. Used for public inserts
// (lead form, customer portal) so a missing optional column never loses a lead.
const insertTolerant = async (serviceRoleKey: string, table: string, row: Record<string, unknown>) => {
  let current = { ...row };
  const dropped: string[] = [];
  for (let i = 0; i < 8; i++) {
    const res = await sb(serviceRoleKey, table, { method: "POST", headers: { Prefer: "return=representation" }, body: JSON.stringify(current) });
    if (res.ok) return { ...res, dropped };
    const col = (String(res.data?.message || "").match(/Could not find the '([^']+)' column/) || [])[1];
    if (!col || !(col in current) || col === "id" || col === "owner_id") return { ...res, dropped };
    dropped.push(col);
    const { [col]: _omit, ...rest } = current;
    current = rest;
  }
  return { ok: false, status: 500, data: { message: "too many unknown columns" }, dropped };
};

// Verifies a Supabase access token and returns the session's own email —
// used by get_customer_portal_data so a customer can only ever fetch THEIR
// OWN data (matched by their verified JWT email, never a client-claimed one).
const resolveCallerEmail = async (accessToken: string, anonKey: string): Promise<string | null> => {
  if (!accessToken) return null;
  const res = await fetch(`${SUPABASE_URL}/auth/v1/user`, { headers: { apikey: anonKey, Authorization: `Bearer ${accessToken}` } });
  if (!res.ok) return null;
  const user = await res.json().catch(() => null) as any;
  // Only a confirmed e-mail identifies a customer — an unconfirmed sign-up
  // must not see the records of whoever owns that address.
  if (!user?.email || !user?.email_confirmed_at) return null;
  return user.email;
};

export const onRequestPost = async (context: { request: Request; env: Record<string, string> }) => {
  const serviceRoleKey = context.env.SUPABASE_SERVICE_ROLE_KEY;
  const anonKey = SUPABASE_ANON_KEY;
  if (!serviceRoleKey) {
    return json({ error: "Server missing SUPABASE_SERVICE_ROLE_KEY env var — add it in the Cloudflare Pages dashboard, then redeploy." }, 500);
  }

  try {
    const body = await context.request.json() as Record<string, any>;
    const action = body?.action;

    // ── #/estimate/:id (ClientPortal.tsx) — an estimate id is an
    // unguessable UUID-shaped string, acting as a bearer capability the
    // owner handed the customer via a payment/sign link. Returns the
    // estimate row, its customer's display info (no other customers), and
    // the owning business's public branding/Stripe-publishable-key subset —
    // never the full customers/estimates/app_settings tables.
    if (action === "get_estimate") {
      const { id } = body;
      if (!id) return json({ error: "Missing id" }, 400);
      const est = await sb(serviceRoleKey, `estimates?id=eq.${encodeURIComponent(id)}&select=*`);
      const estimate = Array.isArray(est.data) ? est.data[0] : null;
      if (!estimate) return json({ error: "Not found" }, 404);

      const custId = estimate.customerId || estimate.customer_id;
      const cust = custId ? await sb(serviceRoleKey, `customers?id=eq.${encodeURIComponent(custId)}&select=*`) : null;
      const customer = cust && Array.isArray(cust.data) ? cust.data[0] : null;

      const settingsRow = estimate.owner_id
        ? await sb(serviceRoleKey, `app_settings?owner_id=eq.${encodeURIComponent(estimate.owner_id)}&select=data`)
        : null;
      const fullSettings = settingsRow && Array.isArray(settingsRow.data) ? settingsRow.data[0]?.data : null;
      let settings = fullSettings ? publicSettingsSubset(fullSettings) : null;

      // BUG FIX — a Stripe Connect owner's stripe_account_id lives in
      // owner_stripe_accounts, a completely separate table from
      // app_settings, and was never included here at all. Without it, the
      // customer's payment page (ClientPortal.tsx's StripePaymentModal)
      // had no way to tell Stripe.js which connected account it was
      // confirming a payment against, and this same-table lookup also
      // covers the Connect owner's publishable-key fallback (see
      // stripe-action.ts's identical platform-key fallback comment) for
      // the case where fullSettings.stripePublishableKey was never set
      // because the owner used Connect instead of pasting a manual key.
      if (estimate.owner_id) {
        const stripeAcctRow = await sb(serviceRoleKey, `owner_stripe_accounts?owner_id=eq.${encodeURIComponent(estimate.owner_id)}&select=stripe_account_id,stripe_publishable_key`);
        const stripeAcct = Array.isArray(stripeAcctRow.data) ? stripeAcctRow.data[0] : null;
        if (stripeAcct?.stripe_account_id || stripeAcct?.stripe_publishable_key) {
          settings = {
            ...(settings || {}),
            stripeAccountId: stripeAcct.stripe_account_id || "",
            stripePublishableKey: (settings as any)?.stripePublishableKey || stripeAcct.stripe_publishable_key || (stripeAcct.stripe_account_id ? (context.env.STRIPE_PUBLISHABLE_KEY || "") : ""),
          } as any;
        }
      }

      return json({ estimate, customer, settings });
    }

    // ── ClientPortal.tsx (via App.tsx's #/estimate/:id route) — marks
    // clientViewedAt the first time an anonymous visitor opens their
    // estimate/invoice link. BUG FIX — this used to go through a client-side
    // supabase.from("estimates").update(...) call with no session at all,
    // which RLS (owner_id = current_owner_id(), migration 0033) silently
    // rejects for an anonymous caller — "viewed" tracking, the owner
    // notification email, and the Alfred "quote viewed" alert all quietly
    // never fired for this route (the one most customers actually use — see
    // ClientAuthPortal.tsx for the separate logged-in-customer path, which
    // already wrote this field correctly). Same unguessable-id capability
    // model as get_estimate above; only ever sets one timestamp field.
    if (action === "mark_estimate_viewed") {
      const { id } = body;
      if (!id) return json({ error: "Missing id" }, 400);
      const est = await sb(serviceRoleKey, `estimates?id=eq.${encodeURIComponent(id)}&select=id,clientViewedAt`);
      const row = Array.isArray(est.data) ? est.data[0] : null;
      if (!row) return json({ error: "Not found" }, 404);
      if (row.clientViewedAt) return json({ success: true, alreadyViewed: true });
      const upd = await sb(serviceRoleKey, `estimates?id=eq.${encodeURIComponent(id)}`, {
        method: "PATCH",
        headers: { Prefer: "return=minimal" },
        body: JSON.stringify({ clientViewedAt: new Date().toISOString() }),
      });
      if (!upd.ok) return json({ error: "Failed to record view" }, 500);
      return json({ success: true });
    }

    // ── ClientPortal.tsx — "payment security in general, not just
    // packages." A Package/Options estimate's real charge amount depends on
    // which package the customer picked / which optional items they left
    // checked — that choice happens entirely client-side, and the estimate's
    // OWN stored `total` (what stripe-action.ts's getInvoiceAmountCents
    // verifies against) is still whatever it was when the owner first saved
    // it, not the customer's live selection. Recomputes the total SERVER-
    // SIDE from the estimate's own stored line items/packages (a client can
    // only pick WHICH of the owner's own real ids are included — never
    // supply its own price) and persists it, so the invoiceId-based Stripe
    // charge right after this call is verified against the customer's
    // actual selection, not a stale or client-claimed number. Must be
    // called (and awaited) immediately before opening the payment modal.
    if (action === "lock_in_estimate_selection") {
      const { id, selectedPackageId, enabledItemIds } = body;
      if (!id) return json({ error: "Missing id" }, 400);
      const estRes = await sb(serviceRoleKey, `estimates?id=eq.${encodeURIComponent(id)}&select=*`);
      const est = Array.isArray(estRes.data) ? estRes.data[0] : null;
      if (!est) return json({ error: "Not found" }, 404);
      const settingsRow = est.owner_id ? await sb(serviceRoleKey, `app_settings?owner_id=eq.${encodeURIComponent(est.owner_id)}&select=data`) : null;
      const taxRate = Number((Array.isArray(settingsRow?.data) ? settingsRow.data[0]?.data?.taxRate : null)) || 6;
      let subtotal = 0;
      if (est.estimateType === "package") {
        const pkg = (est.packages || []).find((p: any) => p.id === selectedPackageId);
        if (!pkg) return json({ error: "Selected package not found on this estimate" }, 400);
        subtotal = Number(pkg.subtotal) || (pkg.lineItems || []).reduce((s: number, li: any) => s + Number(li.quantity) * Number(li.unitPrice), 0);
      } else if (est.estimateType === "options") {
        const ids = new Set(Array.isArray(enabledItemIds) ? enabledItemIds : []);
        subtotal = (est.lineItems || [])
          .filter((li: any) => li.optional === false || ids.has(li.id))
          .reduce((s: number, li: any) => s + Number(li.quantity) * Number(li.unitPrice), 0);
      } else {
        return json({ error: "This estimate type doesn't need selection lock-in" }, 400);
      }
      const discountsTotal = (Array.isArray(est.discounts) ? est.discounts.reduce((s: number, d: any) => s + (d.type === "percent" ? subtotal * (Number(d.value) || 0) / 100 : Number(d.value) || 0), 0) : 0) + (Number(est.discount) || 0);
      const afterDisc = Math.max(0, subtotal - discountsTotal);
      const tax = Math.round(afterDisc * (taxRate / 100) * 100) / 100;
      const total = Math.round((afterDisc + tax) * 100) / 100;
      const upd = await sb(serviceRoleKey, `estimates?id=eq.${encodeURIComponent(id)}`, {
        method: "PATCH", headers: { Prefer: "return=minimal" },
        body: JSON.stringify({ subtotal: Math.round(subtotal * 100) / 100, tax, total }),
      });
      if (!upd.ok) return json({ error: "Failed to lock in selection" }, 500);
      return json({ success: true, total });
    }

    // ── ClientPortal.tsx (via App.tsx's #/estimate/:id route) — the actual
    // accept/sign/pay action. Bounded to a fixed, narrow set of fields (never
    // arbitrary columns) and matched by estimate id (the same unguessable
    // capability get_estimate above trusts) — this is the one place an
    // anonymous visitor can write, so it must not become a general-purpose
    // "update any estimate field" endpoint. Also inserts the resulting job,
    // inheriting the estimate's own owner_id (never client-supplied).
    if (action === "approve_estimate") {
      const { id, signedAt, sigData, payChoice, paid, totalPaid, payType, job } = body;
      if (!id) return json({ error: "Missing id" }, 400);
      const estRes = await sb(serviceRoleKey, `estimates?id=eq.${encodeURIComponent(id)}&select=owner_id,customerId,paidDeposit,paidFull,status,total`);
      const est = Array.isArray(estRes.data) ? estRes.data[0] : null;
      if (!est) return json({ error: "Not found" }, 404);
      // SECURITY FIX (audit finding) — this never checked the estimate's
      // current status before writing, so approve_estimate could be
      // replayed against an already-signed/already-paid estimate: a new
      // sigData overwrites the original signature, and (since `job` is
      // inserted unconditionally when present) a repeated call with a
      // truthy `job` inserts ANOTHER real job row every time. Once
      // approved, this action is done — reject a replay instead of
      // silently re-processing it.
      if (est.status === "approved") {
        return json({ error: "This estimate has already been approved." }, 409);
      }
      // SECURITY FIX — this used to also write paidAt / paidDeposit / paidFull
      // from what the browser claimed (`paid`, `totalPaid`, `payType`), so
      // anyone with a quote link could mark it paid without paying. Payments
      // are now recorded only by the provider-verified confirm_invoice_payment
      // actions (stripe-action.ts / square-action.ts) and the Stripe webhook;
      // ClientPortal calls confirm right after a payment.
      void payType; void totalPaid;
      const patch: Record<string, any> = { status: "approved", signedAt: signedAt || null, sigData: typeof sigData === "string" ? sigData.slice(0, 500000) : null, payChoice: ["now", "later", "deposit"].includes(payChoice) ? payChoice : null };
      const upd = await sb(serviceRoleKey, `estimates?id=eq.${encodeURIComponent(id)}`, { method: "PATCH", headers: { Prefer: "return=minimal" }, body: JSON.stringify(patch) });
      if (!upd.ok) return json({ error: "Failed to update estimate" }, 500);

      if (job) {
        // The job is built here from the estimate itself — the browser only
        // contributes its checklist. (It used to insert whatever object was
        // sent, amount included.)
        const custRow = est.customerId ? await sb(serviceRoleKey, `customers?id=eq.${encodeURIComponent(est.customerId)}&select=address`) : null;
        const isUuid = (v: any) => typeof v === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
        const list = (v: any) => Array.isArray(v) ? v.slice(0, 100) : [];
        const safeJob = {
          id: isUuid(job.id) ? job.id : crypto.randomUUID(), owner_id: est.owner_id, customerId: est.customerId,
          address: (Array.isArray(custRow?.data) && custRow.data[0]?.address) || "", amount: Number(est.total) || 0,
          status: "scheduled", scheduledDate: "", duration: 2, priority: "normal", crew: [],
          checklist: list(job.checklist), preChecklist: list(job.preChecklist), photos: [], chemicalsUsed: [], equipment: [],
          tags: ["Needs Scheduling"], commLog: [], notes: "From approved estimate #" + String(id).slice(-4).toUpperCase(),
          createdAt: new Date().toISOString().slice(0, 10), estimateId: id,
        };
        const jobIns = await sb(serviceRoleKey, `jobs`, {
          method: "POST", headers: { Prefer: "return=minimal" },
          body: JSON.stringify(safeJob),
        });
        if (!jobIns.ok) console.error("[public-data approve_estimate] job insert failed for estimate", id, "— owner never got a job row for this approval");
      }

      // FEATURE — notify the owner immediately by SMS. This used to be
      // attempted client-side in ClientPortal.tsx using `settings` passed
      // down as a prop, but that prop is the narrow PUBLIC settings payload
      // (never includes twilioSid/token — those are secrets, same reasoning
      // as every other public route in this file) — so `settings?.twilioSid`
      // was always undefined for an actual anonymous visitor and the
      // notification silently never fired. Send it here instead, server-side,
      // using the owner's real saved credentials via the service role.
      try {
        const settingsRes = await sb(serviceRoleKey, `app_settings?owner_id=eq.${encodeURIComponent(est.owner_id)}&select=data`);
        const s = Array.isArray(settingsRes.data) ? settingsRes.data[0]?.data || {} : {};
        // SECURITY FIX — twilioSid/twilioToken moved out of app_settings.data
        // into owner_secrets (migration 0085); `s` above now only ever has a
        // masked placeholder for the token.
        const ownerSecrets = await getOwnerSecrets(est.owner_id, serviceRoleKey);
        if (ownerSecrets?.twilioAccountSid && ownerSecrets?.twilioAuthToken && ownerSecrets?.twilioFromNumber && s.myPhone) {
          const custRes = await sb(serviceRoleKey, `customers?id=eq.${encodeURIComponent(est.customerId)}&select=firstName,lastName`);
          const cust = Array.isArray(custRes.data) ? custRes.data[0] : null;
          const custName = cust ? `${cust.firstName || ""} ${cust.lastName || ""}`.trim() : "A customer";
          const amount = job?.amount != null ? `$${Number(job.amount).toFixed(2)}` : "";
          const msg = `✍️ QUOTE ACCEPTED: ${custName} approved ${amount || "their estimate"}${paid ? " and paid" : " — will pay later"}. New job added to Unscheduled — needs a date.`;
          const auth = `Basic ${btoa(`${ownerSecrets.twilioAccountSid}:${ownerSecrets.twilioAuthToken}`)}`;
          const params = new URLSearchParams({ To: s.myPhone, From: ownerSecrets.twilioFromNumber, Body: msg });
          await fetch(`https://api.twilio.com/2010-04-01/Accounts/${ownerSecrets.twilioAccountSid}/Messages.json`, {
            method: "POST", headers: { Authorization: auth, "Content-Type": "application/x-www-form-urlencoded" }, body: params.toString(),
          });
        }
      } catch (e: any) {
        console.error("[public-data approve_estimate] owner notification failed:", e?.message);
      }

      return json({ success: true });
    }

    if (action === "decline_estimate") {
      const { id, reason, category } = body;
      if (!id) return json({ error: "Missing id" }, 400);
      // SECURITY FIX (audit finding) — same replay guard as approve_estimate:
      // don't let an already-approved (possibly already-paid) estimate be
      // flipped to "rejected" via a direct API call after the fact, and
      // don't let a repeat decline_estimate call silently no-op-but-succeed
      // with a different reason/category overwriting the real one.
      const preCheck = await sb(serviceRoleKey, `estimates?id=eq.${encodeURIComponent(id)}&select=status`);
      const preEst = Array.isArray(preCheck.data) ? preCheck.data[0] : null;
      if (!preEst) return json({ error: "Not found" }, 404);
      if (preEst.status === "approved" || preEst.status === "rejected") {
        return json({ error: preEst.status === "approved" ? "This estimate has already been approved and can't be declined." : "This estimate has already been declined." }, 409);
      }
      const upd = await sb(serviceRoleKey, `estimates?id=eq.${encodeURIComponent(id)}`, {
        method: "PATCH", headers: { Prefer: "return=minimal" },
        body: JSON.stringify({ status: "rejected", declinedAt: new Date().toISOString(), declineReason: reason || "", declineReasonCategory: category || "" }),
      });
      if (!upd.ok) return json({ error: "Failed to update estimate" }, 500);
      return json({ success: true });
    }

    // ── ApplyPage.tsx (#/apply) submit — see migration
    // 0049_hiring_candidates.sql. Same public-write pattern as
    // submit_lead_form below.
    if (action === "submit_job_application") {
      const { ownerId, candidate, resumeBase64, resumeFileName, resumeContentType, photoBase64, photoFileName, photoContentType } = body;
      if (!ownerId || !candidate) return json({ error: "Missing ownerId/candidate" }, 400);
      // FEATURE — resume/photo attachments on a job application. Uploaded
      // here (service role) rather than client-side because customer-docs'
      // storage RLS (migration 0055) is owner-scoped and an anonymous
      // applicant has no session for current_owner_id() to resolve — same
      // reasoning as the Alfred inbound-file staging path.
      const uploadOne = async (b64: string, fileName: string, contentType: string): Promise<string | null> => {
        try {
          const bin = atob(b64);
          const bytes = new Uint8Array(bin.length);
          for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
          const path = `_hiring/${ownerId}/${crypto.randomUUID()}-${fileName || "file"}`;
          const res = await fetch(`${SUPABASE_URL}/storage/v1/object/customer-docs/${path}`, {
            method: "POST",
            headers: { apikey: serviceRoleKey, Authorization: `Bearer ${serviceRoleKey}`, "Content-Type": contentType || "application/octet-stream" },
            body: bytes,
          });
          if (!res.ok) return null;
          return `${SUPABASE_URL}/storage/v1/object/public/customer-docs/${path}`;
        } catch { return null; }
      };
      const extra: Record<string, string> = {};
      if (resumeBase64) { const url = await uploadOne(resumeBase64, resumeFileName, resumeContentType); if (url) extra.resumeUrl = url; }
      if (photoBase64) { const url = await uploadOne(photoBase64, photoFileName, photoContentType); if (url) extra.photoUrl = url; }
      const insert = await sb(serviceRoleKey, `candidates`, { method: "POST", headers: { Prefer: "return=representation" }, body: JSON.stringify({ ...candidate, ...extra, owner_id: ownerId }) });
      if (!insert.ok) return json({ error: "Failed to submit application" }, 500);
      return json({ success: true });
    }

    // ── ApplyPage.tsx — fetch the owner's custom application questions
    // (Settings → Hiring, HiringPage.tsx) before rendering the public form.
    // Narrow field projection, resolved server-side.
    if (action === "get_hiring_form_settings") {
      const { ownerId } = body;
      if (!ownerId) return json({ error: "Missing ownerId" }, 400);
      const row = await sb(serviceRoleKey, `app_settings?owner_id=eq.${encodeURIComponent(ownerId)}&select=data`);
      const data = Array.isArray(row.data) ? row.data[0]?.data : null;
      // FEATURE — mirrors HiringPage.tsx's DEFAULT_HIRING_QUESTIONS so a
      // business that's never touched Application Questions still shows a
      // real starting form on their public Apply link, not a blank one.
      const defaultQuestions = [
        { id: "dq1", type: "text", label: "Do you have reliable transportation?" },
        { id: "dq2", type: "choice", label: "Do you have prior service or field-service experience?", options: ["Yes", "No"] },
        { id: "dq3", type: "choice", label: "What's your availability?", options: ["Full-time", "Part-time", "Weekends only"] },
        { id: "dq4", type: "text", label: "Why do you want to work with us?" },
      ];
      const questions = Array.isArray(data?.hiringQuestions) && data.hiringQuestions.length > 0 ? data.hiringQuestions : defaultQuestions;
      return json({ companyName: data?.companyName || "", questions });
    }

    // ── LeadFormPage.tsx (#/lead-form) submit — same class of bug as
    // public forms: a direct anon-key insert with no owner_id had
    // nothing to satisfy owner_id-scoped RLS's WITH CHECK once that policy
    // went live, so every public lead-form submission silently failed.
    // ownerId comes from this page's own URL (?oid=), added to the embed
    // link generated by LeadIntakePage.tsx.
    if (action === "submit_lead_form") {
      // Website lead form (LeadFormPage.tsx, embedded on each business's own
      // site). The ?oid= in the embed link decides whose Leads list this
      // lands in, so with many businesses on one deployment it must be:
      //  - a real account (not a typo/old link that would file the lead
      //    under nobody, or a made-up id),
      //  - the only thing that sets owner_id — the browser can't pick any
      //    other column either (this used to insert whatever object the
      //    page sent, so a crafted request could set any customer field).
      const { ownerId, customer, website } = body;
      // Honeypot: a hidden "website" field real visitors never fill in.
      if (website) return json({ success: true });
      const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (!ownerId || !UUID_RE.test(String(ownerId)) || !customer || typeof customer !== "object") {
        return json({ error: "This form link is missing the business it belongs to — re-copy the embed code from Lead Intake." }, 400);
      }
      const [settingsRow, ownerRow] = await Promise.all([
        sb(serviceRoleKey, `app_settings?owner_id=eq.${encodeURIComponent(ownerId)}&select=owner_id&limit=1`),
        sb(serviceRoleKey, `employees?owner_id=eq.${encodeURIComponent(ownerId)}&role=eq.owner&select=id&limit=1`),
      ]);
      const ownerExists = (Array.isArray(settingsRow.data) && settingsRow.data.length > 0) || (Array.isArray(ownerRow.data) && ownerRow.data.length > 0);
      if (!ownerExists) return json({ error: "This form isn't connected to an active account — re-copy the embed code from Lead Intake." }, 404);

      const str = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");
      const firstName = str(customer.firstName, 80);
      const phone = str(customer.phone, 40);
      const email = str(customer.email, 200);
      if (!firstName || (!phone && !email)) return json({ error: "Please add your name and a phone number or email." }, 400);
      const smsOptIn = customer.smsOptIn === true;
      const core = {
        id: crypto.randomUUID(), owner_id: ownerId,
        firstName, lastName: str(customer.lastName, 80), email, phone, address: str(customer.address, 300),
        leadSource: str(customer.leadSource, 60) || "Website", notes: str(customer.notes, 2000),
        tags: [], createdAt: new Date().toISOString().slice(0, 10), totalSpent: 0, pipelineStage: "lead",
      };
      const extras = {
        utmSource: str(customer.utmSource, 100) || null, utmMedium: str(customer.utmMedium, 100) || null, utmCampaign: str(customer.utmCampaign, 100) || null,
        smsOptIn, smsOptInAt: smsOptIn ? new Date().toISOString() : null,
      };
      // Optional columns (UTM / SMS consent) may not exist on every schema;
      // retry with the core fields so the lead is never lost over them.
      const insert = await insertTolerant(serviceRoleKey, "customers", { ...core, ...extras });
      if (insert.dropped.length) console.warn("[submit_lead_form] saved without missing columns:", insert.dropped.join(", "));
      if (!insert.ok) { console.error("[submit_lead_form] insert failed:", insert.status, JSON.stringify(insert.data)); return json({ error: "Failed to save lead" }, 500); }
      return json({ success: true });
    }

    // ── ReferralLanding.tsx (#/r/CODE) — referral codes are random,
    // unguessable per-customer strings; returns only display fields, never
    // the customer's own PII beyond what the landing page already showed
    // (first name, referral reward context).
    if (action === "get_referral_customer") {
      const { code } = body;
      if (!code) return json({ error: "Missing code" }, 400);
      const row = await sb(serviceRoleKey, `customers?referralCode=eq.${encodeURIComponent(code)}&select=id,firstName,lastName,referralCode,owner_id`);
      const customer = Array.isArray(row.data) ? row.data[0] : null;
      if (!customer) return json({ error: "Not found" }, 404);
      return json({ customer });
    }

    // BUG FIX — "referral codes don't work." ReferralLanding.tsx's own signup
    // form used to ONLY call the local (React-state, localStorage-backed)
    // setCustomers() — with no Supabase insert at all, even before RLS went
    // owner_id-scoped. An anonymous referral signup never reached the
    // `customers` table, so it silently vanished on refresh and never
    // appeared anywhere in the owner's real CRM — same class of bug the
    // lead-form fixes above already closed for their own
    // public forms. Mirrors those: service-role insert, owner_id from the
    // referrer's own record (resolved server-side via get_referral_customer,
    // never trusted from the client), safe-column retry on the optional
    // opt-in/Stripe fields a fresh deployment might not have yet.
    if (action === "submit_referral_signup") {
      const { ownerId, customer } = body;
      if (!ownerId || !customer) return json({ error: "Missing ownerId/customer" }, 400);
      const payload = { ...customer, owner_id: ownerId };
      let insert = await sb(serviceRoleKey, `customers`, { method: "POST", headers: { Prefer: "return=representation" }, body: JSON.stringify(payload) });
      if (!insert.ok) {
        // BUG FIX — "make sure referrals actually work." referredBy was
        // missing from this retry's strip list (added by migration
        // 0079_referral_columns.sql, which any deployment that hasn't run
        // it yet still lacks) — every referral signup insert was failing
        // outright with no fallback at all, the exact "referrals silently
        // don't work" symptom this was meant to guard against.
        const { smsOptIn, smsOptInAt, stripeCustomerId, savedPaymentMethodId, savedPaymentMethodLabel, referredBy, ...core } = payload;
        insert = await sb(serviceRoleKey, `customers`, { method: "POST", headers: { Prefer: "return=representation" }, body: JSON.stringify(core) });
      }
      if (!insert.ok) { console.error("[submit_referral_signup] insert failed, status:", insert.status); return json({ error: "Failed to save referral signup" }, 500); }
      return json({ success: true });
    }

    // ── CustomerReviewPage.tsx (#/rate) — resolves owner_id server-side
    // from the customerId already in the review link, so the link itself
    // doesn't need to change, and inserts with the service role (the public
    // reviews_insert_public RLS policy still requires owner_id non-null as
    // defense in depth, but this is now the actual write path).
    if (action === "submit_review") {
      const { customerId, rating, comment } = body;
      if (!customerId || !rating) return json({ error: "Missing customerId/rating" }, 400);
      const custRow = await sb(serviceRoleKey, `customers?id=eq.${encodeURIComponent(customerId)}&select=owner_id,firstName,lastName`);
      const cust = Array.isArray(custRow.data) ? custRow.data[0] : null;
      const ownerId = cust?.owner_id;
      if (!ownerId) return json({ error: "Customer not found" }, 404);
      // BUG FIX — this used to insert customer_id/job_id/comment, none of
      // which exist as columns on `reviews` (see migration
      // 0030_reviews_table.sql: id/"customerId"/"customerName"/rating/text/
      // "createdAt"/source/status — no job column at all). PostgREST rejects
      // an insert containing any unrecognized column (same whole-write
      // failure mode docs/ARCHITECTURE.md documents for updates), so this 500'd on
      // every single public review submission — the actual root cause of
      // "reviews aren't showing" (nothing was ever making it into the table).
      // BUG FIX — "I left a review and it didn't show in the owner CRM."
      // `status` on this table has two different meanings colliding: for
      // an owner-INITIATED review request it's a real pending→sent→
      // completed lifecycle, but this row is a customer's OWN direct
      // submission through the public #/rate link — there was never a
      // "request" step to begin with, so it's already complete the moment
      // it's submitted. Saving it as "pending" put it in the same bucket
      // as a request that hasn't been sent yet — ReviewsPage.tsx's
      // Showcase Wall and "completed" stat only ever count status ===
      // "completed", so a real submitted review sat there forever showing
      // a nonsensical "Send" button instead of appearing as what it is.
      // BUG FIX — "reviews are still not showing, they don't even show up."
      // The reviews table has TWO customer-id columns from an earlier schema
      // migration: legacy `customer_id` (snake_case, NOT NULL, no default)
      // and the newer `customerId` (camelCase, nullable) this insert was
      // actually writing. Every single public review submission has been
      // silently failing the NOT NULL constraint on `customer_id` since this
      // endpoint was written — confirmed via a live query showing ZERO rows
      // ever landed in this table, for any owner, ever. The endpoint
      // returned a real error either way (see `if (!insert.ok)` below), but
      // CustomerReviewPage.tsx deliberately shows the same friendly "Thank
      // you!" screen to the customer regardless of success/failure (so a
      // real submission failure never looked scary to them) — which meant
      // this was invisible to everyone, including the owner, until traced
      // directly against the database.
      const insert = await sb(serviceRoleKey, `reviews`, {
        method: "POST",
        headers: { Prefer: "return=representation" },
        body: JSON.stringify({
          id: crypto.randomUUID(),
          customer_id: customerId, customerId, customerName: cust ? `${cust.firstName || ""} ${cust.lastName || ""}`.trim() : undefined,
          rating, comment: comment || null, text: comment || null, createdAt: new Date().toISOString(),
          source: "customer-submitted", owner_id: ownerId, status: "completed",
        }),
      });
      if (!insert.ok) { console.error("[submit_review] insert failed, status:", insert.status); return json({ error: "Failed to submit review" }, 500); }
      // FEATURE — "prompt the customer to leave a review in the portal if
      // they haven't yet." Stamps once so ClientAuthPortal.tsx can hide the
      // nudge after a real submission (best-effort — the review itself
      // already saved above regardless of whether this succeeds).
      sb(serviceRoleKey, `customers?id=eq.${encodeURIComponent(customerId)}`, {
        method: "PATCH", headers: { Prefer: "return=minimal" },
        body: JSON.stringify({ reviewSubmittedAt: new Date().toISOString() }),
      }).catch(() => {});
      return json({ success: true, review: Array.isArray(insert.data) ? insert.data[0] : insert.data });
    }

    // ── ClientPortal.tsx (#/estimate/:id) promo/referral redemption on
    // estimate approval — SECURITY/SYNC FIX (audit finding). The client used
    // to write these directly from the anonymous customer's own (sessionless)
    // Supabase client, which the owner_id-scoped RLS on `promotions`/
    // `customers` silently rejects with the same 0-row-silent-success pattern
    // documented in docs/ARCHITECTURE.md — a promo's usageLimit was never actually
    // enforced end-to-end and referrers never actually got credited. Mirrors
    // submit_review below: resolves owner_id server-side from the promo/
    // referrer row itself, never trusted from the client, and writes with the
    // service role.
    // SECURITY FIX — both used to run on every call with no limit: anyone
    // could add referral credit (money the business owes a customer) over
    // and over, or use up a promo's redemptions. Now each needs the quote it
    // was used on — same business, a different customer than the referrer —
    // and counts once per quote (sms_dedupe is the shared once-only table).
    const oncePerQuote = async (kind: string, estimateId: string, ownerId: string, notCustomerId?: string): Promise<string | null> => {
      if (!estimateId) return "Missing estimateId";
      const estRow = await sb(serviceRoleKey, `estimates?id=eq.${encodeURIComponent(estimateId)}&select=owner_id,customerId,status`);
      const est = Array.isArray(estRow.data) ? estRow.data[0] : null;
      if (!est || est.owner_id !== ownerId || est.status === "rejected") return "That quote doesn't match.";
      if (notCustomerId && est.customerId === notCustomerId) return "A customer can't refer themselves.";
      const ins = await sb(serviceRoleKey, `sms_dedupe`, { method: "POST", headers: { Prefer: "resolution=ignore-duplicates,return=representation" }, body: JSON.stringify({ sid: `${kind}:${estimateId}` }) });
      if (ins.ok && Array.isArray(ins.data) && ins.data.length === 0) return "Already counted for this quote.";
      return null;
    };
    if (action === "redeem_promotion") {
      const { promoId } = body;
      if (!promoId) return json({ error: "Missing promoId" }, 400);
      const promoRow = await sb(serviceRoleKey, `promotions?id=eq.${encodeURIComponent(promoId)}&select=id,redeemedCount,owner_id`);
      const promo = Array.isArray(promoRow.data) ? promoRow.data[0] : null;
      if (!promo) return json({ error: "Promotion not found" }, 404);
      const notOk = await oncePerQuote("promo", String(body.estimateId || ""), promo.owner_id);
      if (notOk) return json({ error: notOk }, 409);
      const upd = await sb(serviceRoleKey, `promotions?id=eq.${encodeURIComponent(promoId)}&select=id`, {
        method: "PATCH", headers: { Prefer: "return=representation" },
        body: JSON.stringify({ redeemedCount: (Number(promo.redeemedCount) || 0) + 1 }),
      });
      if (!upd.ok || !Array.isArray(upd.data) || upd.data.length === 0) { console.error("[redeem_promotion] update failed, status:", upd.status); return json({ error: "Failed to redeem promotion" }, 500); }
      return json({ success: true });
    }
    if (action === "credit_referral") {
      const { referrerId } = body;
      if (!referrerId) return json({ error: "Missing referrerId" }, 400);
      const custRow = await sb(serviceRoleKey, `customers?id=eq.${encodeURIComponent(referrerId)}&select=id,referralCreditOwed,owner_id`);
      const cust = Array.isArray(custRow.data) ? custRow.data[0] : null;
      if (!cust) return json({ error: "Referrer not found" }, 404);
      const ownerId = cust.owner_id;
      if (!ownerId) return json({ error: "Referrer has no owner_id" }, 400);
      const notOk = await oncePerQuote("referral", String(body.estimateId || ""), ownerId, referrerId);
      if (notOk) return json({ error: notOk }, 409);
      const settingsRow = await sb(serviceRoleKey, `app_settings?owner_id=eq.${encodeURIComponent(ownerId)}&select=data&limit=1`);
      const referrerCredit = Number(settingsRow.ok && Array.isArray(settingsRow.data) ? settingsRow.data[0]?.data?.referralSettings?.referrerCredit : 0) || 0;
      const nextCredit = (Number(cust.referralCreditOwed) || 0) + referrerCredit;
      const upd = await sb(serviceRoleKey, `customers?id=eq.${encodeURIComponent(referrerId)}&select=id`, {
        method: "PATCH", headers: { Prefer: "return=representation" },
        body: JSON.stringify({ referralCreditOwed: nextCredit }),
      });
      if (!upd.ok || !Array.isArray(upd.data) || upd.data.length === 0) { console.error("[credit_referral] update failed, status:", upd.status); return json({ error: "Failed to credit referrer" }, 500); }
      return json({ success: true, referralCreditOwed: nextCredit });
    }

    // ── ClientPortal.tsx (#/estimate/:id) payment/sign confirmation texts —
    // sent from an unauthenticated customer-facing page (no owner session),
    // so a direct client-side insert against inbox_threads (owner_id-scoped
    // RLS) silently fails there just like the pre-fix submit_review did.
    // Bounded by customerId (an unguessable UUID the page already has from
    // the estimate it's viewing), never a client-claimed owner_id.
    if (action === "log_outbound_sms") {
      const { customerId, contactName, contactPhone, smsBody } = body;
      if (!customerId || !contactPhone || !smsBody) return json({ error: "Missing customerId/contactPhone/smsBody" }, 400);
      const custRow = await sb(serviceRoleKey, `customers?id=eq.${encodeURIComponent(customerId)}&select=owner_id,phone`);
      const ownerId = Array.isArray(custRow.data) ? custRow.data[0]?.owner_id : null;
      if (!ownerId) return json({ error: "Customer not found" }, 404);
      const normPhone = (p: string) => (p || "").replace(/\D/g, "");
      // Only that customer's own number (this needs no sign-in).
      if (normPhone(custRow.data[0]?.phone).slice(-10) !== normPhone(contactPhone).slice(-10)) return json({ error: "Phone doesn't match this customer" }, 400);
      const existingRow = await sb(serviceRoleKey, `inbox_threads?channel=eq.sms&owner_id=eq.${encodeURIComponent(ownerId)}&select=*`);
      const rows: any[] = Array.isArray(existingRow.data) ? existingRow.data : [];
      const existing = rows.find(r => normPhone(r.contact_phone) === normPhone(contactPhone));
      const newMsg = { id: crypto.randomUUID(), dir: "out", body: smsBody, ts: Date.now(), status: "sent" };
      if (existing) {
        // BUG FIX — "my SMS inbox messages disappeared from one
        // conversation." Same class of bug fixed everywhere else in this
        // codebase: reading messages then PATCHing a brand-new array back
        // can silently discard another appender's message that landed in
        // the gap between the read and this write. append_inbox_message
        // does the append inside one atomic UPDATE instead.
        await sb(serviceRoleKey, `rpc/append_inbox_message`, {
          method: "POST", body: JSON.stringify({ p_thread_id: existing.id, p_message: newMsg, p_unread: false }),
        });
      } else {
        await sb(serviceRoleKey, `inbox_threads`, {
          method: "POST",
          body: JSON.stringify({ id: crypto.randomUUID(), channel: "sms", contact_name: contactName || "", contact_phone: contactPhone, customer_id: customerId, owner_id: ownerId, unread: false, messages: [newMsg], last_message_at: newMsg.ts, updated_at: new Date().toISOString() }),
        });
      }
      return json({ success: true });
    }

    // ── ClientAuthPortal.tsx (#/client) — a logged-in customer's own data.
    // Bounded by their VERIFIED session email (via resolveCallerEmail),
    // never a client-claimed id — a customer can only ever fetch their own
    // record and the jobs/estimates linked to it, matching what the old
    // (pre-RLS) email-matched `.find()` against the global arrays used to
    // return, just resolved server-side instead of from an unfiltered
    // client-side table dump.
    if (action === "get_customer_portal_data") {
      const accessToken = (context.request.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
      const email = await resolveCallerEmail(accessToken, anonKey);
      if (!email) return json({ error: "Not signed in" }, 401);
      // MULTI-BUSINESS — a customer can be a customer of more than one
      // business on this platform (e.g. one company services their
      // house, a different one mows their lawn), all through the same
      // login. This used to grab only custRow.data[0] — a customer with
      // more than one matching row (one per business) would silently only
      // ever see the first, and there was no way to add a second business
      // from inside the portal at all. Now returns one "account" per
      // matching customer row.
      const custRow = await sb(serviceRoleKey, `customers?email=ilike.${encodeURIComponent(email)}&select=*`);
      const custList: any[] = Array.isArray(custRow.data) ? custRow.data : [];
      if (custList.length === 0) return json({ accounts: [] });

      const accounts = await Promise.all(custList.map(async (customer: any) => {
        const [jobsRow, estRow] = await Promise.all([
          sb(serviceRoleKey, `jobs?customerId=eq.${encodeURIComponent(customer.id)}&select=*`),
          sb(serviceRoleKey, `estimates?customerId=eq.${encodeURIComponent(customer.id)}&select=*`),
        ]);
        // BUG FIX — ClientAuthPortal.tsx (#/client) used to render off
        // App.tsx's GLOBAL `settings` prop for its Stripe calls, which is
        // populated from that DEVICE's own localStorage/owner_id-scoped RLS
        // fetch — empty by default on a real customer's own phone, since
        // they're not the owner and have no session that resolves
        // current_owner_id(). This resolves and returns the real owning
        // business's public branding + Stripe publishable key/Connect
        // account id, the same way get_estimate already does for the
        // separate #/estimate/:id link flow.
        let settings: any = null;
        if (customer.owner_id) {
          const [settingsRow, stripeAcctRow] = await Promise.all([
            sb(serviceRoleKey, `app_settings?owner_id=eq.${encodeURIComponent(customer.owner_id)}&select=data`),
            sb(serviceRoleKey, `owner_stripe_accounts?owner_id=eq.${encodeURIComponent(customer.owner_id)}&select=stripe_account_id,stripe_publishable_key`),
          ]);
          const fullSettings = Array.isArray(settingsRow.data) ? settingsRow.data[0]?.data : null;
          const stripeAcct = Array.isArray(stripeAcctRow.data) ? stripeAcctRow.data[0] : null;
          settings = {
            ...(fullSettings ? publicSettingsSubset(fullSettings) : {}),
            stripeAccountId: stripeAcct?.stripe_account_id || "",
            stripePublishableKey: fullSettings?.stripePublishableKey || stripeAcct?.stripe_publishable_key || (stripeAcct?.stripe_account_id ? (context.env.STRIPE_PUBLISHABLE_KEY || "") : ""),
          };
        }
        // Coupons this customer can use right now (same rule as checkout —
        // src/lib/promoRules.ts): started, not expired, not used up, and
        // either for everyone or made for this customer. Drafts the owner
        // never sent aren't shown.
        let coupons: any[] = [];
        if (customer.owner_id) {
          const pr = await sb(serviceRoleKey, `promotions?owner_id=eq.${encodeURIComponent(customer.owner_id)}&select=*`);
          coupons = (Array.isArray(pr.data) ? pr.data : [])
            .filter((p: any) => p.code && p.status !== "draft" && promoUsable(p, { customerId: customer.id }))
            .map((p: any) => ({ id: p.id, name: p.name, description: p.description || "", code: p.code, discountType: p.discountType, discountValue: Number(p.discountValue) || 0, validFrom: p.validFrom || null, validTo: p.validTo || null, justForYou: p.audience === "individual" }))
            .sort((a: any, b: any) => String(a.validTo || "9999").localeCompare(String(b.validTo || "9999")));
        }
        return { customer, jobs: jobsRow.data || [], estimates: estRow.data || [], settings, coupons };
      }));

      return json({ accounts });
    }

    // ── ClientAuthPortal.tsx "Find & Connect" — lets a customer search
    // businesses on this platform by name before they've been added as a
    // customer anywhere. Returns only public, non-secret fields (company
    // name + phone), never a raw app_settings dump.
    if (action === "search_businesses") {
      const q = String(body.query || "").trim();
      if (q.length < 2) return json({ businesses: [] });
      const rows = await sb(serviceRoleKey, `app_settings?select=owner_id,data`);
      const all: any[] = Array.isArray(rows.data) ? rows.data : [];
      // Ignore case, spaces and punctuation, so "joes" finds "Joe's".
      const norm = (v: string) => String(v || "").toLowerCase().replace(/[^a-z0-9]/g, "");
      const needle = norm(q);
      if (!needle) return json({ businesses: [] });
      // Also matches the business phone, owner name and city, and every
      // word separately ("joe clean" finds "Joe's Cleaning Co");
      // best matches first so the right business is always at the top.
      const digitsQ = q.replace(/\D/g, "");
      const words = q.toLowerCase().split(/\s+/).map(norm).filter(w => w.length >= 2);
      const scored = all.map(r => {
        const d = r.data || {};
        const name = norm(d.companyName);
        if (!name) return null;
        const hay = [name, norm(d.ownerName), norm(d.companyAddress), norm(d.companyCity)].join(" ");
        let score = 0;
        if (name === needle) score = 100;
        else if (name.startsWith(needle)) score = 80;
        else if (name.includes(needle)) score = 60;
        else if (words.length > 1 && words.every(w => hay.includes(w))) score = 40;
        else if (digitsQ.length >= 7 && String(d.companyPhone || "").replace(/\D/g, "").includes(digitsQ)) score = 50;
        else if (needle.length >= 3 && hay.includes(needle)) score = 20;
        return score ? { r, score } : null;
      }).filter(Boolean) as { r: any; score: number }[];
      scored.sort((a, b) => b.score - a.score || String(a.r.data?.companyName).localeCompare(String(b.r.data?.companyName)));
      const seen = new Set<string>();
      const matches = scored.filter(x => !seen.has(x.r.owner_id) && seen.add(x.r.owner_id)).slice(0, 20)
        .map(({ r }) => ({ ownerId: r.owner_id, companyName: r.data?.companyName || "Unnamed business", companyPhone: r.data?.companyPhone || "", logoUrl: r.data?.logoUrl || r.data?.companyLogo || "", city: r.data?.companyCity || "" }));
      return json({ businesses: matches });
    }

    // ── ClientAuthPortal.tsx "Find & Connect" — the customer picked a
    // business; create a pending customer record under it. Lands with
    // pipelineStage "lead" so it surfaces in that owner's existing Lead
    // Intake page (same sort/filter/actions already built for that list) —
    // the owner approves by converting it to a customer from there, same as
    // any other inbound lead, rather than a brand-new approval UI.
    if (action === "request_customer_link") {
      const accessToken = (context.request.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
      const email = await resolveCallerEmail(accessToken, anonKey);
      if (!email) return json({ error: "Not signed in" }, 401);
      const { ownerId, firstName, lastName, phone } = body;
      if (!ownerId) return json({ error: "Missing ownerId" }, 400);
      const existing = await sb(serviceRoleKey, `customers?owner_id=eq.${encodeURIComponent(ownerId)}&email=ilike.${encodeURIComponent(email)}&select=id`);
      // Already connected (or already asked) — just open that account.
      if (Array.isArray(existing.data) && existing.data.length > 0) return json({ success: true, alreadyConnected: true });
      const insert = await insertTolerant(serviceRoleKey, "customers", {
          id: crypto.randomUUID(), owner_id: ownerId, email, firstName: String(firstName || "New").slice(0, 80), lastName: String(lastName || "Customer").slice(0, 80),
          // address/notes included like submit_lead_form — the insert used to
          // omit them and was rejected, so "Connect" always failed.
          phone: String(phone || "").slice(0, 40), address: "", notes: "Asked to connect from the customer portal.",
          tags: [], createdAt: new Date().toISOString().slice(0, 10), totalSpent: 0,
          pipelineStage: "lead", leadSource: "Client Portal Self-Signup",
      });
      if (insert.dropped.length) console.warn("[request_customer_link] saved without missing columns:", insert.dropped.join(", "));
      if (!insert.ok) {
        console.error("[request_customer_link] insert failed:", insert.status, JSON.stringify(insert.data));
        return json({ error: "Couldn't send your request to that business — please try again or contact them directly.", detail: insert.data?.message || insert.status }, 500);
      }
      return json({ success: true, customer: Array.isArray(insert.data) ? insert.data[0] : insert.data });
    }

    // ── ClientAuthPortal.tsx — persists a saved card's link back onto the
    // customer's own row. BUG FIX: SaveCardModal's onSaved callback here
    // used to only update local React state (setCustomers/patchCust) with
    // no Supabase write at all — the card really did get saved on Stripe's
    // side, but the CRM lost the connection back to it on next page load,
    // so a saved card never actually persisted for a customer-portal user
    // (as opposed to the owner-side CustomerDetail.tsx flow, which already
    // wrote directly to Supabase with its own authenticated session).
    // Customer identity is resolved from their own verified session email,
    // exactly like client_cancel_job/client_reschedule_job below — never a
    // client-claimed customerId.
    // ── Customer-portal invites ────────────────────────────────────────────
    // FEATURE — "whenever you add a customer, create their portal login and
    // send them a link that already has their information, so all they do
    // is pick a password." An invite is an owner_records row (kind
    // "portal_invite", id = the random token in the link, migration 0003).
    // Opening #/client?invite=TOKEN pre-fills their name/email/phone.
    // SECURITY — the portal finds a customer's records by their confirmed
    // e-mail, at every business that has that address. So the invite may skip
    // the "confirm your email" step only for the address the business already
    // has on file for that customer (the link went to that customer). Any
    // other address is refused, and a customer with no e-mail on file signs up
    // the normal way and confirms it. Before this, an invite could hand out a
    // confirmed login for someone else's address — and with it their records
    // at other businesses — and could overwrite the e-mail on file.
    const findInvite = async (token: string) => {
      if (!/^[A-Za-z0-9_-]{16,64}$/.test(token)) return null;
      const r = await sb(serviceRoleKey, `owner_records?kind=eq.portal_invite&id=eq.${encodeURIComponent(token)}&deleted_at=is.null&select=owner_id,id,data`);
      const row = Array.isArray(r.data) ? r.data[0] : null;
      return row ? { ownerId: row.owner_id as string, token: row.id as string, ...(row.data || {}) } : null;
    };
    const inviteCustomer = async (inv: any) => {
      const r = await sb(serviceRoleKey, `customers?id=eq.${encodeURIComponent(inv.customerId)}&owner_id=eq.${encodeURIComponent(inv.ownerId)}&select=*`);
      return Array.isArray(r.data) ? r.data[0] : null;
    };
    const maskEmail = (e: string) => e.replace(/^(.)[^@]*(@.*)$/, "$1***$2");
    const linkCustomerToEmail = async (inv: any, cust: any, email: string, extra: Record<string, string> = {}) => {
      // Never replaces an address the business already has on file.
      const patch: Record<string, unknown> = String(cust.email || "").trim() ? {} : { email };
      for (const [k, v] of Object.entries(extra)) if (v && !String(cust[k] || "").trim()) patch[k] = String(v).slice(0, 80);
      if (cust.pipelineStage === "lead") patch.pipelineStage = null;
      await sb(serviceRoleKey, `customers?id=eq.${encodeURIComponent(cust.id)}`, { method: "PATCH", headers: { Prefer: "return=minimal" }, body: JSON.stringify(patch) });
      await sb(serviceRoleKey, `owner_records?on_conflict=owner_id,kind,id`, {
        method: "POST", headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
        body: JSON.stringify([{ owner_id: inv.ownerId, kind: "portal_invite", id: inv.token, data: { customerId: inv.customerId, createdAt: inv.createdAt, sentAt: inv.sentAt || null, claimedAt: new Date().toISOString(), claimedEmail: email }, deleted_at: null }]),
      });
    };

    if (action === "create_portal_invites") {
      const accessToken = (context.request.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
      const ownerId = await resolveCallerOwnerId(accessToken).catch(() => null);
      if (!ownerId) return json({ error: "Sign in as the business owner" }, 401);
      const ids: string[] = Array.isArray(body.customerIds) ? body.customerIds.slice(0, 2000).map(String) : [];
      if (!ids.length) return json({ invites: [] });
      const existing = await sb(serviceRoleKey, `owner_records?owner_id=eq.${encodeURIComponent(ownerId)}&kind=eq.portal_invite&deleted_at=is.null&select=id,data&limit=5000`);
      const byCustomer = new Map<string, any>();
      for (const r of (Array.isArray(existing.data) ? existing.data : [])) byCustomer.set(r.data?.customerId, { token: r.id, ...(r.data || {}) });
      const out: any[] = [];
      const fresh: any[] = [];
      for (let i = 0; i < ids.length; i += 100) {
        const chunk = ids.slice(i, i + 100);
        const cr = await sb(serviceRoleKey, `customers?owner_id=eq.${encodeURIComponent(ownerId)}&id=in.(${chunk.map(encodeURIComponent).join(",")})&select=id,firstName,lastName,email,phone`);
        for (const c of (Array.isArray(cr.data) ? cr.data : [])) {
          let inv = byCustomer.get(c.id);
          if (!inv) {
            const bytes = crypto.getRandomValues(new Uint8Array(18));
            const token = btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
            inv = { token, customerId: c.id, createdAt: new Date().toISOString() };
            fresh.push({ owner_id: ownerId, kind: "portal_invite", id: token, data: { customerId: c.id, createdAt: inv.createdAt }, deleted_at: null });
          }
          out.push({ customerId: c.id, token: inv.token, claimed: !!inv.claimedAt, sentAt: inv.sentAt || null, firstName: c.firstName || "", lastName: c.lastName || "", email: c.email || "", phone: c.phone || "" });
        }
      }
      for (let i = 0; i < fresh.length; i += 200) {
        const w = await sb(serviceRoleKey, `owner_records`, { method: "POST", headers: { Prefer: "return=minimal" }, body: JSON.stringify(fresh.slice(i, i + 200)) });
        if (!w.ok) return json({ error: "Couldn't save the invites — run supabase/migrations/0003_owner_records_and_budget_entries.sql if you haven't." }, 500);
      }
      return json({ invites: out });
    }

    if (action === "mark_portal_invites_sent") {
      const accessToken = (context.request.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
      const ownerId = await resolveCallerOwnerId(accessToken).catch(() => null);
      if (!ownerId) return json({ error: "Sign in as the business owner" }, 401);
      const tokens: string[] = Array.isArray(body.tokens) ? body.tokens.slice(0, 2000).map(String) : [];
      for (let i = 0; i < tokens.length; i += 100) {
        const chunk = tokens.slice(i, i + 100);
        const r = await sb(serviceRoleKey, `owner_records?owner_id=eq.${encodeURIComponent(ownerId)}&kind=eq.portal_invite&id=in.(${chunk.map(encodeURIComponent).join(",")})&select=id,data`);
        const rows = (Array.isArray(r.data) ? r.data : []).map((x: any) => ({ owner_id: ownerId, kind: "portal_invite", id: x.id, data: { ...(x.data || {}), sentAt: new Date().toISOString() }, deleted_at: null }));
        if (rows.length) await sb(serviceRoleKey, `owner_records?on_conflict=owner_id,kind,id`, { method: "POST", headers: { Prefer: "resolution=merge-duplicates,return=minimal" }, body: JSON.stringify(rows) });
      }
      return json({ success: true });
    }

    if (action === "get_portal_invite") {
      const inv = await findInvite(String(body.token || ""));
      if (!inv) return json({ error: "This invite link isn't valid anymore — ask the business for a new one." }, 404);
      const cust = await inviteCustomer(inv);
      if (!cust) return json({ error: "This invite link isn't valid anymore — ask the business for a new one." }, 404);
      const sRow = await sb(serviceRoleKey, `app_settings?owner_id=eq.${encodeURIComponent(inv.ownerId)}&select=data`);
      const s = Array.isArray(sRow.data) ? sRow.data[0]?.data || {} : {};
      return json({
        firstName: cust.firstName || "", lastName: cust.lastName || "", email: cust.email || inv.claimedEmail || "", phone: cust.phone || "",
        claimed: !!inv.claimedAt, companyName: s.companyName || "", logoUrl: s.logoUrl || s.companyLogo || "",
      });
    }

    if (action === "portal_signup_with_invite") {
      const inv = await findInvite(String(body.token || ""));
      if (!inv) return json({ error: "This invite link isn't valid anymore — ask the business for a new one." }, 404);
      const cust = await inviteCustomer(inv);
      if (!cust) return json({ error: "This invite link isn't valid anymore — ask the business for a new one." }, 404);
      const email = String(body.email || "").trim().toLowerCase();
      const password = String(body.password || "");
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return json({ error: "Enter a valid email address" }, 400);
      if (password.length < 6) return json({ error: "Password must be at least 6 characters" }, 400);
      if (inv.claimedAt && inv.claimedEmail && inv.claimedEmail !== email) return json({ error: `This invite was already used by ${maskEmail(inv.claimedEmail)} — log in with that email.` }, 409);
      const onFile = String(cust.email || "").trim().toLowerCase();
      if (onFile && onFile !== email) return json({ error: `This invite is for the e-mail ${maskEmail(onFile)} the business has on file. Use that address, or ask them to update it.` }, 409);
      if (!onFile) {
        // No address on file: save it on the customer, then the browser signs
        // up normally and the customer confirms the address before seeing anything.
        await linkCustomerToEmail(inv, cust, email, { firstName: body.firstName, lastName: body.lastName, phone: body.phone });
        return json({ confirmEmail: true, email });
      }
      const create = await fetch(`${SUPABASE_URL}/auth/v1/admin/users`, {
        method: "POST", headers: { apikey: serviceRoleKey, Authorization: `Bearer ${serviceRoleKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, email_confirm: true, user_metadata: { firstName: body.firstName || cust.firstName || "", lastName: body.lastName || cust.lastName || "", role: "customer" } }),
      });
      const created: any = await create.json().catch(() => ({}));
      if (!create.ok) {
        const msg = String(created?.msg || created?.message || created?.error_description || "");
        if (create.status === 422 || /already|registered|exists/i.test(msg)) {
          // They already have a login (maybe from another business) — tie
          // this customer record to it and have them log in.
          await linkCustomerToEmail(inv, cust, email, { firstName: body.firstName, lastName: body.lastName, phone: body.phone });
          return json({ existingAccount: true, email, message: "You already have a login with this email — log in with your password (or tap Forgot password)." });
        }
        return json({ error: "Couldn't create your login — " + (msg || `error ${create.status}`) }, 500);
      }
      await linkCustomerToEmail(inv, cust, email, { firstName: body.firstName, lastName: body.lastName, phone: body.phone });
      return json({ success: true, email });
    }

    // Already logged in and opened an invite link → tie that customer record
    // to this login (the link itself is the proof).
    if (action === "claim_portal_invite") {
      const accessToken = (context.request.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
      const email = await resolveCallerEmail(accessToken, anonKey);
      if (!email) return json({ error: "Not signed in" }, 401);
      const inv = await findInvite(String(body.token || ""));
      if (!inv) return json({ error: "This invite link isn't valid anymore" }, 404);
      if (inv.claimedAt && inv.claimedEmail && inv.claimedEmail !== email.toLowerCase()) return json({ error: `This invite was already used by ${maskEmail(inv.claimedEmail)}` }, 409);
      const cust = await inviteCustomer(inv);
      if (!cust) return json({ error: "This invite link isn't valid anymore" }, 404);
      if (String(cust.email || "").trim() && String(cust.email).trim().toLowerCase() !== email.toLowerCase()) return json({ error: `This invite is for ${maskEmail(String(cust.email).trim().toLowerCase())} — log in with that address.` }, 409);
      await linkCustomerToEmail(inv, cust, email.toLowerCase());
      return json({ success: true });
    }

    if (action === "client_save_card_link") {
      const { stripeCustomerId, paymentMethodId, label, consentAt, setAsDefault } = body;
      if (!stripeCustomerId || !paymentMethodId) return json({ error: "Missing stripeCustomerId/paymentMethodId" }, 400);
      const accessToken = (context.request.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
      const email = await resolveCallerEmail(accessToken, anonKey);
      if (!email) return json({ error: "Not signed in" }, 401);
      const custRow = await sb(serviceRoleKey, `customers?email=ilike.${encodeURIComponent(email)}&select=id,savedPaymentMethodId`);
      const customer = Array.isArray(custRow.data) ? custRow.data[0] : null;
      if (!customer) return json({ error: "No customer record found for this account." }, 404);

      const patch: Record<string, any> = { stripeCustomerId, cardConsentAt: consentAt || new Date().toISOString() };
      // First card ever saved (or an explicit "make default") becomes the
      // default charge target — same rule ClientAuthPortal's client-side
      // isFirstCard logic already used, just now actually durable.
      if (setAsDefault || !customer.savedPaymentMethodId) {
        patch.savedPaymentMethodId = paymentMethodId;
        patch.savedPaymentMethodLabel = label || "";
      }
      const upd = await sb(serviceRoleKey, `customers?id=eq.${encodeURIComponent(customer.id)}`, {
        method: "PATCH", headers: { Prefer: "return=minimal" }, body: JSON.stringify(patch),
      });
      if (!upd.ok) return json({ error: "Failed to save card to your account." }, 500);
      return json({ success: true });
    }

    // ── ClientAuthPortal.tsx — self-serve cancel/reschedule. Owner-gated:
    // OFF by default (settings.clientPortalCancelReschedule must be
    // explicitly true) and a reason is mandatory either way — a bare
    // "cancel"/"reschedule" click with nothing typed is rejected server-side,
    // not just discouraged in the UI, since a client could otherwise script
    // around a client-only validation. The permission check happens HERE
    // (server side, keyed off the job's own owner_id) rather than trusting
    // whatever the client's local `settings` prop currently says — a stale
    // or tampered client value must never grant an action the owner turned
    // off. Job ownership is verified against the caller's OWN verified
    // customer record, never a client-claimed customerId.
    if (action === "client_cancel_job" || action === "client_reschedule_job") {
      const { jobId, reason, newDate, newTime } = body;
      const reasonTrimmed = (reason || "").trim();
      if (!jobId) return json({ error: "Missing jobId" }, 400);
      if (!reasonTrimmed) return json({ error: "A reason is required." }, 400);
      if (action === "client_reschedule_job" && !newDate) return json({ error: "Missing newDate" }, 400);

      const accessToken = (context.request.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
      const email = await resolveCallerEmail(accessToken, anonKey);
      if (!email) return json({ error: "Not signed in" }, 401);
      const custRow = await sb(serviceRoleKey, `customers?email=ilike.${encodeURIComponent(email)}&select=id`);
      const customer = Array.isArray(custRow.data) ? custRow.data[0] : null;
      if (!customer) return json({ error: "No customer record found for this account." }, 404);

      const jobRow = await sb(serviceRoleKey, `jobs?id=eq.${encodeURIComponent(jobId)}&select=id,customerId,owner_id,scheduledDate,scheduledTime,address,commLog,status`);
      const job = Array.isArray(jobRow.data) ? jobRow.data[0] : null;
      if (!job) return json({ error: "Job not found" }, 404);
      if (job.customerId !== customer.id) return json({ error: "That job doesn't belong to this account." }, 403);
      if (job.status === "cancelled" || job.status === "completed") return json({ error: `This job is already ${job.status} — contact us directly.` }, 400);

      const settingsRow = job.owner_id
        ? await sb(serviceRoleKey, `app_settings?owner_id=eq.${encodeURIComponent(job.owner_id)}&select=data`)
        : null;
      const ownerSettings = settingsRow && Array.isArray(settingsRow.data) ? settingsRow.data[0]?.data : null;
      if (!ownerSettings?.clientPortalCancelReschedule) {
        return json({ error: "Self-serve cancel/reschedule isn't enabled — please contact us directly to change this appointment." }, 403);
      }

      const commEntry = { ts: Date.now(), source: "client_portal", type: action === "client_cancel_job" ? "cancel" : "reschedule", reason: reasonTrimmed, ...(action === "client_reschedule_job" ? { from: job.scheduledDate, to: newDate } : {}) };
      const commLog = [...(Array.isArray(job.commLog) ? job.commLog : []), commEntry];

      const patch: Record<string, any> = { commLog };
      let notifyText: string;
      if (action === "client_cancel_job") {
        patch.status = "cancelled";
        patch.cancelReason = reasonTrimmed;
        notifyText = `❌ CLIENT CANCELLED\n\nA client cancelled their ${job.scheduledDate || "upcoming"} job at ${job.address || "their property"} via the portal.\n\nReason: "${reasonTrimmed}"`;
      } else {
        patch.scheduledDate = newDate;
        if (newTime) patch.scheduledTime = newTime;
        notifyText = `📅 CLIENT RESCHEDULED\n\nA client moved their job at ${job.address || "their property"} from ${job.scheduledDate || "an earlier date"} to ${newDate}${newTime ? " at " + newTime : ""} via the portal.\n\nReason: "${reasonTrimmed}"`;
      }

      const upd = await sb(serviceRoleKey, `jobs?id=eq.${encodeURIComponent(jobId)}`, { method: "PATCH", headers: { Prefer: "return=minimal" }, body: JSON.stringify(patch) });
      if (!upd.ok) return json({ error: "Failed to update the job." }, 500);

      const origin = new URL(context.request.url).origin;
      fetch(`${origin}/api/alfred-notify`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: "Alfred Notifications", message: notifyText, jobId, customerId: customer.id }),
      }).catch(() => {});

      return json({ success: true, status: patch.status || job.status, scheduledDate: patch.scheduledDate || job.scheduledDate });
    }

    return json({ error: "Unknown action: " + action }, 400);
  } catch (e: any) {
    return json({ error: e?.message || "public-data error" }, 400);
  }
};

// Only the fields ClientPortal actually renders — never
// the full app_settings.data blob (which holds live secrets: Twilio token,
// Anthropic key, etc. — see the round-12 audit note in lib/messaging.ts).
const publicSettingsSubset = (data: Record<string, any>) => ({
  companyName: data.companyName, companyPhone: data.companyPhone, companyLogo: data.companyLogo,
  stripePublishableKey: data.stripePublishableKey, primaryColor: data.primaryColor,
  // FEATURE — "switch between Stripe and Square easily." Which provider a
  // customer-facing payment page should actually use — safe to expose
  // (just a string, "stripe"|"square", no secret involved).
  paymentProvider: data.paymentProvider || "stripe",
  paymentProviderPreference: data.paymentProviderPreference || "both",
  // FEATURE — review-nudge banner in ClientAuthPortal.tsx needs these to
  // build the same #/rate link the automated review-request flow uses —
  // none of these are secrets, just public review-link config.
  googlePlaceId: data.googlePlaceId, googleReviewLink: data.googleReviewLink,
  reviewGoogleMinStars: data.reviewGoogleMinStars,
  clientPortalCancelReschedule: data.clientPortalCancelReschedule,
  clientPortalCanCancel: data.clientPortalCanCancel,
  clientPortalCanReschedule: data.clientPortalCanReschedule,
});

const json = (data: any, status = 200) => new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json" } });
