import { uid, today, daysFromNow } from "./utils";
import type {
  Customer, Estimate, Job, Employee, Vehicle, MaintenanceRecord,
  Expense, Chemical, Service, Campaign, Automation, Review,
  SocialPost, AccountabilityEntry, Goal, Reminder, RewardTier,
  Referral, MileageLog,
} from "../types";

// ─── Business data ────────────────────────────────────────────────────────────
// A new install starts empty — real records come from Supabase. These exist
// as typed empty defaults for usePersistent() before the first sync lands.

export const seedCustomers: Customer[] = [];
export const seedEstimates: Estimate[] = [];
export const seedJobs: Job[] = [];
export const seedEmployees: Employee[] = [];
export const seedVehicles: Vehicle[] = [];
export const seedMaintenance: MaintenanceRecord[] = [];
export const seedExpenses: Expense[] = [];
export const seedChemicals: Chemical[] = [];
export const seedReviews: Review[] = [];
export const seedSocialPosts: SocialPost[] = [];
export const seedReferrals: Referral[] = [];
export const seedReminders: Reminder[] = [];
export const seedGoals: Goal[] = [];
export const seedAccountabilityEntries: AccountabilityEntry[] = [];
export const seedMileage: MileageLog[] = [];
export const seedLeadSrc: { source: string; leads: number; conversions: number; revenue: number; adSpend: number }[] = [];
export const seedTimeline: Record<string, Array<{ id: string; type: string; note: string; date: string }>> = {};

// ─── Starter service catalog ──────────────────────────────────────────────────
// Generic examples so estimates work out of the box — edit or replace them in
// Settings → Services for the business you're setting up.

export const seedServices: Service[] = [
  { id: "s1", name: "Standard Service Visit",       basePrice: 150, unit: "job",  taxable: true, active: true, description: "Standard on-site service visit" },
  { id: "s2", name: "Consultation / Assessment",    basePrice: 75,  unit: "job",  taxable: true, active: true, description: "On-site assessment and recommendations" },
  { id: "s3", name: "Hourly Labor",                 basePrice: 85,  unit: "hour", taxable: true, active: true, description: "Billed per hour on site" },
  { id: "s4", name: "Materials",                    basePrice: 0,   unit: "item", taxable: true, active: true, description: "Parts and materials" },
  { id: "s5", name: "Maintenance Plan Visit",       basePrice: 120, unit: "job",  taxable: true, active: true, description: "Scheduled recurring maintenance visit" },
  { id: "s6", name: "Emergency / After-Hours Call", basePrice: 200, unit: "job",  taxable: true, active: true, description: "Same-day or after-hours service" },
  { id: "s7", name: "Commercial Service",           basePrice: 500, unit: "job",  taxable: true, active: true, description: "Commercial property service" },
  { id: "s8", name: "Trip / Travel Fee",            basePrice: 35,  unit: "job",  taxable: true, active: true, description: "Travel outside the standard service area" },
];

// ─── Message templates ────────────────────────────────────────────────────────

export const seedEmailTemplates = [
  { id: "et1", name: "Estimate Ready", subject: "Your estimate from {{company_name}}",
    body: "Hi {{first_name}},\n\nYour estimate is ready. Click below to view, approve, and sign.\n\n{{estimate_link}}\n\nValid for {{valid_days}} days. Questions? Call {{company_phone}}.\n\n— {{company_name}}" },
  { id: "et2", name: "Job Confirmation", subject: "Appointment confirmed — {{company_name}}",
    body: "Hi {{first_name}},\n\nYour appointment is confirmed for {{date}} at approximately {{time}}.\n\nAddress: {{address}}\n\nWe'll text you when we're on the way.\n\n— {{company_name}}" },
  { id: "et3", name: "Review Request", subject: "Quick favor? Leave us a review",
    body: "Hi {{first_name}},\n\nThank you for choosing {{company_name}}! Would you mind leaving us a quick review? It takes about a minute and helps a lot.\n\n{{review_link}}\n\nThank you! — {{company_name}}" },
  { id: "et4", name: "Payment Receipt", subject: "Payment received — {{company_name}}",
    body: "Hi {{first_name}},\n\nWe received your payment of {{amount}}. Thank you!\n\nReceipt: {{receipt_link}}\n\n— {{company_name}}" },
  { id: "et5", name: "Birthday Message", subject: "Happy birthday from {{company_name}}!",
    body: "Hi {{first_name}},\n\nHappy birthday! Enjoy 10% off any service this month — code BDAY10.\n\n— {{company_name}}" },
];

