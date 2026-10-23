// ─── Customer ─────────────────────────────────────────────────────────────────

export interface CustomField {
  key: string;
  value: string;
}

export interface CustomerAddress {
  id: string;
  label?: string;
  street: string;
  city?: string;
  state?: string;
  zip?: string;
  propertyType?: "residential" | "commercial";
  sqFootage?: number;
  notes?: string;
  isPrimary?: boolean;
}

export interface Customer {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  address: string;
  city?: string;
  state?: string;
  zip?: string;
  sqFootage?: number;
  tags: string[];
  // FEATURE — customer folders (simplified: a single flat folder name per
  // customer, filterable — not nested subfolders or drag-and-drop).
  folder?: string;
  // FEATURE — Twilio A2P 10DLC campaign compliance: durable proof of SMS
  // opt-in consent, captured at the point a phone number is first collected
  // (LeadFormPage.tsx). smsOptInAt is the actual compliance record (a
  // timestamp); smsOptIn is just for quick UI reads.
  smsOptIn?: boolean;
  smsOptInAt?: string;
  // FEATURE — text-to-opt-in keyword flow (Twilio A2P "via text" opt-in
  // requirement): double opt-in — texting the keyword sets this pending
  // flag and sends a confirmation REQUEST; only replying Y/YES flips
  // smsOptIn to true. See functions/api/twilio-sms-webhook.ts.
  smsOptInPending?: boolean;
  smsOptInPendingAt?: string;
  notes?: string;
  totalSpent: number;
  createdAt: string;
  gateCode?: string;
  hasDog?: boolean;
  dogName?: string;
  sensitivePlants?: string;
  leadSource?: string;
  // FEATURE — Lead Intake page (LeadIntakePage.tsx) "Archive" action. A lead
  // is just a `customers` row with pipelineStage === "lead" (see
  // LeadFormPage.tsx); archiving hides it from the active leads list without
  // deleting the record, distinct from "Convert to Customer" (which advances
  // pipelineStage) and "Delete" (which removes the row entirely).
  leadArchived?: boolean;
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  smsOptOut?: boolean;
  optOutDate?: string;
  // FEATURE (round 13, item 12) — flags this customer as a test client. When
  // Settings → Testing Mode is on, every real SMS/email/automation send to
  // this customer is blocked at the source (lib/messaging.ts) so the owner
  // can safely run end-to-end tests without messaging a real person.
  isTestClient?: boolean;
  customFields?: CustomField[];
  referralCode?: string;
  referralCreditOwed?: number;
  referralCreditApplied?: number;
  birthday?: string;
  referredBy?: string;
  reviewRequested?: string;
  portalToken?: string;
  addresses?: CustomerAddress[];
  isCommercial?: boolean;
  recurringPayment?: { enabled: boolean; frequency: "monthly" | "quarterly"; amount?: number; nextDate?: string };
  stripeCustomerId?: string;
  // savedPaymentMethodId/Label are the DEFAULT card — every existing charge
  // path (in-person checkout, invoice auto-charge, recurring billing) reads
  // only these two and keeps working unmodified. savedPaymentMethods below
  // is the full list a customer can build up; adding a card appends here
  // and, if it's the first one or the customer marks it default, also
  // updates the two fields above.
  savedPaymentMethodId?: string;
  savedPaymentMethodLabel?: string;
  savedPaymentMethods?: Array<{ id: string; label: string; addedAt: string }>;
  // FEATURE — card-on-file consent, same durable-timestamp convention as
  // smsOptInAt above: set whenever SaveCardModal.tsx successfully saves a
  // card, so there's a record of when the customer (or the employee entering
  // it on their behalf) agreed to keep it on file for future charges.
  cardConsentAt?: string;
  // FEATURE — photo/video release opt-out (client-side). Paired with
  // Employee.mediaOptOut below. Data flag only — nothing currently filters
  // marketing use by this flag, it's just recorded and shown in the terms
  // clause (see LegalPages.tsx TermsPage).
  mediaOptOut?: boolean;
  // FEATURE — per-customer Alfred auto-response (opt-in, off by default).
  // When true, a text FROM this customer's phone is handed to a separate,
  // deliberately narrow customer-facing Alfred agent instead of just being
  // logged for the owner to answer manually — see
  // functions/api/_lib/alfredCustomerAgent.ts for its guardrails. Anything
  // beyond routine Q&A (reschedule, cancel, money) still requires the
  // owner's explicit yes/no before Alfred acts or promises anything.
  alfredAutoRespond?: boolean;
}

// ─── Estimate ─────────────────────────────────────────────────────────────────

export interface LineItem {
  id: string;
  description: string;
  quantity: number;
  unitPrice: number;
  catalogPrice?: number;
  photo?: string;
  notes?: string;
  notesInternal?: boolean;
  optional?: boolean;
  // FEATURE 4 — links this line item back to the Service catalog entry it was
  // added from (EstimateBuilder's addSvc), so a job created from this estimate
  // can look up and combine that service's checklistTemplate. Undefined for
  // freeform/manually-typed line items with no catalog match.
  serviceId?: string;
}

export interface EstimatePackage {
  id: string;
  name: string;
  description?: string;
  lineItems: LineItem[];
  subtotal: number;
}

// FEATURE 7 — a single manual discount line (title + dollar-or-percent
// amount), stackable — an estimate/job can have several. Kept separate from
// the legacy single `discount: number` field (still summed in for back-compat
// with estimates/jobs created before this existed) via computeDiscountsTotal
// (lib/utils.ts), the one place that combines both into an effective total.
export interface Discount {
  id: string;
  label: string;
  type: "amount" | "percent";
  value: number;
}

