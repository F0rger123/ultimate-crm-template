import React, { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";

// Public, unauthenticated Terms & Conditions / Privacy Policy pages — required
// as live HTTPS links for Twilio A2P 10DLC campaign registration (linked from
// LeadFormPage.tsx's SMS opt-in checkbox). Company name is passed as a plain
// query param, same as LeadFormPage.tsx. URL: #/terms?co=COMPANY_NAME / #/privacy?co=COMPANY_NAME
//
// UNIFICATION (audit fix) — Settings -> Legal had its own free-text
// termsOfService/privacyPolicy editor whose description claimed these were
// "displayed in your client portal and estimate pages," but nothing actually
// rendered them anywhere — a second, disconnected system from this one. This
// page now fetches that same owner-authored text and shows it here instead,
// so Settings -> Legal edits the ACTUAL live public page. Deliberately fetches
// only the two specific JSON keys it needs (via PostgREST's `data->>key`
// path selector), never the whole `app_settings.data` blob — that blob also
// holds API keys/secrets, which must never be exposed to an unauthenticated
// visitor of a public page. Falls back to the boilerplate below when the
// owner hasn't written custom text (matches the fact that a fresh business
// realistically won't have edited that field on day one).
//
// IMPORTANT (fallback boilerplate): standard boilerplate for a small
// home-services business, not a substitute for your own legal review.
// Confirm it matches your actual practices (what you collect, who you share
// it with — Twilio for SMS, Stripe for payments, Google for calendar/email —
// and your real contact info) before relying on it for campaign registration.

function hashParam(key: string): string {
  const hash = window.location.hash;
  const q = hash.includes("?") ? hash.slice(hash.indexOf("?") + 1) : "";
  return new URLSearchParams(q).get(key) || "";
}

function useCustomLegalText(key: "termsOfService" | "privacyPolicy"): string | null {
  const [text, setText] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    (supabase as any).from("app_settings").select(`data->>${key}`).limit(1).maybeSingle()
      .then(({ data, error }: any) => {
        if (cancelled || error) return;
        const value = data?.[key];
        if (typeof value === "string" && value.trim()) setText(value);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [key]);
  return text;
}

function LegalPageShell({ title, companyName, children }: { title: string; companyName: string; children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-neutral-950 text-white">
      <div className="bg-brand-600 px-6 py-5 text-brand-fg">
        <div className="font-bold text-lg text-brand-fg">{companyName}</div>
        <div className="text-brand-fg/60 text-xs mt-0.5">{title}</div>
      </div>
      <div className="p-6 max-w-2xl mx-auto space-y-4 text-sm text-white/70 leading-relaxed">
        {children}
        <div className="text-[10px] text-white/30 pt-6">Last updated {new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}</div>
      </div>
    </div>
  );
}

export function TermsPage() {
  const companyName = decodeURIComponent(hashParam("co") || "") || "CRM Starter";
  const customText = useCustomLegalText("termsOfService");
  if (customText) {
    return (
      <LegalPageShell title="Terms & Conditions" companyName={companyName}>
        <p className="whitespace-pre-wrap">{customText}</p>
      </LegalPageShell>
    );
  }
  return (
    <LegalPageShell title="Terms & Conditions" companyName={companyName}>
      <p>These terms govern your use of {companyName}'s services, including requesting estimates, scheduling service, and communicating with us by phone, text message (SMS), or email.</p>
      <h2 className="text-white font-semibold pt-2">Messaging</h2>
      <p>By providing your phone number and opting in, you agree to receive text messages from {companyName} related to estimates, scheduling, appointment reminders, and service updates. Message and data rates may apply. Message frequency varies depending on your active jobs and requests. Consent to receive texts is not a condition of purchase.</p>
      <p>Reply <strong>STOP</strong> at any time to opt out of text messages. Reply <strong>HELP</strong> for assistance. Carriers are not liable for delayed or undelivered messages.</p>
      <h2 className="text-white font-semibold pt-2">Estimates & Service</h2>
      <p>Estimates are based on the information and property access provided at the time of request and may be adjusted after an on-site assessment. Scheduling is subject to availability and weather conditions.</p>
      <h2 className="text-white font-semibold pt-2">Payment</h2>
      <p>Payment terms (deposits, balances due, and accepted payment methods) are specified on your estimate or invoice. Charges are processed securely through our payment provider.</p>
      <h2 className="text-white font-semibold pt-2">Photos & Video</h2>
      <p>If the owner desires, employees may record photos and videos on the job for content and commercial/marketing purposes, and {companyName} may use them, unless the employee or client explicitly requests otherwise.</p>
      <h2 className="text-white font-semibold pt-2">Contact</h2>
      <p>Questions about these terms? Reach out to {companyName} directly using the contact information provided in your estimate or invoice.</p>
    </LegalPageShell>
  );
}

export function PrivacyPolicyPage() {
  const companyName = decodeURIComponent(hashParam("co") || "") || "CRM Starter";
  const customText = useCustomLegalText("privacyPolicy");
  if (customText) {
    return (
      <LegalPageShell title="Privacy Policy" companyName={companyName}>
        <p className="whitespace-pre-wrap">{customText}</p>
      </LegalPageShell>
    );
  }
  return (
    <LegalPageShell title="Privacy Policy" companyName={companyName}>
      <p>{companyName} collects the information you provide when requesting an estimate or scheduling service — name, phone number, email, and property address — to respond to your request and provide our services.</p>
      <h2 className="text-white font-semibold pt-2">How We Use Your Information</h2>
      <p>We use your contact information to send estimates, schedule and confirm appointments, send service reminders and updates, and process payments. We do not sell your personal information.</p>
      <h2 className="text-white font-semibold pt-2">Text Messaging</h2>
      <p><strong>No mobile information will be shared with third parties or affiliates for marketing or promotional purposes.</strong> Information sharing to subcontractors or affiliates is limited to what's necessary to provide the services you request (for example, sending a text message requires sharing your number with our messaging provider, Twilio, solely to deliver that message).</p>
      <h2 className="text-white font-semibold pt-2">Third-Party Services</h2>
      <p>We use trusted third-party providers to operate our business, including a messaging provider (Twilio) to send text messages, a payment processor (Stripe) to handle payments, and Google Workspace for email and calendar scheduling. Each handles your information under their own privacy policies, and only receives what's needed to perform their specific function for us.</p>
      <h2 className="text-white font-semibold pt-2">Your Choices</h2>
      <p>You can opt out of text messages at any time by replying STOP. You can request that we delete your contact information by reaching out to us directly.</p>
      <h2 className="text-white font-semibold pt-2">Contact</h2>
      <p>Questions about this privacy policy? Reach out to {companyName} directly using the contact information provided in your estimate or invoice.</p>
    </LegalPageShell>
  );
}