export const seedSmsTemplates = [
  { id: "st1", name: "New Lead Response",  body: "Hi {{first_name}}! Thanks for reaching out to {{company_name}}. We'll get back to you shortly. Questions? Call/text {{company_phone}}." },
  { id: "st2", name: "Job Reminder",       body: "Hi {{first_name}}, reminder: your {{company_name}} appointment is tomorrow at {{time}}. Reply STOP to unsubscribe." },
  { id: "st3", name: "On My Way",          body: "Hi {{first_name}}, {{company_name}} is heading your way now! ETA: {{eta}}. Live location: {{location_link}}" },
  { id: "st4", name: "Job Complete",       body: "Hi {{first_name}}, all done! Thank you for choosing {{company_name}}." },
  { id: "st5", name: "Review Request",     body: "Hi {{first_name}}, happy with today's service? A quick review means a lot: {{review_link}} — {{company_name}}" },
  { id: "st6", name: "Payment Overdue",    body: "Hi {{first_name}}, a reminder that your invoice for {{amount}} is past due. Pay here: {{payment_link}} Questions? {{company_phone}}." },
  { id: "st7", name: "Estimate Follow-Up", body: "Hi {{first_name}}, checking in on your estimate for {{amount}}. Any questions, or ready to schedule? — {{company_name}}" },
  { id: "st8", name: "Weather Reschedule", body: "Hi {{first_name}}, due to the weather forecast we need to reschedule your appointment. We'll reach out with new options shortly. — {{company_name}}" },
];

// ─── Default automations (all off until the owner turns them on) ──────────────

export const seedAutomations: Automation[] = [
  { id: "a1",  name: "New lead auto-response",     trigger: "New lead form submitted",  action: "Send instant SMS",          active: false, lastTriggered: null, count: 0, steps: [], description: "Texts every new lead within 60 seconds" },
  { id: "a2",  name: "Estimate follow-up (24h)",   trigger: "Estimate sent, unopened",  action: "Send follow-up SMS",        active: false, lastTriggered: null, count: 0, steps: [] },
  { id: "a3",  name: "Job reminder (24h)",         trigger: "24h before job",           action: "Send reminder to customer", active: false, lastTriggered: null, count: 0, steps: [] },
  { id: "a4",  name: "Review request (48h)",       trigger: "Job completed + 48h",      action: "Send review request",       active: false, lastTriggered: null, count: 0, steps: [] },
  { id: "a5",  name: "Payment overdue (7d)",       trigger: "Invoice overdue 7 days",   action: "Send payment reminder",     active: false, lastTriggered: null, count: 0, steps: [] },
  { id: "a6",  name: "Maintenance reminder (90d)", trigger: "90 days since service",    action: "Send maintenance reminder", active: false, lastTriggered: null, count: 0, steps: [] },
  { id: "a7",  name: "Birthday message",           trigger: "Customer birthday",        action: "Send greeting + 10% off",   active: false, lastTriggered: null, count: 0, steps: [] },
  { id: "a10", name: "Abandoned estimate (3d)",    trigger: "Estimate not approved 3d", action: "3-touch nurture sequence",  active: false, lastTriggered: null, count: 0, steps: [] },
  { id: "a11", name: "Re-engagement (6mo)",        trigger: "No service in 6 months",   action: "Send win-back SMS",         active: false, lastTriggered: null, count: 0, steps: [] },
  { id: "a12", name: "Referral request",           trigger: "Job completed (3rd+)",     action: "Send referral ask",         active: false, lastTriggered: null, count: 0, steps: [] },
  { id: "a13", name: "Estimate expiring (48h)",    trigger: "Estimate expiring in 48h", action: "Send expiring reminder",    active: false, lastTriggered: null, count: 0, steps: [] },
  { id: "a14", name: "Customer anniversary",       trigger: "Customer anniversary",     action: "Send anniversary discount", active: false, lastTriggered: null, count: 0, steps: [] },
];

export const seedRewardTiers: RewardTier[] = [
  { id: "rt1", label: "First Referral",    minReferrals: 1,  reward: "$25 off next service",      icon: "🥉" },
  { id: "rt2", label: "Refer 3 Friends",   minReferrals: 3,  reward: "$75 service credit",        icon: "🥈" },
  { id: "rt3", label: "Refer 5 Friends",   minReferrals: 5,  reward: "One free standard service", icon: "🥇" },
  { id: "rt4", label: "Referral Champion", minReferrals: 10, reward: "VIP pricing for a year",    icon: "👑" },
];

// ─── Campaign templates ───────────────────────────────────────────────────────

export const campaignTemplates = [
  { id: "ct1",  name: "Seasonal Special",    subject: "Seasonal special — {{company_name}}", body: "Hi {{first_name}}, this month only: 15% off any service. Reply BOOK or call {{company_phone}}. — {{company_name}}" },
  { id: "ct3",  name: "Referral Program",    subject: "Refer a friend, get $25 — {{company_name}}", body: "Hi {{first_name}}, refer a friend and get $25 off your next service when they book. Reply REFER or call {{company_phone}}. — {{company_name}}" },
  { id: "ct4",  name: "Holiday Greeting",    subject: "Happy holidays from {{company_name}}!", body: "Hi {{first_name}}, wishing you a wonderful holiday season! Book early for next season — slots fill fast. — {{company_name}}" },
  { id: "ct5",  name: "New Year Offer",      subject: "New year offer — {{company_name}}", body: "Hi {{first_name}}, 10% off any service booked in January. Reply NEWYEAR or call {{company_phone}}. — {{company_name}}" },
  { id: "ct6",  name: "Win-Back",            subject: "We miss you — {{company_name}}", body: "Hi {{first_name}}, it's been a while! Reply BACK for a returning-customer discount. — {{company_name}}" },
  { id: "ct10", name: "Black Friday Deal",   subject: "Black Friday special — {{company_name}}", body: "Hi {{first_name}}, our biggest discount of the year — 20% off any service booked this weekend. Reply BF20 or call {{company_phone}}. — {{company_name}}" },
  { id: "ct12", name: "Maintenance Plan",    subject: "Set it and forget it — {{company_name}}", body: "Hi {{first_name}}, ask about our maintenance plan — scheduled visits year-round so you never have to think about it. Reply PLAN or call {{company_phone}}. — {{company_name}}" },
  { id: "ct14", name: "Commercial Accounts", subject: "Service plans for businesses — {{company_name}}", body: "Hi {{first_name}}, ask about our recurring commercial service plans. Reply BIZ or call {{company_phone}}. — {{company_name}}" },
];