export interface Estimate {
  id: string;
  customerId: string;
  // ITEM 16 — link back to the Job this invoice was generated from (only set
  // when created via "Send Invoice" on a completed job; owner-built
  // estimates/quotes have no job yet). Lets markPaid/markPaidViaStripe also
  // flip the job's own paymentStatus so the field/employee portal (which
  // reads job.paymentStatus, not the estimates table) reflects payment
  // immediately instead of only updating once the job is separately synced.
  jobId?: string;
  estimateType?: "standard" | "options" | "package";
  packages?: EstimatePackage[];
  lineItems: LineItem[];
  subtotal: number;
  discount: number;
  discounts?: Discount[];
  depositRequired: number;
  // FEATURE 6 — depositRequired is either a flat dollar amount (default,
  // back-compat) or a percentage of the total, selected by depositType.
  // computeDepositAmount (lib/utils.ts) is the single place that resolves
  // either representation to an actual dollar figure.
  depositType?: "amount" | "percent";
  // FEATURE (round 13, item 4) — whether the deposit above is mandatory
  // (customer must pay it to book — "Pay in Full Now"/"Pay in Full After
  // Service" are hidden) or just an optional convenience the customer can
  // still skip in favor of paying everything at once or after service.
  depositMandatory?: boolean;
  tax: number;
  total: number;
  status: "pending" | "approved" | "rejected" | "expired";
  createdAt: string;
  validUntil: string;
  sentAt?: string;
  signedAt?: string;
  paidAt?: string;
  sigData?: string;
  sigType?: "draw" | "type";
  notes?: string;
  internalNote?: string;
  terms?: string;
  viewed?: boolean;
  viewedAt?: string;
  invoiced?: boolean;
  invoicedAt?: string;
  declinedAt?: string;
  // Preset reason the customer picked when declining from their quote link
  // (price/too_expensive/other), shown to the owner as a quick badge instead
  // of having to open every declined estimate to read free text.
  declineReasonCategory?: "price" | "went_elsewhere" | "changed_mind" | "other";
  declineReason?: string;
  paidDeposit?: number;
  depositPaidAt?: string;
  paidFull?: number;
  partialPaid?: number;
  googleEventId?: string;
  conversions?: number;
  stripePaymentIntentId?: string;
  // FEATURE — Square as a second payment processor. Which real charge this
  // is (if any) is now provider-specific: a Square-paid invoice never had
  // its own field before, so its payment id was previously mis-stored under
  // stripePaymentIntentId — real, but the WRONG processor's refund API would
  // get called for it. paymentProvider disambiguates which id field (and
  // therefore which refund API) actually applies. stripePaymentStatus is
  // kept as the shared generic status field for both providers (renaming it
  // would touch too many existing read sites for what it's worth).
  squarePaymentId?: string;
  paymentProvider?: "stripe" | "square";
  stripePaymentStatus?: "unpaid" | "paid" | "refunded" | "partially_refunded";
  // Running total actually refunded so far — lets the UI show "$40 of $120
  // refunded" and cap a new partial refund at what's actually left.
  refundedAmount?: number;
  // AUDIT (round 12) — payment activity log + failure/refund/dispute
  // timestamps. paymentFailedAt/refundedAt/disputedAt are what the existing
  // owner-notification diff effect in App.tsx watches (same pattern as
  // paidAt/clientViewedAt already used there) so a Stripe webhook event
  // surfaces as a toast/bell/email without needing its own notification
  // logic inside the Cloudflare Function itself. paymentLog is the
  // full history for display in InvoicesPage's invoice detail view.
  paymentFailedAt?: string;
  refundedAt?: string;
  disputedAt?: string;
  paymentLog?: Array<{
    id: string;
    type: "paid" | "failed" | "refunded" | "disputed";
    amount?: number;
    at: string;
    method?: string;
    stripePaymentIntentId?: string;
    note?: string;
  }>;
  templateId?: string;
  sendChannel?: "email" | "sms" | "both";
  payChoice?: "now" | "later" | "deposit";
  // FIX 4 (mobile round 2) — recurring services quoted at the estimate
  // stage, before there's a job yet. Same shape as Job's recurring fields
  // (computeNextRecurringDate in lib/utils.ts accepts either) so converting
  // an approved recurring estimate into a job just copies these straight
  // across instead of re-deriving them.
  isRecurring?: boolean;
  recurringMode?: "preset" | "days" | "weeks" | "months" | "weekdays";
  recurringFreq?: string;
  recurringInterval?: number;
  recurringWeekdays?: number[];
}

// ─── Job ──────────────────────────────────────────────────────────────────────

export interface ChecklistItem {
  label: string;
  done: boolean;
  // FEATURE 4 — populated when this item was copied from a Service's
  // checklistTemplate at job-creation time; optional so hand-added ad hoc
  // checklist items (no linked service) keep working exactly as before.
  id?: string;
  required?: boolean;
  photoRequired?: boolean;
}

// FEATURE 4 — a single item in a Service's reusable checklist template
// (Settings → Services). Copied into ChecklistItem[] on job creation via
// buildChecklistFromServices (lib/utils.ts), then freely editable per job.
export interface ServiceChecklistItem {
  id: string;
  label: string;
  required?: boolean;
  photoRequired?: boolean;
}

export interface Photo {
  id: string;
  type: "before" | "after" | "general";
  url?: string;        // Supabase Storage public URL — preferred when present
  dataUrl?: string;    // legacy inline base64 — read via mediaSrc() alongside url
  caption?: string;
  uploadedAt?: string;
}

export interface ChecklistPhoto {
  id: string;
  url?: string;
  dataUrl?: string;
  caption?: string;
}

export interface JobChecklistItem {
  id: string;
  label: string;
  done: boolean;
  photos?: ChecklistPhoto[];
  videos?: ChecklistPhoto[];
  notes?: string;
  // FEATURE — "assign specific checklist items to specific employees."
  // An employee id (matches job.crew entries) — when set, only that crew
  // member (or the owner) can check the item off; unassigned (undefined)
  // means any crew member on the job can. Optional so every existing job's
  // checklist keeps working exactly as before (nothing assigned = open to all).
  assignedTo?: string;
}

export interface JobVideo {
  id: string;
  url?: string;
  dataUrl?: string;
  caption?: string;
  addedAt?: string;
}

