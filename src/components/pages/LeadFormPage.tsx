import React, { useState } from "react";
import { CheckCircle } from "lucide-react";
import { uid, today } from "../../lib/utils";

// Public-facing lead intake form — no auth required, meant to be embedded via
// iframe on the owner's own website (see LeadIntakePage.tsx's "Get Embed
// Code"). URL: #/lead-form?oid=OWNER_ID&co=COMPANY_NAME&ph=COMPANY_PHONE
//
// FIX 18 — the previous embed code pointed at a hardcoded, nonexistent URL
// ("https://crm.com/lead-form") that isn't part of this app at all —
// pasting it into any real website would show a blank/404 iframe forever,
// so leads submitted through it could never reach the CRM. This is a real
// route in this app, reachable standalone with no owner session.
//
// MULTI-TENANT (Phase D) — was a direct anon-key `.from("customers").insert()`
// with no owner_id, on the theory that this app is single-tenant per
// deployment. Once RLS went owner_id-scoped (0033_multitenant_owner_scoping.sql)
// that had nothing to satisfy WITH CHECK, so every public lead submission was
// silently rejected. Routed through /api/public-data's submit_lead_form
// action (service role) instead, same pattern as submit_review/
// its other public actions. Deliberately does NOT read `app_settings` directly
// — that table holds live secrets (Twilio auth token, Stripe secret key,
// Google OAuth token, AI API keys) behind a permissive RLS policy; exposing
// it to an unauthenticated public page would leak every one of those to
// anyone who opens the embed's network tab. Company name/phone are passed as
// plain, non-secret query params instead (baked into the embed snippet at
// copy time, from the owner's own already-loaded settings).

function hashParam(key: string): string {
  const hash = window.location.hash;
  const q = hash.includes("?") ? hash.slice(hash.indexOf("?") + 1) : "";
  return new URLSearchParams(q).get(key) || "";
}

const COMMON_SERVICES = ["Estimate / Quote", "Repair", "Installation", "Maintenance", "Commercial Service", "Not sure yet"];

// ITEM 1 — owner-customizable colors, same non-secret-query-param pattern as
// company name/phone above: bg (page background), btn (button/header
// accent), text (heading text color). Hex values, e.g. #111827.
const isHex = (v: string) => /^#[0-9a-fA-F]{3,8}$/.test(v);