// ─── Step types ───────────────────────────────────────────────────────────────

export const STEP_TYPES = [
  { type: "trigger",   label: "Trigger",         icon: "⚡", color: "bg-yellow-900/40 border-yellow-700/40" },
  { type: "condition", label: "Condition / Wait", icon: "⏱", color: "bg-blue-900/40 border-blue-700/40"    },
  { type: "action",    label: "Send Message",     icon: "📱", color: "bg-green-900/40 border-green-700/40"  },
  { type: "webhook",   label: "Webhook",          icon: "🔗", color: "bg-purple-900/40 border-purple-700/40"},
  { type: "tag",       label: "Add Tag",          icon: "🏷", color: "bg-orange-900/40 border-orange-700/40"},
];

// ─── Automation templates ─────────────────────────────────────────────────────

export const AUTOMATION_TEMPLATES = [
  {
    id: "tpl_new_lead", name: "New Lead Auto-Response",
    trigger: "New lead received", action: "Send instant SMS",
    description: "Texts every new lead within 60 seconds.",
    steps: [
      { id: uid(), type: "trigger", label: "New lead form submitted", icon: "⚡" },
      { id: uid(), type: "action",  label: "Send SMS: 'Thanks for reaching out...'", channel: "sms", template: "new_lead" },
    ],
  },
  {
    id: "tpl_estimate_followup", name: "Estimate Follow-Up (24h)",
    trigger: "Estimate sent, unopened 24h", action: "Send follow-up SMS",
    description: "Follows up if estimate not opened after 24 hours.",
    steps: [
      { id: uid(), type: "trigger",   label: "Estimate sent",        icon: "⚡" },
      { id: uid(), type: "condition", label: "Wait 24 hours",        delay: 1440 },
      { id: uid(), type: "condition", label: "If NOT viewed",        condition: "estimate_not_viewed" },
      { id: uid(), type: "action",    label: "Send follow-up SMS",   channel: "sms" },
    ],
  },
  {
    id: "tpl_review_request", name: "Post-Job Review Request",
    trigger: "Job completed + 48h", action: "Send review request",
    steps: [
      { id: uid(), type: "trigger",   label: "Job completed",        icon: "⚡" },
      { id: uid(), type: "condition", label: "Wait 48 hours",        delay: 2880 },
      { id: uid(), type: "action",    label: "Send review request",  channel: "sms", template: "review_request" },
    ],
  },
  {
    id: "tpl_birthday", name: "Birthday Message",
    trigger: "Customer birthday (annual)", action: "Send greeting + 10% off",
    steps: [
      { id: uid(), type: "trigger", label: "Customer birthday", icon: "🎂" },
      { id: uid(), type: "action",  label: "Send birthday SMS", channel: "sms", template: "birthday" },
    ],
  },
  {
    id: "tpl_seasonal_spring", name: "Spring Seasonal Reminder",
    trigger: "March 1st annually", action: "Send spring campaign",
    steps: [
      { id: uid(), type: "trigger", label: "Date: March 1st",      icon: "🌸" },
      { id: uid(), type: "action",  label: "Send spring promo SMS", channel: "sms" },
    ],
  },
  {
    id: "tpl_abandoned_estimate", name: "Abandoned Estimate Nurture",
    trigger: "Estimate sent, no response 3 days", action: "3-touch nurture sequence",
    steps: [
      { id: uid(), type: "trigger",   label: "Estimate sent",           icon: "⚡" },
      { id: uid(), type: "condition", label: "Wait 3 days",             delay: 4320 },
      { id: uid(), type: "condition", label: "If not approved",         condition: "estimate_not_approved" },
      { id: uid(), type: "action",    label: "Day 3: Soft follow-up",   channel: "sms" },
      { id: uid(), type: "condition", label: "Wait 4 more days",        delay: 5760 },
      { id: uid(), type: "action",    label: "Day 7: Add urgency",      channel: "sms" },
    ],
  },
  // FEATURE — 5 additional templates, each backed by an already-implemented,
  // already-firing engine category (useAutomationEngine.ts specs) — none of
  // the empty-getCandidates() categories (review_good/review_bad/manual/
  // weekly_scheduled/webhook) are templated here, so every template in this
  // gallery actually sends when approved, not just looks like it does.
  {
    id: "tpl_job_reminder", name: "Job Reminder (24h Before)",
    trigger: "24h before scheduled job", action: "Send reminder SMS",
    description: "Reminds the customer the day before their scheduled service.",
    steps: [
      { id: uid(), type: "trigger", label: "24h before scheduled job", icon: "⏰" },
      { id: uid(), type: "action",  label: "Send reminder SMS", channel: "sms", template: "job_reminder" },
    ],
  },
  {
    id: "tpl_payment_overdue", name: "Overdue Invoice Reminder",
    trigger: "Invoice overdue 7 days", action: "Send payment reminder SMS",
    description: "Nudges customers with an unpaid invoice a week past due.",
    steps: [
      { id: uid(), type: "trigger", label: "Invoice overdue 7 days", icon: "💳" },
      { id: uid(), type: "action",  label: "Send payment reminder SMS", channel: "sms" },
    ],
  },
  {
    id: "tpl_maintenance", name: "90-Day Re-Service Reminder",
    trigger: "90 days since last service", action: "Send re-book SMS",
    description: "Reminds a customer it's time to book again, 90 days after their last service.",
    steps: [
      { id: uid(), type: "trigger", label: "90 days since service", icon: "🔁" },
      { id: uid(), type: "action",  label: "Send re-service SMS", channel: "sms", template: "maintenance_reminder" },
    ],
  },
  {
    id: "tpl_referral_ask", name: "Loyal Customer Referral Ask",
    trigger: "3rd job complete", action: "Ask for a referral",
    description: "Asks a customer to refer a friend after their 3rd completed job with you.",
    steps: [
      { id: uid(), type: "trigger", label: "3rd job complete", icon: "🤝" },
      { id: uid(), type: "action",  label: "Send referral-ask SMS", channel: "sms", template: "referral_ask" },
    ],
  },
  {
    id: "tpl_seasonal_fall", name: "Fall Seasonal Reminder",
    trigger: "October 1st annually", action: "Send fall campaign",
    description: "Annual fall reminder to book seasonal service.",
    steps: [
      { id: uid(), type: "trigger", label: "October 1st annually", icon: "🍂" },
      { id: uid(), type: "action",  label: "Send fall promo SMS", channel: "sms", template: "seasonal_fall" },
    ],
  },
  // AUDIT FIX — "only 16 [really 10] templates exist, need more, all fully
  // functional (not mock-ups)": every one of these, like the 10 above, is
  // built on an engine category (useAutomationEngine.ts's classifyTrigger +
  // specs) that already has a real, non-empty getCandidates() implementation
  // and an existing SMS_TEMPLATES message — none of the genuinely-unbuilt
  // categories (review_good/review_bad/manual/weekly_scheduled/webhook,
  // still empty candidate lists) are templated here, same rule the original
  // 5 followed. Trigger label wording is deliberately exact-matched against
  // classifyTrigger's regexes (verified against its patterns one at a time,
  // including the "1 year since first service" vs. "since service" mainten-
  // ance-category collision already documented in that function's comments).
  {
    id: "tpl_estimate_expiring", name: "Estimate Expiring Soon",
    trigger: "Estimate expires in 48 hours", action: "Send urgency SMS",
    description: "Nudges a customer with a pending quote right before it expires.",
    steps: [
      { id: uid(), type: "trigger", label: "Estimate expires in 48 hours", icon: "⏳" },
      { id: uid(), type: "action",  label: "Send expiring-quote SMS", channel: "sms", template: "estimate_expiring" },
    ],
  },
  {
    id: "tpl_job_reminder_morning", name: "Morning-Of Job Reminder",
    trigger: "Job day morning", action: "Send day-of reminder SMS",
    description: "A same-day, morning-of text for every job scheduled today (6-10am).",
    steps: [
      { id: uid(), type: "trigger", label: "Job day morning", icon: "🌤" },
      { id: uid(), type: "action",  label: "Send morning-of reminder SMS", channel: "sms", template: "job_reminder" },
    ],
  },
  {
    id: "tpl_crew_starts", name: "Crew Started Notification",
    trigger: "Crew starts job", action: "Send 'on our way in' SMS",
    description: "Lets the customer know the crew has begun work on-site.",
    steps: [
      { id: uid(), type: "trigger", label: "Crew starts job", icon: "🚚" },
      { id: uid(), type: "action",  label: "Send crew-started SMS", channel: "sms", template: "crew_starts" },
    ],
  },
  {
    id: "tpl_job_scheduled", name: "New Booking Confirmation",
    trigger: "Job scheduled", action: "Send booking confirmation SMS",
    description: "Confirms the appointment the moment a job is scheduled.",
    steps: [
      { id: uid(), type: "trigger", label: "Job scheduled", icon: "📅" },
      { id: uid(), type: "action",  label: "Send booking confirmation SMS", channel: "sms", template: "job_scheduled" },
    ],
  },
  {
    id: "tpl_estimate_viewed", name: "Estimate Viewed Follow-Up",
    trigger: "Estimate viewed", action: "Send viewed-acknowledgment SMS",
    description: "Follows up the moment a customer opens their quote, while it's top of mind.",
    steps: [
      { id: uid(), type: "trigger", label: "Estimate viewed", icon: "👀" },
      { id: uid(), type: "action",  label: "Send viewed-ack SMS", channel: "sms", template: "estimate_viewed_ack" },
    ],
  },
  {
    id: "tpl_estimate_accepted", name: "Estimate Accepted Confirmation",
    trigger: "Estimate accepted", action: "Send thank-you + next-steps SMS",
    description: "Confirms approval and sets expectations for scheduling.",
    steps: [
      { id: uid(), type: "trigger", label: "Estimate accepted", icon: "✅" },
      { id: uid(), type: "action",  label: "Send acceptance confirmation SMS", channel: "sms", template: "estimate_accepted" },
    ],
  },
  {
    id: "tpl_payment_received", name: "Payment Received Thank-You",
    trigger: "Payment received", action: "Send thank-you SMS",
    description: "Thanks the customer the moment their payment clears.",
    steps: [
      { id: uid(), type: "trigger", label: "Payment received", icon: "💵" },
      { id: uid(), type: "action",  label: "Send payment thank-you SMS", channel: "sms", template: "payment_received" },
    ],
  },
  {
    id: "tpl_payment_overdue_3", name: "Overdue Invoice — Friendly (3-Day)",
    trigger: "Invoice overdue 3 days", action: "Send friendly payment reminder SMS",
    description: "A soft first nudge, 3 days after an invoice goes past due.",
    // BUG FIX — a [trigger, action]-only step list (no explicit "condition"
    // step carrying a numeric `delay`) makes extractDirectives() in
    // useAutomationEngine.ts fall back to the payment_overdue category's
    // hardcoded 7-day spec.defaultDelayMinutes, silently ignoring the "3
    // days" in this template's own name/trigger — deriveDaysFromLabel only
    // ever runs for LEGACY automations (steps.length === 0), which a
    // template-created automation never is. Without this explicit condition
    // step, this template and the 14-day one below both actually fired at
    // the same 7-day mark once saved from the template gallery.
    steps: [
      { id: uid(), type: "trigger",   label: "Invoice overdue 3 days", icon: "💳" },
      { id: uid(), type: "condition", label: "Wait 3 days", delay: 3 * 1440 },
      { id: uid(), type: "action",    label: "Send friendly reminder SMS", channel: "sms", template: "payment_overdue_3" },
    ],
  },
  {
    id: "tpl_payment_overdue_14", name: "Overdue Invoice — Firm (14-Day)",
    trigger: "Invoice overdue 14 days", action: "Send firm payment reminder SMS",
    description: "A firmer follow-up once an invoice is two-plus weeks overdue.",
    // BUG FIX — see tpl_payment_overdue_3's comment above; same missing
    // explicit delay step, same silent fallback to the 7-day default.
    steps: [
      { id: uid(), type: "trigger",   label: "Invoice overdue 14 days", icon: "🚨" },
      { id: uid(), type: "condition", label: "Wait 14 days", delay: 14 * 1440 },
      { id: uid(), type: "action",    label: "Send firm reminder SMS", channel: "sms", template: "payment_overdue_14" },
    ],
  },
  {
    id: "tpl_reengage", name: "Win-Back — 6 Months Inactive",
    trigger: "No service 6 months", action: "Send win-back SMS",
    description: "Re-engages a customer who hasn't booked in half a year.",
    steps: [
      { id: uid(), type: "trigger", label: "No service 6 months", icon: "🔄" },
      { id: uid(), type: "action",  label: "Send win-back SMS", channel: "sms", template: "reengage" },
    ],
  },
  {
    id: "tpl_anniversary", name: "Customer Anniversary",
    trigger: "1 year since first service", action: "Send anniversary SMS",
    description: "Celebrates a full year as a customer with a thank-you and discount.",
    steps: [
      { id: uid(), type: "trigger", label: "1 year since first service", icon: "🎉" },
      { id: uid(), type: "action",  label: "Send anniversary SMS", channel: "sms", template: "anniversary" },
    ],
  },
  {
    id: "tpl_referral_reward", name: "Referral Reward Earned",
    trigger: "Referral reward earned", action: "Send reward notification SMS",
    description: "Tells a customer their referral just earned them a credit.",
    steps: [
      { id: uid(), type: "trigger", label: "Referral reward earned", icon: "🎁" },
      { id: uid(), type: "action",  label: "Send reward SMS", channel: "sms", template: "referral_reward" },
    ],
  },
  {
    id: "tpl_referral_booked", name: "Referral Booked Thank-You",
    trigger: "Referral booked", action: "Send thank-you SMS",
    description: "Thanks the referring customer as soon as their referral books a first job.",
    steps: [
      { id: uid(), type: "trigger", label: "Referral booked", icon: "🤝" },
      { id: uid(), type: "action",  label: "Send referral-booked SMS", channel: "sms", template: "referral_booked" },
    ],
  },
  // FEATURE — owner/employee/client report automations (useAutomationEngine.ts
  // owner_daily_summary/owner_periodic_summary/weekly_scheduled/
  // employee_shift_summary/employee_performance_report categories, plus the
  // two client templates below which reuse the already-firing review_request
  // and payment_received categories with custom messageBody text). Every
  // trigger label here is exact-matched against classifyTrigger's regexes —
  // see that function's comments for why label wording matters.
  // "Owner: End-of-Day Summary" template removed — App.tsx's
  // checkAndSendDailySummary effect already sends this exact recap
  // unconditionally, direct, once per day after 6pm, no approval gate.
  // Adding this template just re-queued the same summary a second time
  // through the "review before sending" approval popup — see
  // useAutomationEngine.ts's owner_daily_summary comment.
  {
    id: "tpl_owner_periodic_summary", name: "Owner: Quarterly & Yearly Summary",
    trigger: "Quarterly business summary", action: "Email business performance summary",
    // AUDIT — the engine has no arbitrary cron scheduler; this fires on the
    // 1st of each calendar quarter (Jan/Apr/Jul/Oct), the closest supported
    // cadence to "quarterly" — Jan 1st doubles as the yearly firing too. See
    // owner_periodic_summary's comment in useAutomationEngine.ts.
    description: "Emails a business performance summary (jobs, revenue, new customers) on the 1st of each quarter — the closest cadence the engine supports to quarterly/yearly.",
    steps: [
      { id: uid(), type: "trigger", label: "Quarterly business summary", icon: "📊" },
      { id: uid(), type: "action",  label: "Email quarterly/yearly summary", channel: "email",
        messageBody: "Hi {{first_name}}, your quarterly business summary: {{period_jobs}} jobs completed, {{period_revenue}} in revenue, and {{period_new_customers}} new customers this quarter. — CRM Starter Automations" },
    ],
  },
  {
    id: "tpl_owner_progress_report", name: "Owner: Weekly Progress Report",
    trigger: "Weekly progress report", action: "Email goals/KPI progress",
    description: "Emails your weekly goals progress (from Accountability → Goals) every Monday morning.",
    steps: [
      { id: uid(), type: "trigger", label: "Weekly progress report", icon: "🎯" },
      { id: uid(), type: "action",  label: "Email weekly progress report", channel: "email",
        messageBody: "Hi {{first_name}}, here's your weekly goals progress: {{goals_summary}} — CRM Starter Automations" },
    ],
  },
  // "Employee: Shift Summary" template removed — EmployeePortal.tsx already
  // sends this exact recap unconditionally, direct, the moment "End My Day"
  // is tapped (both employee and owner, with a fuller breakdown than this
  // template's single line). Adding this template just re-queued the same
  // thing a second time through the approval popup, reading as "this
  // already sent, why is it asking again" — see useAutomationEngine.ts's
  // employee_shift_summary spec, which now always returns no candidates for
  // the same reason.
  {
    id: "tpl_employee_performance_report", name: "Employee: Performance Report",
    trigger: "Weekly performance report", action: "Email that employee's performance report",
    description: "Emails each active employee a weekly recap of their completed jobs and current rating, every Monday morning.",
    steps: [
      { id: uid(), type: "trigger", label: "Weekly performance report", icon: "📈" },
      { id: uid(), type: "action",  label: "Email performance report", channel: "email",
        messageBody: "Hi {{first_name}}, your weekly performance report: {{jobs_completed}} jobs completed this week, current rating {{rating}}/5. Keep it up!" },
    ],
  },
  {
    id: "tpl_client_post_service_followup", name: "Client: Post-Service Follow-Up",
    trigger: "Job completed", action: "Send thank-you follow-up SMS",
    // Rides the already-implemented review_request engine category (job
    // completed, within a 14-day window) but with a plain thank-you message
    // instead of a review ask — deliberately distinct from the existing
    // "Post-Job Review Request" template so an owner can run both without
    // duplicate wording.
    description: "Thanks a customer 48 hours after their job is marked complete — a warm follow-up, not a review ask.",
    steps: [
      { id: uid(), type: "trigger",   label: "Job completed",      icon: "✅" },
      { id: uid(), type: "condition", label: "Wait 48 hours",      delay: 2880 },
      { id: uid(), type: "action",    label: "Send thank-you SMS", channel: "sms",
        messageBody: "Hi {{first_name}}, thanks for trusting us with your recent service! We hope you're loving the results — reach out anytime if you need anything. — CRM Starter" },
    ],
  },
  {
    id: "tpl_client_referral_request", name: "Client: Referral Request",
    trigger: "Payment received", action: "Send referral request SMS",
    // Rides the already-implemented payment_received engine category (fires
    // within 3 days of an invoice being paid) with an explicit 1-day delay,
    // and reuses the customer's existing referralCode/#/referral link
    // (ReferralsPage.tsx/ClientAuthPortal.tsx) rather than inventing a new
    // referral mechanism.
    description: "Asks a customer for a referral a day after their invoice is paid, linking their existing referral code.",
    steps: [
      { id: uid(), type: "trigger",   label: "Payment received",  icon: "💵" },
      { id: uid(), type: "condition", label: "Wait 1 day",        delay: 1440 },
      { id: uid(), type: "action",    label: "Send referral-request SMS", channel: "sms",
        messageBody: "Hi {{first_name}}, thanks for your payment! Know anyone who could use our services? Share your referral link and you'll both earn rewards: {{referral_link}} — CRM Starter" },
    ],
  },
  // AUDIT FIX ("more automations for CLIENT experience generally") — each of
  // these rides an already-implemented, already-firing engine category
  // (job_reminder / maintenance / reengage in useAutomationEngine.ts) with a
  // genuinely different real cadence than the templates already above,
  // rather than duplicating one of them with different words. Every trigger
  // label is exact-matched against classifyTrigger's regexes. Each one also
  // carries its own explicit "condition" step with a numeric `delay` — see
  // tpl_payment_overdue_3's comment above: extractDirectives() only reads
  // custom timing off a real condition step; a [trigger, action]-only
  // template silently falls back to the category's hardcoded default delay
  // no matter what the label says.
  {
    id: "tpl_client_appointment_reminder_2h", name: "Client: Last-Minute Appointment Reminder (2h)",
    trigger: "2 hours before scheduled job", action: "Send last-minute reminder SMS",
    description: "A second, closer-in reminder 2 hours before the job — useful for same-day bookings or customers who need a tighter heads-up than the 24h reminder gives.",
    steps: [
      { id: uid(), type: "trigger",   label: "2 hours before scheduled job", icon: "⏰" },
      { id: uid(), type: "condition", label: "2 hours before", delay: 2 * 60 },
      { id: uid(), type: "action",    label: "Send 2-hour reminder SMS", channel: "sms",
        messageBody: "Hi {{first_name}}, quick heads up — your CRM Starter crew is scheduled to arrive in about 2 hours. See you soon!" },
    ],
  },
  {
    id: "tpl_client_reservice_45day", name: "Client: 45-Day Re-Service Check-In",
    trigger: "45 days since service", action: "Send re-service check-in SMS",
    description: "A faster re-service nudge (45 days, not the standard 90) for high-frequency accounts like storefronts or HOAs that need more regular service.",
    steps: [
      { id: uid(), type: "trigger",   label: "45 days since service", icon: "🔁" },
      { id: uid(), type: "condition", label: "Wait 45 days", delay: 45 * 1440 },
      { id: uid(), type: "action",    label: "Send 45-day check-in SMS", channel: "sms",
        messageBody: "Hi {{first_name}}, it's been 45 days since your last CRM Starter service — ready for another round? Reply BOOK or call {{company_phone}}." },
    ],
  },
  {
    id: "tpl_client_early_winback_4mo", name: "Client: Early Win-Back (4 Months)",
    trigger: "120 days no service", action: "Send early win-back SMS",
    // Matches the "reengage" category via "no service" (not "since service",
    // which would collide with the maintenance category above — see
    // classifyTrigger's comments).
    description: "An earlier win-back touch (about 4 months, not the standard 6) for owners who'd rather catch a lapsing customer sooner.",
    steps: [
      { id: uid(), type: "trigger",   label: "120 days no service", icon: "🔄" },
      { id: uid(), type: "condition", label: "Wait 120 days", delay: 120 * 1440 },
      { id: uid(), type: "action",    label: "Send early win-back SMS", channel: "sms",
        messageBody: "Hi {{first_name}}, it's been a few months since your last CRM Starter service — want us to get you back on the schedule? Reply BOOK for 10% off." },
    ],
  },
  // Each of the templates below rides one of the engine categories added
  // alongside them in useAutomationEngine.ts (estimate_declined,
  // estimate_expired, job_cancelled, first_job_welcome, vip_thank_you,
  // recurring_service_due, owner_reschedule_request, owner_unassigned_job) —
  // every trigger label is exact-matched by classifyTrigger() there.
  {
    id: "tpl_estimate_declined_winback", name: "Quote Declined — Soft Win-Back",
    trigger: "Estimate declined", action: "Send a no-pressure win-back SMS",
    description: "One respectful follow-up a day after a customer declines a quote, inviting them to talk price rather than walk away.",
    steps: [
      { id: uid(), type: "trigger",   label: "Estimate declined", icon: "🙅" },
      { id: uid(), type: "condition", label: "Wait 1 day", delay: 1440 },
      { id: uid(), type: "action",    label: "Send win-back SMS", channel: "sms", template: "estimate_declined" },
    ],
  },
  {
    id: "tpl_estimate_expired_reissue", name: "Quote Expired — Offer to Re-Issue",
    trigger: "Estimate expired", action: "Offer to re-issue at the same price",
    description: "Catches quotes that quietly lapsed past their valid-until date and offers to honour the original price.",
    steps: [
      { id: uid(), type: "trigger", label: "Estimate expired", icon: "⌛" },
      { id: uid(), type: "action",  label: "Send re-issue offer SMS", channel: "sms", template: "estimate_expired" },
    ],
  },
  {
    id: "tpl_job_cancelled_rebook", name: "Cancelled Job — Rebook Offer",
    trigger: "Job cancelled", action: "Invite the customer to rebook",
    description: "Texts a customer whose job was cancelled to get them back on the schedule instead of losing them silently.",
    steps: [
      { id: uid(), type: "trigger", label: "Job cancelled", icon: "🚫" },
      { id: uid(), type: "action",  label: "Send rebook SMS", channel: "sms", template: "job_cancelled" },
    ],
  },
  {
    id: "tpl_first_job_welcome", name: "First Job — New Customer Welcome",
    trigger: "First job completed", action: "Send a welcome/save-our-number SMS",
    description: "Fires only after a customer's very first completed job — a warm welcome that turns a one-off into a repeat account.",
    steps: [
      { id: uid(), type: "trigger",   label: "First job completed", icon: "🎉" },
      { id: uid(), type: "condition", label: "Wait 1 day", delay: 1440 },
      { id: uid(), type: "action",    label: "Send welcome SMS", channel: "sms", template: "first_job_welcome" },
    ],
  },
  {
    id: "tpl_vip_thank_you", name: "VIP Customer Thank-You",
    trigger: "VIP customer milestone", action: "Send a VIP perk SMS",
    description: "Thanks your highest-lifetime-spend customers after a recent job. Set the spend threshold in Automations → Automation Settings.",
    steps: [
      { id: uid(), type: "trigger", label: "VIP customer milestone", icon: "👑" },
      { id: uid(), type: "action",  label: "Send VIP thank-you SMS", channel: "sms", template: "vip_thank_you" },
    ],
  },
  {
    id: "tpl_recurring_service_due", name: "Recurring Service Coming Due",
    trigger: "Recurring service due", action: "Send a rebook reminder",
    description: "Reads the recurring schedule already on the job (weekly/monthly/quarterly…) and reminds the customer about 3 days before the next one is due.",
    steps: [
      { id: uid(), type: "trigger", label: "Recurring service due", icon: "🔁" },
      { id: uid(), type: "action",  label: "Send recurring-due SMS", channel: "sms", template: "recurring_due" },
    ],
  },
  {
    id: "tpl_owner_reschedule_alert", name: "Owner: Reschedule Requested",
    trigger: "Reschedule requested", action: "Email the owner the request",
    description: "Emails you as soon as a customer asks to move a job from their portal, so the request doesn't sit unnoticed.",
    steps: [
      { id: uid(), type: "trigger", label: "Reschedule requested", icon: "📆" },
      { id: uid(), type: "action",  label: "Email reschedule alert", channel: "email",
        messageBody: "Heads up — {{customer_name}} requested a reschedule for the job at {{job_address}} on {{date}}. Their note: {{reschedule_note}}" },
    ],
  },
  {
    id: "tpl_owner_unassigned_job_alert", name: "Owner: Tomorrow's Job Has No Crew",
    trigger: "Unassigned job tomorrow", action: "Email the owner an alert",
    description: "Emails you when a job scheduled for tomorrow still has nobody assigned — the single easiest way to miss a job.",
    steps: [
      { id: uid(), type: "trigger", label: "Unassigned job tomorrow", icon: "⚠️" },
      { id: uid(), type: "action",  label: "Email unassigned-job alert", channel: "email",
        messageBody: "Heads up — the job for {{customer_name}} at {{job_address}} on {{date}} still has nobody assigned to it." },
    ],
  },
];