export interface JobSignOff {
  signerName: string;
  timestamp: string;
  sigUrl?: string;     // Supabase Storage URL for the drawn-signature PNG
  sigData?: string;    // legacy inline base64 canvas PNG
  sigType?: "type" | "draw";
}

export interface ChemicalUsed {
  name: string;
  amount: string;
  unit: string;
  cost: number;
}

export interface CommLogEntry {
  id: string;
  type: "sms" | "email" | "call" | "note";
  note: string;
  date: string;
  direction?: "in" | "out";
}

export interface Job {
  id: string;
  customerId: string;
  address: string;
  amount: number;
  // FEATURE 7 — manual discounts (title + $ or % each, stackable). amount
  // above stays the job's list price; computeDiscountsTotal (lib/utils.ts)
  // resolves this array to a dollar total that JobsPage/JobDetailModal
  // subtract for the actual charged amount.
  discounts?: Discount[];
  status: "scheduled" | "in_progress" | "completed" | "cancelled";
  scheduledDate: string;
  scheduledTime?: string;
  // Set by the field portal's "Can't Finish / Reschedule" flow (with or
  // without a picked date) so the owner's Unscheduled tab surfaces it until
  // the owner confirms a real schedule, per explicit request that even a
  // job with a crew-picked date should stay flagged there.
  needsReschedule?: boolean;
  duration?: number;
  estimatedDuration?: number;
  priority: "low" | "normal" | "high" | "urgent";
  crew: string[];
  crewAssignedAt?: Record<string, number>;
  arrivedAt?: number;
  checklist: ChecklistItem[];
  photos: Photo[];
  notes?: string;
  internalNotes?: string;
  commLog: CommLogEntry[];
  chemicalsUsed: ChemicalUsed[];
  equipment: string[];
  requiredChemicals?: string[];
  equipmentChecked?: boolean;
  tags: string[];
  loggedHours?: number;
  laborCost?: number;
  materialCost?: number;
  clockInAt?: number | null;
  lunchStartAt?: number | null;
  lunchMinutes?: number;
  lunchExceeded?: boolean;
  isRecurring?: boolean;
  recurringFreq?: string;
  // FEATURE 3 — custom recurring schedules, layered on top of the original
  // preset-only recurringFreq. recurringMode selects which of these applies;
  // "preset" (default, back-compat) keeps using recurringFreq + recurringFreqs'
  // fixed day counts. recurringInterval is the "X" in "every X days/weeks/months".
  // recurringWeekdays (0=Sun..6=Sat) is used only when recurringMode === "weekdays".
  recurringMode?: "preset" | "days" | "weeks" | "months" | "weekdays";
  recurringInterval?: number;
  recurringWeekdays?: number[];
  isCash?: boolean;
  tip?: number;
  noShow?: boolean;
  cancelReason?: string;
  googleEventId?: string;
  pipelineStage?: string;
  stageChangedAt?: string;
  createdAt?: string;
  lostReason?: string;
  lat?: number;
  lng?: number;
  // FEATURE (round 13, item 7) — customer-initiated reschedule request from
  // the client portal (ClientAuthPortal.tsx). Doesn't move the job itself —
  // the owner still confirms and reschedules manually from Jobs/Calendar,
  // this just surfaces the request clearly instead of it arriving only as a
  // one-off text/call.
  rescheduleRequested?: boolean;
  rescheduleRequestNote?: string;
  rescheduleRequestedAt?: string;
  _showProfit?: boolean;
  paymentType?: "Cash" | "Check" | "Card" | "Zelle" | "Venmo" | "Invoice";
  paymentStatus?: "Pending" | "Partial" | "Paid";
  amountCollected?: number;
  customerAccepted?: boolean;
  preChecklist?: JobChecklistItem[];
  duringChecklist?: JobChecklistItem[];
  postChecklist?: JobChecklistItem[];
  videos?: JobVideo[];
  signOff?: JobSignOff;
  rainGuarantee?: boolean;
  rainGuaranteeDate?: string | null;
  weatherOverride?: boolean;
  sqFootage?: number;
  sqFtRate?: number;
  attachments?: { id: string; name: string; type: string; url?: string; size?: number; uploadedAt?: number }[];
  signOffTerms?: string;
  completedAt?: string;
  invoiceSentAt?: string;
  estimateId?: string;
  jobType?: "residential" | "commercial";
  // FEATURE — "don't send a review request after this job" (EmployeePortal's
  // Report Problem panel) — migration 0094.
  skipReviewRequest?: boolean;
  // FEATURE — commercial/night job work orders (migration 0094). Still an
  // ordinary Job row — see JobsPage.tsx's "This is a work order" section and
  // EmployeePortal.tsx's photo-requirement gating on Complete.
  isWorkOrder?: boolean;
  // FEATURE — Calendar page's separate "Commercial" vs "Night Jobs" views
  // (CalendarPage.tsx) split isWorkOrder jobs on this flag — both are still
  // ordinary work-order jobs, just scheduled during the day vs. overnight.
  isNightJob?: boolean;
  workOrderNumber?: string;
  workOrderClient?: string;
  requiresManagerSignoff?: boolean;
  photoRequirements?: PhotoRequirement[];
  photoRequirementTags?: Record<string, string>; // photoId -> requirement id
  managerSignatureDataUrl?: string;
  managerSignedAt?: string;
  managerSignedBy?: string;
  workOrderSummary?: string;
  workOrderSummarySentAt?: string;
  workOrderNotes?: { id: string; text: string; at: string; by?: string }[];
}

export interface PhotoRequirement {
  id: string;
  label: string;
  kind: "photo" | "video";
  minCount: number;
  instructions?: string;
}

// ─── Employee ─────────────────────────────────────────────────────────────────