export function LeadFormPage() {
  const ownerId = hashParam("oid");
  const companyName = decodeURIComponent(hashParam("co") || "") || "Get a Free Quote";
  const companyPhone = decodeURIComponent(hashParam("ph") || "");
  const bgParam = hashParam("bg");
  const btnParam = hashParam("btn");
  const textParam = hashParam("text");
  const bgColor = isHex(bgParam) ? bgParam : "#0a0a0a";
  const btnColor = isHex(btnParam) ? btnParam : "#111111";
  const textColor = isHex(textParam) ? textParam : "#ffffff";
  // FEATURE — "you should be able to customize the lead intake form as much
  // as you want... choose to add your logo." Same plain, non-secret query-
  // param pattern as bg/btn/text above (see this file's own header comment
  // for why it never reads app_settings directly) — LeadIntakePage.tsx's
  // Customize panel is what actually sets these before copying the embed
  // snippet. Every one of these needs a sane default so an OLDER embed
  // snippet (copied before this feature existed, with none of these params)
  // still renders exactly as it always did.
  const headline = decodeURIComponent(hashParam("headline") || "") || "Get a free estimate — we respond fast";
  const buttonText = decodeURIComponent(hashParam("btntext") || "") || "Get My Free Estimate →";
  const thankYouMessage = decodeURIComponent(hashParam("thankyou") || "") || "We'll call or text you shortly to schedule your free estimate.";
  const logoUrlParam = hashParam("logo");
  const logoUrl = logoUrlParam.startsWith("http") ? logoUrlParam : "";
  const showAddress = hashParam("showaddr") !== "0";
  const showService = hashParam("showsvc") !== "0";
  const showMessage = hashParam("shownote") !== "0";

  const [f, setF] = useState({ firstName: "", lastName: "", email: "", phone: "", address: "", service: "", message: "" });
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");
  // FEATURE — Twilio A2P 10DLC campaign compliance: this is the point a
  // phone number is first collected from someone who isn't a customer yet,
  // so it's where SMS opt-in consent has to be captured and durably recorded
  // (smsOptInAt below is the actual compliance record). The exact wording
  // here is a standard TCPA-style placeholder, NOT the literal text from
  // your Twilio campaign registration — swap it for that exact wording
  // before this matters for registration/vetting.
  const [smsOptIn, setSmsOptIn] = useState(false);
  // Honeypot — hidden from people, filled in by spam bots; the server drops
  // any submission that has it.
  const [hp, setHp] = useState("");

  const utmParams = (() => {
    try {
      const hash = window.location.hash;
      const q = hash.includes("?") ? hash.slice(hash.indexOf("?") + 1) : "";
      const p = new URLSearchParams(q);
      return { utm_source: p.get("utm_source"), utm_medium: p.get("utm_medium"), utm_campaign: p.get("utm_campaign") };
    } catch { return { utm_source: null, utm_medium: null, utm_campaign: null }; }
  })();

  const handleSubmit = async () => {
    if (!f.firstName.trim() || !f.phone.trim() || !smsOptIn) return;
    setSubmitting(true);
    setError("");
    try {
      const newCustomer = {
        id: uid(), firstName: f.firstName.trim(), lastName: f.lastName.trim(), email: f.email.trim(), phone: f.phone.trim(),
        address: f.address.trim(), leadSource: utmParams.utm_source || "Website", notes: (f.service ? `Service: ${f.service}. ` : "") + f.message.trim(),
        tags: [], createdAt: today(), totalSpent: 0, pipelineStage: "lead",
        utmSource: utmParams.utm_source, utmMedium: utmParams.utm_medium, utmCampaign: utmParams.utm_campaign,
        smsOptIn: true, smsOptInAt: new Date().toISOString(),
      };
      if (!ownerId) {
        console.error("[LeadForm] no oid in URL — this embed link predates owner routing, re-copy it from Lead Intake → Get Embed Code");
        setError("This form isn't fully set up yet — please call or text us instead.");
        setSubmitting(false);
        return;
      }
      console.log("[LeadForm] submitting new lead:", newCustomer.firstName, newCustomer.lastName);
      const res = await fetch("/api/public-data", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "submit_lead_form", ownerId, customer: newCustomer, website: hp }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || data?.error) {
        console.error("[LeadForm] submit failed:", data?.error || res.status);
        // Show the server's reason when it's one meant for the visitor (bad/old
        // embed link, missing contact info); otherwise the generic message.
        setError(res.status === 400 || res.status === 404 ? (data?.error || "Something went wrong submitting your request — please call or text us instead.") : "Something went wrong submitting your request — please call or text us instead.");
        setSubmitting(false);
        return;
      }
      console.log("[LeadForm] lead saved to Supabase ✓");
      setSubmitted(true);
    } catch (e: any) {
      console.error("[LeadForm] insert threw:", e?.message);
      setError("Something went wrong submitting your request — please call or text us instead.");
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <div className="min-h-screen bg-neutral-950 text-white flex flex-col items-center justify-center p-6 text-center">
        <CheckCircle size={48} className="text-green-400 mb-3" />
        <div className="text-xl font-bold text-green-400">We got your request!</div>
        <div className="text-white/60 text-sm mt-1">{thankYouMessage}</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen text-white" style={{ backgroundColor: bgColor }}>
      <div className="px-6 py-5 flex items-center gap-3" style={{ backgroundColor: btnColor }}>
        {logoUrl && <img src={logoUrl} alt="" className="w-10 h-10 object-contain rounded-lg bg-white/10 p-1 flex-shrink-0" />}
        <div>
          <div className="font-bold text-lg" style={{ color: textColor }}>{companyName}</div>
          <div className="text-xs mt-0.5" style={{ color: textColor, opacity: 0.8 }}>{headline}{companyPhone ? ` · ${companyPhone}` : ""}</div>
        </div>
      </div>
      <div className="p-6 max-w-lg mx-auto space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-white/60 mb-1 block">First Name *</label>
            <input type="text" name="website" value={hp} onChange={e => setHp(e.target.value)} tabIndex={-1} autoComplete="off" aria-hidden="true" style={{ position: "absolute", left: "-9999px", width: 1, height: 1, opacity: 0 }} />
            <input value={f.firstName} onChange={e => setF({ ...f, firstName: e.target.value })} placeholder="Jennifer"
              className="w-full bg-white/5 border border-white/15 rounded-xl px-3 py-2.5 text-sm text-white placeholder-white/25 focus:outline-none focus:border-brand-500/50" />
          </div>
          <div>
            <label className="text-xs text-white/60 mb-1 block">Last Name</label>
            <input value={f.lastName} onChange={e => setF({ ...f, lastName: e.target.value })} placeholder="Walsh"
              className="w-full bg-white/5 border border-white/15 rounded-xl px-3 py-2.5 text-sm text-white placeholder-white/25 focus:outline-none focus:border-brand-500/50" />
          </div>
        </div>
        <div>
          <label className="text-xs text-white/60 mb-1 block">Phone Number *</label>
          <input type="tel" value={f.phone} onChange={e => setF({ ...f, phone: e.target.value })} placeholder="(555) 555-0100"
            className="w-full bg-white/5 border border-white/15 rounded-xl px-3 py-2.5 text-sm text-white placeholder-white/25 focus:outline-none focus:border-brand-500/50" />
        </div>
        <div>
          <label className="text-xs text-white/60 mb-1 block">Email</label>
          <input type="email" value={f.email} onChange={e => setF({ ...f, email: e.target.value })} placeholder="jen@example.com"
            className="w-full bg-white/5 border border-white/15 rounded-xl px-3 py-2.5 text-sm text-white placeholder-white/25 focus:outline-none focus:border-brand-500/50" />
        </div>
        {showAddress && <div>
          <label className="text-xs text-white/60 mb-1 block">Property Address</label>
          <input value={f.address} onChange={e => setF({ ...f, address: e.target.value })} placeholder="412 Oak Ridge Ln, your area"
            className="w-full bg-white/5 border border-white/15 rounded-xl px-3 py-2.5 text-sm text-white placeholder-white/25 focus:outline-none focus:border-brand-500/50" />
        </div>}
        {showService && <div>
          <label className="text-xs text-white/60 mb-1 block">Service Needed</label>
          <select value={f.service} onChange={e => setF({ ...f, service: e.target.value })}
            className="w-full bg-white/5 border border-white/15 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-brand-500/50">
            <option value="" className="bg-black">Select service…</option>
            {COMMON_SERVICES.map(s => <option key={s} value={s} className="bg-black">{s}</option>)}
          </select>
        </div>}
        {showMessage && <div>
          <label className="text-xs text-white/60 mb-1 block">Anything else we should know?</label>
          <textarea rows={3} value={f.message} onChange={e => setF({ ...f, message: e.target.value })} placeholder="Gate code, dog on property, specific concerns..."
            className="w-full bg-white/5 border border-white/15 rounded-xl px-3 py-2.5 text-sm text-white placeholder-white/25 resize-none focus:outline-none focus:border-brand-500/50" />
        </div>}
        <label className="flex items-start gap-2.5 p-3 rounded-xl bg-white/5 border border-white/10 cursor-pointer">
          <input type="checkbox" checked={smsOptIn} onChange={e => setSmsOptIn(e.target.checked)} className="mt-0.5 flex-shrink-0" />
          <span className="text-[11px] text-white/60 leading-relaxed">
            By checking this box, I agree to receive text messages from {companyName} at the phone number provided, including <strong className="text-white/80">estimate follow-ups, appointment reminders, on-my-way/running-late updates, and service confirmations</strong>. Message frequency varies based on your active jobs and requests (typically 1-4 messages per month). Message and data rates may apply. Reply <strong className="text-white/80">STOP</strong> at any time to unsubscribe, or <strong className="text-white/80">HELP</strong> for help. Consent is not a condition of purchase. See our{" "}
            <a href={"#/terms?co=" + encodeURIComponent(companyName)} target="_blank" rel="noopener noreferrer" className="text-brand-400 underline">Terms & Conditions</a> and{" "}
            <a href={"#/privacy?co=" + encodeURIComponent(companyName)} target="_blank" rel="noopener noreferrer" className="text-brand-400 underline">Privacy Policy</a>.
          </span>
        </label>
        {error && <div className="text-xs text-danger-400 bg-danger-950/20 border border-danger-700/30 rounded-xl px-3 py-2">{error}</div>}
        <button
          onClick={handleSubmit}
          disabled={!f.firstName.trim() || !f.phone.trim() || !smsOptIn || submitting}
          style={{ backgroundColor: btnColor, color: textColor }}
          className="w-full py-4 font-bold rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed hover:opacity-90"
        >
          {submitting ? "Submitting…" : buttonText}
        </button>
        {!smsOptIn && <div className="text-center text-[10px] text-yellow-400/70">Check the box above to submit</div>}
        <div className="text-center text-[10px] text-white/30">🔒 We never share your info · No spam</div>
      </div>
    </div>
  );
}