// AUDIT FIX ("I'm not seeing any for owners") — root cause: the owner/
// employee/client report templates above were only ever reachable through
// Automations → Templates → pick one → Save in the workflow builder (see
// AutomationsPage.tsx's templatesOpen modal), a manual 3-click path with no
// indication anything changed. Worse, `crm.automations` is a
// usePersistent/localStorage value (App.tsx) — its seed default
// (seedAutomations below) only ever applies the very first time that key has
// never been written, so an existing owner's browser had a stored automations
// array from before these templates existed and would NEVER pick up new seed
// entries automatically. automationFromTemplate() converts a template
// straight into a live, already-active Automation (same shape
// AutomationsPage's VisualWorkflowBuilder onSave produces), for a one-time
// backfill in App.tsx that adds any of the report/client templates an
// existing owner doesn't already have — see the automationsReportBackfillV1
// effect in App.tsx.
export const automationFromTemplate = (tpl: any): Automation => {
  const steps = (tpl.steps || []).map((s: any) => ({ ...s, id: uid() }));
  const firstTrigger = steps.find((s: any) => s.type === "trigger");
  const firstAction = steps.find((s: any) => s.type === "action");
  return {
    id: tpl.id,
    name: tpl.name,
    trigger: firstTrigger?.label || tpl.trigger || "Manual",
    action: firstAction?.label || tpl.action || "",
    steps,
    isWorkflow: true,
    category: tpl.category || "other",
    icon: tpl.icon || "⚡",
    description: tpl.description || "",
    count: 0,
    lastTriggered: null,
    active: true,
    sentLog: {},
    runLog: [],
  } as unknown as Automation;
};

// ─── Seed revenue chart data ───────────────────────────────────────────────────

export const seedRevenue: { month: string; revenue: number; expenses: number; jobs: number }[] = [];