export interface Employee {
  id: string;
  firstName: string;
  lastName: string;
  role: string;
  status: "active" | "inactive";
  hourlyRate: number;
  phone?: string;
  email?: string;
  isNewHire?: boolean;
  startDate?: string;
  emergencyContact?: string;
  notes?: string;
  autoSyncCalendar?: boolean;
  homeBaseAddress?: string;
  ratingScore?: number;
  lastPaidThrough?: string;
  dayClockInAt?: number;
  dayLunchStartAt?: number | null;
  dayPausedMinutes?: number;
  lastShiftHours?: number;
  lastShiftDate?: string;
  paidPeriods?: Record<string, "paid" | "unpaid">;
  paidDays?: Record<string, "paid" | "unpaid">;
  paidJobs?: Record<string, "paid" | "unpaid">;
  locationSharing?: boolean;
  lastLocation?: { lat: number; lng: number; updatedAt: number };
  jobTypeRates?: Record<string, number>;
  managerPermissions?: Record<string, boolean>;
  // FEATURE 5 — employee availability & days-off limits. availability is
  // specific blocked dates (YYYY-MM-DD); recurringDaysOff is weekday indices
  // (0=Sun..6=Sat) blocked every week (e.g. "every Sunday"). max* are owner-set
  // caps, surfaced as a badge in EmployeesPage rather than a hard block.
  availability?: string[];
  recurringDaysOff?: number[];
  maxDaysOffPerWeek?: number;
  maxDaysOffPerMonth?: number;
  // FEATURE — photo/video release opt-out (employee-side). Mirrors
  // Customer.mediaOptOut. Data flag only for now — see that field's comment.
  mediaOptOut?: boolean;
  // FEATURE — owner-set skills/strengths/weaknesses, visible on the
  // employee's profile and used as a lightweight job-assignment hint (e.g.
  // "doesn't like roofs" surfaces as a warning when assigned a roof-cleaning
  // job). skills is a tag list matched loosely against job type/service
  // names; strengths/weaknesses are free text since they're rarely a clean
  // list ("great with difficult customers", "slow starter in the morning").
  skills?: string[];
  strengths?: string;
  weaknesses?: string;
}

// ─── Vehicle / Fleet ──────────────────────────────────────────────────────────

export interface Vehicle {
  id: string;
  year: number;
  make: string;
  model: string;
  plate?: string;
  mileage: number;
  lastOilChange?: number;
  lastOilChangeDate?: string;
  notes?: string;
  status?: "active" | "inactive";
}

export interface MaintenanceRecord {
  id: string;
  vehicleId: string;
  type: string;
  date: string;
  mileage: number;
  cost: number;
  notes?: string;
}

// ─── Expense ──────────────────────────────────────────────────────────────────

export interface Expense {
  id: string;
  date: string;
  description: string;
  amount: number;
  category: string;
  vendor?: string;
  receiptDataUrl?: string;
  isBusiness?: boolean;
  isCash?: boolean;
  isDeductible?: boolean;
}

// ─── Chemical ─────────────────────────────────────────────────────────────────

// FEATURE — "Inventory & Equipment": itemType distinguishes a consumable
// (chemical, tracked in gallons/oz) from durable equipment (tools,
// surface cleaners — tracked as countable units). suppliers is a real list
// (name + phone, so the owner can keep every supplier on file and call one
// straight from an item), replacing the old single free-text `supplier`
// string — kept as a deprecated fallback so existing data still displays.
export interface ChemicalSupplier {
  id: string;
  name: string;
  phone?: string;
  email?: string;
  website?: string;
  notes?: string;
}

export interface Chemical {
  id: string;
  maintenanceContactName?: string;
  maintenanceContactPhone?: string;
  name: string;
  itemType?: "chemical" | "equipment";
  brand?: string;
  stock: number;
  unit: string;
  unitCost: number;
  reorderLevel: number;
  /** @deprecated use suppliers[] — kept so existing single-string data still shows */
  supplier?: string;
  suppliers?: ChemicalSupplier[];
  notes?: string;
  lastOrdered?: string;
}

// ─── Service ──────────────────────────────────────────────────────────────────

export interface Service {
  id: string;
  name: string;
  description?: string;
  customerDescription?: string;
  internalNotes?: string;
  basePrice: number;
  minPrice?: number;
  maxPrice?: number;
  unit?: string;
  taxable?: boolean;
  active?: boolean;
  // FEATURE 4 — reorderable checklist items linked to this service, combined
  // automatically (via buildChecklistFromServices) when a job/estimate has
  // multiple services selected.
  checklistTemplate?: ServiceChecklistItem[];
  // FEATURE — per-service default deposit requirement (e.g. always require
  // a 25% deposit on large jobs, but never on a quick service call).
  // EstimateBuilder.tsx's addSvc() applies this to the estimate's deposit
  // fields the first time a service carrying one is added, same shape as
  // Estimate.depositRequired/depositType/depositMandatory so it flows
  // through computeDepositAmount unchanged.
  depositRequired?: number;
  depositType?: "amount" | "percent";
  depositMandatory?: boolean;
}

// ─── Campaign ─────────────────────────────────────────────────────────────────

export interface Campaign {
  id: string;
  name: string;
  ch: "sms" | "email";
  subject?: string;
  body: string;
  status: "draft" | "scheduled" | "sending" | "sent";
  createdAt?: string;
  sendAt?: string;
  sentAt?: string;
  recipientCount?: number;
  matches?: string[];
  conversions?: number;
  segment?: SegmentFilter;
  sentCount?: number;
  failedCount?: number;
  failureSamples?: string[];
  // AUDIT (mobile round 10) — replaces the old Math.random()-fabricated
  // openRate/clickRate; this app has no open-pixel/click-tracking
  // infrastructure, so the only honest metric is real send success rate.
  deliveryRate?: number;
}

export interface SegmentFilter {
  tags?: string[];
  city?: string;
  lastServiceBefore?: number;
  lastServiceAfter?: number;
  serviceType?: string;
  minSpent?: number;
  maxSpent?: number;
}

// ─── Automation ───────────────────────────────────────────────────────────────

export interface AutomationStep {
  id: string;
  type: string;
  label: string;
  icon?: string;
  channel?: string;
  template?: string;
  delay?: number;
  condition?: string;
  value?: string | number;
}

// FEATURE — one saved version of a legal document (Settings → Legal). An
// owner can keep several (e.g. "2024 Terms", "2025 Terms — updated late
// fee") and pick which is currently live, per category and — for Terms of
// Service — per job type (residential vs commercial).
export interface LegalTemplate {
  id: string;
  category: "privacy" | "terms";
  name: string;
  appliesTo: "residential" | "commercial" | "both";
  body: string;
  updatedAt: string;
}

export interface Automation {
  id: string;
  name: string;
  trigger: string;
  action: string;
  active: boolean;
  lastTriggered?: string | null;
  count?: number;
  steps: AutomationStep[];
  description?: string;
  // FIX 1 (mobile round 6) — per-recipient send tracking (recipient key,
  // e.g. "job-reminder:<jobId>" or "bday:<customerId>:<year>" -> ISO date
  // last sent), so the engine can dedupe/cooldown per recipient instead of
  // gating the whole automation on a single lastTriggered date (which used
  // to mean only the FIRST matching recipient each day ever got messaged).
  sentLog?: Record<string, string>;
  // FEATURE — "allow owners to disable these pop-ups per automation." When
  // true, this automation's candidates skip AutomationBatchModal entirely
  // and send straight through — the automation itself still runs, only the
  // per-batch confirmation popup is off. Default false/undefined keeps the
  // existing require-approval behavior.
  autoApprove?: boolean;
}

// ─── Training ─────────────────────────────────────────────────────────────────
// FEATURE — "a training process for employees, allowing owners to attach
// training rules, equipment instructions, chemical warnings, training
// videos and photos with descriptions, and training tests with
// multiple-choice questions that are graded."

export interface TrainingQuizQuestion {
  id: string;
  question: string;
  options: string[];
  correctIndex: number;
}

export interface TrainingMedia {
  id: string;
  url: string;
  type: "image" | "video";
  caption?: string;
}

export interface TrainingModule {
  id: string;
  title: string;
  category: "rule" | "equipment" | "chemical" | "general";
  body: string; // the rules/instructions/warnings text
  media: TrainingMedia[];
  quiz: TrainingQuizQuestion[];
  passingScore: number; // percent, e.g. 80
  required: boolean;
  createdAt: string;
}

export interface TrainingCompletion {
  id: string;
  moduleId: string;
  employeeId: string;
  employeeName?: string;
  score: number;
  passed: boolean;
  answers?: Record<string, number>;
  completedAt: string;
}

// ─── Review ───────────────────────────────────────────────────────────────────

export interface Review {
  id: string;
  customerId: string;
  customerName?: string;
  rating: number;
  text?: string;
  response?: string;
  createdAt: string;
  source?: string;
  status?: "pending" | "responded" | "private";
}

// ─── Inbox ────────────────────────────────────────────────────────────────────

export interface InboxMessage {
  id: string;
  role: "customer" | "owner";
  body: string;
  ts: string;
  status?: "sent" | "delivered" | "read" | "failed";
  channel?: "sms" | "whatsapp" | "email";
}

export interface InboxThread {
  id: string;
  customerId?: string;
  customerName?: string;
  phone?: string;
  channel: "sms" | "whatsapp" | "email";
  messages: InboxMessage[];
  lastMessageAt: string;
  unread?: boolean;
  smsOptOut?: boolean;
}

// FEATURE — Notification Center (audit round). One persisted record per
// owner-facing event (crew activity, invoice activity, reported issues,
// etc.) — see setNotifications in App.tsx for where these get created.
export interface AppNotification {
  id: string;
  text: string;
  at: number;
  read?: boolean;
  category?: "invoice" | "crew" | "issue" | "system";
  page?: string;
  detail?: string;
  // BUG FIX (user report) — "notification says click to view it but that
  // doesn't work." Bell click only ever did setPage(n.page) — landed on
  // the right PAGE but never opened/highlighted the specific record the
  // notification was actually about. openType/openId feed the same
  // alfredHighlight spotlight mechanism email "View" links already use.
  openType?: string;
  openId?: string;
}

// ─── Social ───────────────────────────────────────────────────────────────────

export interface SocialPost {
  id: string;
  platform: "instagram" | "facebook" | "tiktok" | "linkedin" | "google" | "nextdoor";
  type: string;
  caption: string;
  scheduledFor?: string;
  scheduledTime?: string;
  publishedAt?: string;
  hashtags?: string;
  status: "scheduled" | "published" | "draft";
  likes?: number;
  shares?: number;
  comments?: number;
  reach?: number;
  autoGenerated?: boolean;
  _imageData?: { data: string; mediaType: string };
  // Real Buffer-backed analytics — only present for posts actually sent
  // through Buffer. bufferPostId lets us re-query Post.metrics/externalLink
  // later; externalLink is the live permalink Buffer/the network reported.
  bufferPostId?: string;
  externalLink?: string;
  metricsUpdatedAt?: string;
  postMethod?: string;
  mediaUrl?: string;
  mediaType?: "image" | "video";
  // Cover/thumbnail frame for a video post, chosen (or auto-generated) during
  // the Calendar page's drag-a-finished-video-to-schedule flow.
  coverPhotoUrl?: string;
  // Set once the full-size mediaUrl in Storage has been deleted and
  // replaced with a small generated thumbnail (see cleanupPublishedMedia
  // in SocialPage.tsx) — the UI renders a click-through preview instead of
  // an inline player when this is true, since there's nothing left to play.
  mediaIsPreview?: boolean;
}

// ─── Accountability ───────────────────────────────────────────────────────────

export interface AccountabilityEntry {
  id: string;
  date: string;
  sleep: number;
  water: number;
  steps: number;
  gymMinutes: number;
  meditationMinutes?: number;
  mood: number;
  notes?: string;
  gym?: boolean;
  lunchTaken?: boolean;
  stretchDone?: boolean;
}

export interface Goal {
  id: string;
  category: string;
  label: string;
  target: number;
  current: number;
  unit: string;
  deadline?: string;
  // Runtime shape actually used by AccountabilityPage's checklist-style
  // goals (goals prop there is untyped any[] — these mirror what's really
  // stored so the Goal interface reflects reality, not just seedGoals'
  // target/current shape).
  text?: string;
  done?: boolean;
  createdAt?: string;
  completedAt?: string | null;
  // Owner-requested: "specify a goal by a certain time, and if the goal is
  // met, increase a certain amount" — a reward tied to hitting the goal by
  // its deadline. Mirrors RewardTier's free-text `reward` convention rather
  // than inventing a new shape. metByDeadline is set once, the moment the
  // goal is marked done, from whether that happened on/before `deadline`.
  rewardAmount?: number;
  rewardDescription?: string;
  metByDeadline?: boolean;
  // FEATURE — Growth goals: business-metric goals (revenue/jobs/clients/
  // recurring clients/leads) whose `current` is auto-computed from real
  // jobs/customers data instead of typed in by hand ("custom" keeps the old
  // manual-current behavior). remindedAt/celebratedAt dedupe the Alfred
  // near-goal reminder and the goal-hit email/toast so App.tsx's tracking
  // effect only fires each one once per goal, not on every re-render.
  metric?: "revenue" | "jobs" | "clients" | "recurringClients" | "leads" | "custom";
  remindedAt?: string | null;
  celebratedAt?: string | null;
}

export interface Win {
  id: string;
  text: string;
  date: string;
  category?: string;
}

export interface Reminder {
  id: string;
  text: string;
  frequency: "daily" | "weekly" | "monthly";
  emoji?: string;
  lastDone?: string | null;
}

// ─── Alfred ───────────────────────────────────────────────────────────────────

export interface AlfredMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  ts: string;
  thinking?: boolean;
}

export interface AlfredConversation {
  id: string;
  title: string;
  messages: AlfredMessage[];
  createdAt: string;
  updatedAt: string;
}

export interface AlfredMemory {
  id: string;
  category: string;
  content: string;
  createdAt: string;
}

// ─── Settings ─────────────────────────────────────────────────────────────────

export interface AppSettings {
  // Company
  companyName?: string;
  companyPhone?: string;
  companyEmail?: string;
  companyAddress?: string;
  logoUrl?: string;
  brandColor?: string;
  brandAccent?: string;

  // Owner
  ownerName?: string;
  ownerRole?: string;
  myPhone?: string;
  myEmail?: string;
  alfredSmsEnabled?: boolean;
  // Opt-in — texts the daily morning briefing to myPhone (off by default).
  alfredSmsCheckinEnabled?: boolean;
  // Additional numbers (besides myPhone) allowed to text Alfred — e.g. a
  // second phone the owner is using to simultaneously test the CUSTOMER
  // side of texting without losing access to the Alfred conversation on
  // their main number.
  alfredExtraPhones?: string[];
  clientPortalCancelReschedule?: boolean;
  clientPortalCanCancel?: boolean;
  clientPortalCanReschedule?: boolean;
  weeklyDigestAutoSend?: boolean;

  // Crew policy
  maxLunchMinutes?: number;
  homeBaseAddress?: string;
  paidLunchBreaks?: boolean;
  hideJobAmountsFromEmployees?: boolean;
  autoMileageTrackingEnabled?: boolean;

  // Onboarding — explicitly false only for brand-new owner registrations;
  // undefined (pre-existing accounts) is treated as already complete.
  onboardingComplete?: boolean;
  onboardingYearsInBusiness?: number;
  onboardingServicesOffered?: string[];
  onboardingTeamSize?: number;

  // API keys
  twilioSid?: string;
  twilioToken?: string;
  twilioPhone?: string;
  twilioBackendUrl?: string;
  geminiKey?: string;
  openaiKey?: string;
  anthropicKey?: string;
  groqKey?: string;
  mistralKey?: string;
  minimaxKey?: string;
  elevenlabsKey?: string;
  elevenlabsVoiceId?: string;
  owmKey?: string;
  mapsKey?: string;
  stripeKey?: string;
  stripeConnected?: boolean;
  stripePublishableKey?: string;
  // Full Stripe Connect account id (acct_...) — safe to expose client-side
  // (not secret), required so Stripe.js on the payment page knows which
  // connected account it's confirming a payment against. Empty for a
  // legacy manual-key owner (no Connect account).
  stripeConnectAccountId?: string;
  // Secret key is obfuscated (see lib/crypto.ts) before being persisted — not real
  // encryption, but keeps it from sitting in localStorage as plain text.
  stripeSecretKeyEnc?: string;

  // Google
  googleConnected?: boolean;
  googleToken?: string;
  googleEmail?: string;
  googleCalendarId?: string;
  googleBackendUrl?: string;
  googlePlaceId?: string;
  googleReviewLink?: string;
  reviewGoogleMinStars?: number;
  workOrderEmailTemplate?: { subject?: string; instructions?: string; maxWords?: number; includeSignature?: boolean };
  // ITEM 10 — the owner's OAuth provider token/refresh token, distinct from
  // googleToken above (legacy/mock field). googleTokenExpiresAt lets Gmail
  // sends proactively refresh before the access token actually expires
  // instead of only reacting to a 401.
  googleProviderToken?: string;
  googleRefreshToken?: string;
  googleTokenExpiresAt?: number;

  // Integrations
  whatsappFrom?: string;

  // Notifications
  notifyReviews?: boolean;
  notifyOverdue?: boolean;
  notifyLowStock?: boolean;
  notifyMaintenance?: boolean;
  notifyWeather?: boolean;
  autoPostCompletedJobs?: boolean;
  instaBridge?: boolean;
  reviewShowcaseMinRating?: number;

  // Business rules
  monthlyRevenueGoal?: number;
  monthlyJobsGoal?: number;
  taxRate?: number;
  defaultDepositPct?: number;
  termsAndConditions?: string;
  termsAndConditionsResidential?: string;
  termsAndConditionsCommercial?: string;
  terms?: string;
  privacyPolicy?: string;
  termsOfService?: string;
  // FEATURE — Legal template library (Settings → Legal): lets an owner keep
  // multiple named, editable versions of Privacy Policy / Terms of Service
  // and pick which one is "live," instead of one hardcoded field each.
  legalTemplates?: LegalTemplate[];
  activePrivacyTemplateId?: string;
  activeTermsResidentialTemplateId?: string;
  activeTermsCommercialTemplateId?: string;
  estimateValidDays?: number;

  // ITEM 2 — default travel/buffer time (minutes) inserted between
  // back-to-back scheduled jobs. Distinct from bufferTime below, which is
  // an unrelated field for the Buffer.com social-post scheduling integration.
  defaultBufferMinutes?: number;

  // Integrations misc
  bufferTime?: number;
  bufferApiKey?: string;
  // Optional — unlocks "Auto-Edit with AI" in the Social video editor
  // (Shotstack); the free ffmpeg.wasm editor works fully without this.
  videoAutoEditApiKey?: string;
  // Optional — Deepgram key for the video editor's auto-captions, an
  // alternative to reusing the OpenAI/Groq keys already set in AI Models.
  deepgramApiKey?: string;
  bufferOrganizationId?: string;
  bufferChannelIds?: Record<string, string>;
  googleCalendarColor?: boolean;

  // Direct platform OAuth (fallback to Buffer)
  socialBackendUrl?: string;
  metaClientId?: string;
  metaAccessToken?: string;
  metaPageId?: string;
  linkedinClientId?: string;
  linkedinAccessToken?: string;
  linkedinAuthorUrn?: string;
  tiktokClientId?: string;
  tiktokAccessToken?: string;

  // Models
  selectedModel?: string;
  ttsEnabled?: boolean;

  // Extended/misc
  googleMapsKey?: string;
  // Google flatly refuses to let Geocoding API / Distance Matrix API be
  // called with a referrer-restricted key ("API keys with referer
  // restrictions cannot be used with this API") — googleMapsKey above
  // needs that restriction for browser safety (Maps JS/Places/Street
  // View), so geocoding/drive-time features need a genuinely separate,
  // unrestricted-but-API-scoped key. Falls back to googleMapsKey when
  // unset (only actually works then if that key has no referrer lock).
  googleGeocodingKey?: string;
  // FEATURE — customer folder management. Customer.folder (a plain string,
  // "Parent/Child" for nesting) stays the source of truth for WHICH folder a
  // customer is in; this is the separate master list of folder NAMES that
  // exist even with zero customers in them yet (e.g. right after creating an
  // empty folder) — without this, an empty folder has nothing referencing it
  // and would vanish from every folder list immediately. See CustomersPage.tsx.
  customerFolders?: string[];
  googleScopes?: Record<string, boolean>;
  activeModel?: string;
  modelPriority?: string[];
  modelKeys?: Record<string, string>;
  failoverEnabled?: boolean;
  openAiKey?: string;
  twilioFrom?: string;
  // FEATURE — A2P 10DLC campaign compliance ("ATP checking"). See
  // lib/messaging.ts's checkA2pCampaignStatus.
  twilioMessagingServiceSid?: string;
  twilioA2pCampaignStatus?: string;
  twilioA2pCampaignCheckedAt?: number;
  // FEATURE — reference copy of the URL pasted into Twilio Console's
  // "incoming webhook" field for this Messaging Service/number. Purely
  // informational to the app itself (Twilio calls this URL directly — the
  // app has no way to read Twilio's console config back), but persisting it
  // here means Settings always shows what was actually configured instead of
  // a guessed/computed value that can drift from reality (e.g. across
  // Cloudflare Pages preview vs. production domains).
  twilioIncomingWebhookUrl?: string;
  // FEATURE — Twilio A2P "via text" opt-in keyword (e.g. "DEALS"). Default
  // is applied server-side in the webhook if unset — see
  // functions/api/twilio-sms-webhook.ts.
  smsOptInKeyword?: string;

  // Dashboard / business goals
  dashboardWidgets?: string[];
  quarterlyRevenueGoal?: number;
  annualRevenueGoal?: number;
  weeklyJobsGoal?: number;
  customerAcquisitionGoal?: number;
  avgJobValueGoal?: number;
  reviewRatingGoal?: number;

  // Misc settings used across pages
  instagramHandle?: string;
  facebookHandle?: string;
  tiktokHandle?: string;
  reviewLink?: string;
  portalUrl?: string;
  minimaxGroupId?: string;
  googleCalendarSyncEnabled?: boolean;
  googleContacts?: boolean;

  // Automations — late-employee auto-notify
  autoNotifyLate?: boolean;
  lateThresholdMinutes?: number;
  lateNotifyTemplate?: string;

  // Automations kill switch — `undefined`/anything but `false` means paused.
  // Defaults every existing owner to paused after the automation-spam
  // incident; see AutomationsPage.tsx's banner and useAutomationEngine.ts.
  automationsPaused?: boolean;
  // FEATURE (round 13, item 12) — master switch for Testing Mode (see
  // Customer.isTestClient and lib/messaging.ts's setTestModeContacts).
  testModeEnabled?: boolean;
  // FEATURE (round 13, item 24) — route builder lunch break, applies to any
  // day's job route, not just one job type.
  routeLunchMinutes?: number;
  routeLunchEarliestTime?: string;
  // Batch-approval guardrail — customerId -> last date (YYYY-MM-DD) any
  // automation actually emailed/texted them, across ALL automations. Caps
  // every customer to at most one automation touch per day regardless of
  // how many different automations would otherwise want to reach them.
  automationDailySendLog?: Record<string, string>;
  // FEATURE — explicit total-sends-per-day cap across all automations
  // combined (distinct from automationDailySendLog's per-customer cap above).
  // Defaults to 50 when unset. See useAutomationEngine.ts's gather loop.
  automationMaxSendsPerDay?: number;
  // FEATURE — default autoApprove value applied to newly-created workflows;
  // existing workflows keep whatever their own card's Auto-send/Ask first
  // toggle is set to. See AutomationsPage.tsx's "Default Send Behavior".
  automationDefaultAutoApprove?: boolean;
  // FEATURE — throttles (not just caps) the actual send rate of an approved
  // batch. 0/unset = no limit. See computeThrottleDelayMs in
  // useAutomationEngine.ts.
  automationMaxSendsPerHour?: number;
  automationMaxSendsPerMinute?: number;
  // FEATURE — photo/video auto-deletion, owner opt-in (default disabled —
  // 0/undefined means off). When set to a positive number of days, completed
  // jobs older than that lose their photos/videos (Storage objects + JSONB
  // references) on the next sweep. See lib/utils.ts's purgeOldJobMedia.
  mediaRetentionDays?: number;
  // EGRESS — shared poll interval (ms) for the cross-device fallback polls
  // that re-fetch jobs/customers/estimates, employees, app_settings, and
  // Alfred conversations/memory. Realtime subscriptions handle instant sync
  // for all of these; this interval only controls how often the redundant
  // fallback poll re-checks for anything realtime missed. Defaults to 120s
  // (was a hardcoded, inconsistent mix of 3s/5s/60s across different polls —
  // see App.tsx/AlfredPage.tsx/CrewView.tsx/EmployeePortal.tsx). Exposed in
  // Settings so an owner who hits their Supabase egress cap can widen it
  // further (e.g. 300s) without a code change.
  pollIntervalMs?: number;
  // Custom equipment/chemical names an owner has added on a specific job
  // (JobDetailModal's "Add custom equipment/chemical" inputs) that aren't on
  // the hardcoded equipmentList/requiredChemicalsList (lib/utils.ts). Without
  // this, a custom entry only ever lived on the one job it was typed into —
  // every future job started from scratch with no memory of it.
  customEquipmentList?: string[];
  customChemicalsList?: string[];

  // FEATURE — new-hire onboarding packet TEMPLATE, owner-editable (see
  // EmployeesPage "Onboarding" tab / SettingsModal). Same pattern as
  // estimateTemplates/emailTemplates: a reusable list the owner defines once.
  // Assigning a new employee an onboarding packet copies this list into a
  // real employee_onboarding row (see EmployeeOnboarding below) rather than
  // referencing it live, so a later template edit never retroactively
  // changes an already-assigned employee's checklist.
  onboardingTemplateItems?: OnboardingTemplateItem[];

  [key: string]: any;
}

// ─── Employee onboarding packets ───────────────────────────────────────────────
// See supabase/migrations/0039_employee_onboarding.sql. The reusable template
// lives on AppSettings.onboardingTemplateItems (synced via app_settings.data,
// same as every other owner-editable template in this app); each assigned
// employee gets their own `employee_onboarding` row/copy so their completion
// state is independent of later template edits.

export interface OnboardingTemplateItem {
  id: string;
  title: string;
  description?: string;
}

export interface OnboardingItem extends OnboardingTemplateItem {
  done: boolean;
  completedAt?: string | null;
}

export interface EmployeeOnboarding {
  id: string;
  owner_id?: string;
  employee_id: string;
  items: OnboardingItem[];
  created_at?: string;
  updated_at?: string;
}

// ─── Referral ─────────────────────────────────────────────────────────────────

export interface Referral {
  id: string;
  referrerId: string;
  referredName: string;
  referredPhone?: string;
  status: "pending" | "booked" | "completed";
  reward?: number;
  createdAt: string;
}

export interface RewardTier {
  id: string;
  label: string;
  minReferrals: number;
  reward: string;
  icon: string;
  refs?: number;
}

// ─── Promotions ───────────────────────────────────────────────────────────────

export interface Promotion {
  id: string;
  name: string;
  description?: string;
  discountType: "percent" | "fixed";
  discountValue: number;
  validFrom: string;
  validTo: string;
  serviceRestrictions?: string[];
  usageLimit?: number;
  code?: string;
  audience: "all" | "tag" | "folder" | "location" | "lastService" | "individual";
  audienceTag?: string;
  audienceFolder?: string;
  audienceCity?: string;
  audienceLastServiceBefore?: number;
  audienceCustomerIds?: string[];
  channel?: "email" | "sms" | "both";
  status: "draft" | "scheduled" | "sent" | "active" | "ended";
  sentAt?: string;
  sentCount?: number;
  openedCount?: number;
  redeemedCount?: number;
  createdAt: string;
}

// ─── Mileage ─────────────────────────────────────────────────────────────────

export interface MileageLog {
  id: string;
  date: string;
  from: string;
  to: string;
  miles: number;
  purpose: string;
  vehicleId?: string;
  deduction?: number;
}

// FEATURE — employee-submitted mileage, synced via the `mileage_logs` table
// (migration 0023) so the owner can see/approve it from any device. Distinct
// from MileageLog above, which is the owner's own local/manual entry on
// ExpensesPage.tsx (device-local, no employee/approval concept).
export interface EmployeeMileageLog {
  id: string;
  employeeId: string;
  date: string;
  from: string;
  to: string;
  miles: number;
  purpose: string;
  status: "pending" | "approved" | "denied";
  createdAt?: string;
}

// ─── Budget ───────────────────────────────────────────────────────────────────

export interface PersonalTransaction {
  id: string;
  date: string;
  description: string;
  amount: number;
  type: "income" | "expense";
  category?: string;
}

// ─── Timeline ────────────────────────────────────────────────────────────────

export interface TimelineEntry {
  id: string;
  type: "estimate" | "job" | "note" | "call" | "email" | "sms" | "review";
  note: string;
  date: string;
  amount?: number;
  link?: string;
}

export type Timeline = Record<string, TimelineEntry[]>;

// ─── Google Workspace data ────────────────────────────────────────────────────

export interface GoogleWorkspaceData {
  files: import("../lib/google").GoogleDriveFile[];
  emails: Array<{ id: string; from: string; subject: string; snippet: string; date: string }>;
}

// ─── Model status ─────────────────────────────────────────────────────────────

export type ModelStatus = Record<string, "connected" | "error" | "testing" | undefined>;
