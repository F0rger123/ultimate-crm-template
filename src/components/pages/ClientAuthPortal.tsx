import React, { useEffect, useRef, useState } from "react";
import { Lock, Mail, User, Phone, LogOut, CreditCard, Receipt, CheckCircle, Clock, Gift, Copy, Repeat, ImageIcon, ChevronRight, FileText, Briefcase, CalendarClock, Eye, EyeOff, Search, Plus, Building2, Tag } from "lucide-react";
import { supabase } from "../../lib/supabase";
import { fmt, uid, today, mediaSrc } from "../../lib/utils";
import type { Customer, Estimate, Job, AppSettings } from "../../types";
import { Glass } from "../ui/Glass";
import { BrandMark } from "../ui/BrandMark";
import { AuthHeader, AuthRoleTabs } from "../ui/AuthRoleTabs";
import { GBtn } from "../ui/GBtn";
import { GInput } from "../ui/GInput";
import { Badge } from "../ui/Badge";
import { Stat } from "../ui/Stat";
import { Modal } from "../ui/Modal";
import { StripePaymentModal } from "../ui/StripePaymentModal";
import { SquarePaymentModal } from "../ui/SquarePaymentModal";
import { SaveCardModal } from "../ui/SaveCardModal";
import { getPublicSquareConfig, confirmSquareInvoicePayment } from "../../lib/square";
import { getMySavedCard, getMySavedCards, detachMyPaymentMethod, sendPaymentReceipt, confirmInvoicePayment, type StripeSavedCard } from "../../lib/stripe";
import { seedRewardTiers } from "../../lib/seed";
import { resolvePaymentProvider } from "../../lib/payments";

// Public, unauthenticated-by-default route (#/client) — a customer-facing
// portal with its own Supabase email/password auth, intentionally separate
// from the owner/employee auth handled in App.tsx (see the route guards
// added there). Customers are matched to their CRM record by email since
// there's no backend to mint a dedicated client_id at signup time.
export function ClientAuthPortal({
  customers = [], setCustomers = (() => {}) as any,
  estimates = [], setEstimates = (() => {}) as any,
  jobs = [], settings = {} as AppSettings, estimateTemplates = [], toast = (() => {}) as any,
  demoMode = false, onExitDemo = () => {},
}: {
  customers?: Customer[]; setCustomers?: any;
  estimates?: Estimate[]; setEstimates?: any;
  jobs?: Job[]; settings?: AppSettings; estimateTemplates?: any[]; toast?: any;
  // FEATURE — App.tsx's "Test the Full Client Portal" demo renders this
  // component INLINE inside the owner's own already-authenticated tab, which
  // shares the same Supabase client singleton as the owner's real session.
  // Without demoMode, this component's own real session check (below) finds
  // the OWNER'S session, and BUG 10's staff-bounce effect immediately
  // hash-redirects back to the dashboard — which is exactly why the demo
  // button looked like it "did nothing." demoMode skips the real auth/
  // session machinery entirely and renders the logged-in portal UI directly
  // from real jobs/estimates/customers already in memory, and reroutes Sign
  // Out to just closing the demo instead of actually signing the owner out.
  demoMode?: boolean; onExitDemo?: () => void;
}) {
  const [session, setSession] = useState<any>(null);
  const [checked, setChecked] = useState(false);
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [authError, setAuthError] = useState("");
  const [authBusy, setAuthBusy] = useState(false);
  const [forgotBusy, setForgotBusy] = useState(false);
  const [forgotSent, setForgotSent] = useState(false);
  const [tab, setTab] = useState<"invoices" | "quotes" | "jobs" | "coupons" | "referrals" | "payment">("invoices");
  // Invite link (#/client?invite=TOKEN) — the business created this login
  // for the customer; their details come pre-filled and they only pick a
  // password. See create_portal_invites / portal_signup_with_invite in
  // functions/api/public-data.ts.
  const inviteToken = (() => { try { const h = window.location.hash; const q = h.indexOf("?"); return q >= 0 ? new URLSearchParams(h.slice(q + 1)).get("invite") || "" : ""; } catch { return ""; } })();
  const [invite, setInvite] = useState<null | { firstName: string; lastName: string; email: string; phone: string; claimed: boolean; companyName: string; logoUrl: string; error?: string }>(null);
  const [authInfo, setAuthInfo] = useState("");
  // FEATURE — multi-property switcher (see propertyOptions below); declared
  // up here (not near its usage further down) since this component has
  // early returns before that point and hooks can't be called conditionally.
  const [selectedPropertyId, setSelectedPropertyId] = useState("");
  const [rescheduleJobId, setRescheduleJobId] = useState<string | null>(null);
  const [rescheduleNote, setRescheduleNote] = useState("");
  const [reschedulingSend, setReschedulingSend] = useState(false);
  // FEATURE — self-serve cancel/reschedule, gated by settings.clientPortalCancelReschedule
  // (owner opt-in, off by default — see SettingsModal.tsx). Both require a
  // reason; the real permission check happens server-side in
  // public-data.ts's client_cancel_job/client_reschedule_job actions, this
  // client-side gate is only to decide which UI to show.
  const [directActionJobId, setDirectActionJobId] = useState<string | null>(null);
  const [directActionType, setDirectActionType] = useState<"cancel" | "reschedule" | null>(null);
  const [directReason, setDirectReason] = useState("");
  const [directNewDate, setDirectNewDate] = useState("");
  const [directNewTime, setDirectNewTime] = useState("");
  const [directSending, setDirectSending] = useState(false);

  const submitDirectAction = async () => {
    if (!directActionJobId || !directActionType) return;
    if (!directReason.trim()) { toast?.("Please enter a reason", "red"); return; }
    if (directActionType === "reschedule" && !directNewDate) { toast?.("Please pick a new date", "red"); return; }
    setDirectSending(true);
    try {
      const { data: sessData } = await supabase.auth.getSession();
      const token = sessData.session?.access_token;
      const res = await fetch("/api/public-data", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          action: directActionType === "cancel" ? "client_cancel_job" : "client_reschedule_job",
          jobId: directActionJobId, reason: directReason.trim(), newDate: directNewDate, newTime: directNewTime,
        }),
      });
      const data = await res.json().catch(() => ({} as any));
      if (!res.ok || data?.error) throw new Error(data?.error || `Request failed (${res.status})`);
      patchActiveJobs(jobs => jobs.map(x => x.id === directActionJobId ? { ...x, status: data.status, scheduledDate: data.scheduledDate } as any : x));
      toast?.(directActionType === "cancel" ? "Job cancelled ✓" : "Job rescheduled ✓", "green");
      setDirectActionJobId(null); setDirectActionType(null); setDirectReason(""); setDirectNewDate(""); setDirectNewTime("");
    } catch (e: any) {
      toast?.(e?.message || "Couldn't complete that — please call or text us directly", "red");
    } finally {
      setDirectSending(false);
    }
  };
  const [payingInv, setPayingInv] = useState<Estimate | null>(null);
  // AUDIT FIX — "Square unreachable from the full customer login portal."
  // This page only ever wired up StripePaymentModal — a customer of an
  // owner who only configured Square (no Stripe) had no way to pay an
  // invoice from here at all. ClientPortal.tsx (the single-invoice-link
  // entry point) already resolves both processors this same way; mirrored
  // here so both customer-facing entry points behave the same.
  const [squareConfig, setSquareConfig] = useState<{ connected: boolean; applicationId?: string; locationId?: string } | null>(null);
  // FEATURE — legal disclaimer/T&Cs gate before the Stripe modal opens (this
  // portal jumps straight from "Pay Now" to the card form with no review
  // step, unlike ClientPortal.tsx's estimate-payment flow, so the checkbox
  // lives here as its own intermediate step instead).
  const [payDisclaimerInv, setPayDisclaimerInv] = useState<Estimate | null>(null);
  const [agreedInvoiceTerms, setAgreedInvoiceTerms] = useState(false);
  const [showSaveCard, setShowSaveCard] = useState(false);
  const [mySavedCard, setMySavedCard] = useState<{ brand?: string; last4?: string; expMonth?: number; expYear?: number } | null>(null);
  // FEATURE — multi-card support: every card the customer has saved, not
  // just the default one. Loaded from Stripe directly (source of truth for
  // brand/last4) whenever the default changes or after a save/remove.
  const [myCards, setMyCards] = useState<StripeSavedCard[]>([]);
  const [cardsBusyId, setCardsBusyId] = useState<string | null>(null);
  const refreshMyCards = () => {
    if (!session?.access_token) { setMyCards([]); return; }
    getMySavedCards(session.access_token).then(setMyCards).catch(() => setMyCards([]));
  };

  // MULTI-TENANT (Phase D) — was `customers.find(...)` against the App.tsx
  // global `customers`/`estimates`/`jobs` props (owner_id-scoped once RLS
  // 0033_multitenant_owner_scoping.sql is live, so empty for a customer
  // session — current_owner_id() only resolves for staff). Fetched instead
  // via /api/public-data's "get_customer_portal_data" action (service role,
  // resolves the caller's own customer record + their jobs/estimates
  // server-side from their VERIFIED session email, sent as a bearer token —
  // never a client-claimed id). Stored in local state; `customers`/
  // `estimates`/`jobs` props are still accepted (harmless, and referral-list
  // lookups below still use the `customers` prop) but no longer the source
  // of truth for the logged-in customer's own record/invoices/jobs.
  // BUG FIX — `settings` was carrying the resolved owning business's public
  // Stripe/branding info (never the global App.tsx `settings` prop, which
  // is empty on a real customer's own device — see the server-side comment
  // on get_customer_portal_data in public-data.ts).
  // MULTI-BUSINESS — a customer can be linked to more than one business
  // through the same login (e.g. one company services their house, a
  // different one mows their lawn). `accounts` is one entry per business
  // they're a customer of; `activeIdx` picks which one this screen shows.
  type PortalCoupon = { id: string; name: string; description?: string; code: string; discountType: string; discountValue: number; validFrom?: string | null; validTo?: string | null; justForYou?: boolean };
  type PortalAccount = { customer: Customer; jobs: Job[]; estimates: Estimate[]; settings: { stripePublishableKey?: string; stripeAccountId?: string; companyName?: string } | null; coupons?: PortalCoupon[] };
  const [portalData, setPortalData] = useState<{ accounts: PortalAccount[] } | null>(null);
  const [portalDataLoading, setPortalDataLoading] = useState(false);
  const [activeIdx, setActiveIdx] = useState(0);

  const fetchPortalData = async () => {
    setPortalDataLoading(true);
    try {
      const { data: sessData } = await supabase.auth.getSession();
      const token = sessData.session?.access_token;
      if (!token) { setPortalData({ accounts: [] }); return; }
      const res = await fetch("/api/public-data", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ action: "get_customer_portal_data" }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || data?.error) { setPortalData({ accounts: [] }); return; }
      setPortalData({ accounts: data.accounts || [] });
      setActiveIdx(prev => Math.min(prev, Math.max(0, (data.accounts?.length || 1) - 1)));
    } catch {
      setPortalData({ accounts: [] });
    } finally {
      setPortalDataLoading(false);
    }
  };

  // ── "Find & Connect" — search businesses on the platform and request to
  // become their customer (lands as a pending "lead" in that owner's Lead
  // Intake list; see request_customer_link in public-data.ts).
  const [findQuery, setFindQuery] = useState("");
  const [findResults, setFindResults] = useState<Array<{ ownerId: string; companyName: string; companyPhone?: string; logoUrl?: string }>>([]);
  const [findBusy, setFindBusy] = useState(false);
  const [findOpen, setFindOpen] = useState(false);
  const [connectingOwnerId, setConnectingOwnerId] = useState<string | null>(null);
  const [connectedOwnerIds, setConnectedOwnerIds] = useState<string[]>([]);
  // Each keystroke searches; only the latest search may update the list,
  // and a search can never spin forever (15s limit with a message).
  const searchSeq = useRef(0);
  const [findError, setFindError] = useState("");
  const searchBusinesses = async (q: string) => {
    setFindQuery(q);
    setFindError("");
    const seq = ++searchSeq.current;
    if (q.trim().length < 2) { setFindResults([]); setFindBusy(false); return; }
    setFindBusy(true);
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 15000);
    try {
      const res = await fetch("/api/public-data", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "search_businesses", query: q.trim() }), signal: ctrl.signal });
      const data = await res.json().catch(() => null);
      if (seq !== searchSeq.current) return;
      if (!res.ok) throw new Error(data?.error || "Search failed");
      setFindResults(data?.businesses || []);
    } catch (e: any) {
      if (seq !== searchSeq.current) return;
      setFindResults([]);
      setFindError(e?.name === "AbortError" ? "Search took too long — check your connection and try again." : "Couldn't search right now — please try again.");
    } finally {
      clearTimeout(timer);
      if (seq === searchSeq.current) setFindBusy(false);
    }
  };
  const requestConnect = async (ownerId: string) => {
    setConnectingOwnerId(ownerId);
    try {
      const { data: sessData } = await supabase.auth.getSession();
      const token = sessData.session?.access_token;
      const res = await fetch("/api/public-data", {
        method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ action: "request_customer_link", ownerId, firstName, lastName, phone }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || data?.error) throw new Error(data?.error || "Request failed");
      setConnectedOwnerIds(prev => [...prev, ownerId]);
      toast?.(data?.alreadyConnected ? "You're already connected — opening your account" : "Request sent ✓ — they'll confirm you as a customer soon", "green");
      // Open the new account right away instead of leaving the customer on
      // the search screen with nothing to do.
      setFindOpen(false);
      fetchPortalData();
    } catch (e: any) {
      toast?.(e?.message || "Couldn't send that request", "red");
    } finally {
      setConnectingOwnerId(null);
    }
  };

  useEffect(() => {
    if (demoMode) { setChecked(true); return; }
    (async () => {
      const { data } = await supabase.auth.getSession();
      setSession(data.session || null);
      setChecked(true);
    })();
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, s) => setSession(s));
    return () => subscription.unsubscribe();
  }, [demoMode]);

  useEffect(() => {
    if (!inviteToken || demoMode) return;
    fetch("/api/public-data", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "get_portal_invite", token: inviteToken }) })
      .then(r => r.json().then(d => ({ ok: r.ok, d })))
      .then(({ ok, d }) => {
        if (!ok) { setInvite({ firstName: "", lastName: "", email: "", phone: "", claimed: false, companyName: "", logoUrl: "", error: d?.error || "This invite link isn't valid anymore." }); return; }
        setInvite(d);
        setFirstName(d.firstName || ""); setLastName(d.lastName || ""); setPhone(d.phone || ""); if (d.email) setEmail(d.email);
        setMode(d.claimed ? "login" : "signup");
      })
      .catch(() => {});
  }, [inviteToken, demoMode]); // eslint-disable-line react-hooks/exhaustive-deps
  // Already signed in and opened an invite → attach that customer record.
  const claimedRef = useRef(false);
  useEffect(() => {
    if (!inviteToken || demoMode || !session?.access_token || claimedRef.current) return;
    claimedRef.current = true;
    fetch("/api/public-data", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` }, body: JSON.stringify({ action: "claim_portal_invite", token: inviteToken }) })
      .then(r => r.json()).then(() => fetchPortalData()).catch(() => {});
  }, [inviteToken, session?.access_token, demoMode]); // eslint-disable-line react-hooks/exhaustive-deps

  // Fetch (or re-fetch, e.g. right after signup/login flips `session`) the
  // customer's own portal data whenever a session becomes available.
  useEffect(() => {
    if (demoMode) return;
    if (session?.user?.email) fetchPortalData();
    else setPortalData(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.user?.id, demoMode]);

  // demoMode builds its "logged in" account straight from the real
  // jobs/estimates/customers already loaded in the owner's CRM session,
  // instead of the real get_customer_portal_data fetch (which resolves the
  // caller's OWN customer record — the owner isn't a customer, so that call
  // would just come back empty). Picks whichever customer actually has data
  // to show, so the walkthrough isn't just an empty shell.
  const demoAccount: PortalAccount | null = (() => {
    if (!demoMode) return null;
    const withData = [...customers].sort((a: any, b: any) => (b.createdAt || "").localeCompare(a.createdAt || ""));
    const pick = withData.find(c => estimates.some(e => e.customerId === c.id) || jobs.some(j => j.customerId === c.id)) || withData[0];
    if (!pick) return null;
    return {
      customer: pick,
      jobs: jobs.filter(j => j.customerId === pick.id),
      estimates: estimates.filter(e => e.customerId === pick.id),
      settings: { stripePublishableKey: (settings as any)?.stripePublishableKey, stripeAccountId: (settings as any)?.stripeAccountId, companyName: (settings as any)?.companyName, paymentProviderPreference: (settings as any)?.paymentProviderPreference } as any,
    };
  })();

  const active = demoMode ? demoAccount : (portalData?.accounts?.[activeIdx] || null);
  const cust = active?.customer || null;

  // Mark outstanding invoices as viewed once per session so the owner gets a
  // "client opened invoice" notification. Guarded so it fires at most once per
  // invoice per portal load. Must stay above the early returns below: it used
  // to sit after them, so the first load after a customer tapped "Connect"
  // (no account → account) crashed with React #310.
  const viewedMarkedRef = useRef<Set<string>>(new Set());
  const unpaidInvoiceIds = cust ? (active?.estimates || []).filter(e => e.customerId === cust.id && e.invoiced && !e.paidAt && !(e as any).clientViewedAt).map(e => e.id) : [];
  useEffect(() => {
    if (demoMode) return;
    unpaidInvoiceIds.forEach(id => {
      if (viewedMarkedRef.current.has(id)) return;
      viewedMarkedRef.current.add(id);
      (supabase as any).from("estimates").update({ clientViewedAt: new Date().toISOString() }).eq("id", id).then(() => {}).catch(() => {});
    });
  }, [unpaidInvoiceIds.join(",")]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const ownerId = (cust as any)?.owner_id;
    if (!ownerId) { setSquareConfig(null); return; }
    getPublicSquareConfig(ownerId).then(setSquareConfig).catch(() => setSquareConfig(null));
  }, [(cust as any)?.owner_id]);

  // Real brand/last4 for the saved-card display below (closes the TODO left
  // where the display previously only had the generic literal "Card on
  // file" label to show) — see lib/stripe.ts's getMySavedCard.
  useEffect(() => {
    if (!cust?.savedPaymentMethodId || !session?.access_token) { setMySavedCard(null); return; }
    getMySavedCard(session.access_token).then(setMySavedCard).catch(() => setMySavedCard(null));
  }, [cust?.savedPaymentMethodId, session?.access_token]);

  useEffect(() => {
    refreshMyCards();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cust?.stripeCustomerId, session?.access_token]);

  // FIX 17 — "View & Pay Invoice" / "Review & Sign" links emailed/texted to
  // customers all point at #/client?invoice=ID (this portal), NOT the old
  // #/portal/ID pattern (which is the EMPLOYEE portal's route and had no idea
  // what to do with an estimate id — those links landed a customer on an
  // employee login screen). Once logged in and matched to a customer record,
  // auto-open that specific invoice's payment modal instead of making them
  // hunt for it in the list.
  const deepLinkHandledRef = useRef(false);
  useEffect(() => {
    if (!cust || deepLinkHandledRef.current) return;
    const hash = window.location.hash;
    const qIndex = hash.indexOf("?");
    if (qIndex === -1) return;
    const params = new URLSearchParams(hash.slice(qIndex + 1));
    const invoiceId = params.get("invoice");
    if (!invoiceId) return;
    const inv = (active?.estimates || []).find(e => e.id === invoiceId && e.customerId === cust.id);
    if (inv) { setTab("invoices"); setPayingInv(inv); deepLinkHandledRef.current = true; }
  }, [cust, active]); // eslint-disable-line react-hooks/exhaustive-deps

  // BUG 10 — if an OWNER/employee is logged in and lands on #/client, they'll
  // have a session but no matching customer record, which used to strand them
  // on "Setting up your account…". Detect a staff session (matches the owner's
  // configured email, or a row in the employees table) and bounce them to the
  // main app instead of showing the customer setup screen.
  useEffect(() => {
    if (demoMode || !checked || !session?.user?.email || cust) return;
    const email = session.user.email.toLowerCase();
    const ownerEmail = ((settings as any)?.myEmail || (settings as any)?.companyEmail || "").toLowerCase();
    if (ownerEmail && email === ownerEmail) {
      window.location.hash = "/dashboard";
      return;
    }
    (async () => {
      try {
        const { data } = await (supabase as any)
          .from("employees").select("id, role").ilike("email", email).maybeSingle();
        if (data) { window.location.hash = "/dashboard"; }
      } catch { /* employees table may not exist */ }
    })();
  }, [checked, session?.user?.email, cust]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleAuth = async () => {
    setAuthError("");
    if (!email.trim() || !password.trim()) { setAuthError("Email and password are required"); return; }
    setAuthBusy(true);
    try {
      if (mode === "signup" && inviteToken && invite && !invite.error) {
        // Invite: for the e-mail the business has on file, the server creates an
        // already-confirmed login tied to this customer record and we sign straight in.
        const res = await fetch("/api/public-data", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "portal_signup_with_invite", token: inviteToken, email: email.trim(), password, firstName, lastName, phone }) });
        const out = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(out?.error || "Couldn't create your login");
        if (out.existingAccount) { setMode("login"); setAuthInfo(out.message || "You already have a login — log in with your password."); return; }
        if (out.confirmEmail) {
          // No e-mail on file for this customer yet: normal sign-up, confirmed by e-mail.
          const { error } = await supabase.auth.signUp({ email: email.trim(), password, options: { data: { firstName, lastName, phone, role: "customer" } } });
          if (error) throw error;
          setMode("login"); setAuthInfo("Almost done — open the confirmation e-mail we just sent, then log in here.");
          return;
        }
        const { data, error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
        if (error) throw error;
        setSession(data.session || null);
        toast?.("Welcome! Your account is ready.", "green");
        return;
      }
      if (mode === "signup") {
        const { data, error } = await supabase.auth.signUp({ email: email.trim(), password, options: { data: { firstName, lastName, phone, role: "customer" } } });
        if (error) throw error;
        // BUG FIX — "couldn't log in": when the project requires email
        // confirmation, signUp returns no session and the form just sat
        // there. Say what to do instead of looking broken.
        if (!data.session) {
          setMode("login");
          setAuthInfo(`Almost done — we emailed ${email.trim()} a confirmation link. Open it, then log in here.`);
          return;
        }
        // BUG FIX — this used to fake a customer record into local React
        // state with no matching Supabase insert at all, so it silently
        // never persisted anywhere and vanished on reload/another device.
        // A brand-new signup with no existing customer row anywhere now
        // correctly lands on the "Find & Connect" screen (see the !cust
        // render branch below) instead of a record that was never real.
        setSession(data.session || null);
        toast?.("Account created — welcome!", "green");
      } else {
        const { data, error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
        if (error) throw error;
        setSession(data.session || null);
      }
    } catch (e: any) {
      const msg = String(e?.message || "");
      setAuthError(/email not confirmed/i.test(msg) ? "Your email isn't confirmed yet — open the confirmation email we sent, then log in." : /invalid login/i.test(msg) ? "Wrong email or password. Tap \"Forgot password?\" to reset it." : (msg || "Authentication failed"));
    } finally {
      setAuthBusy(false);
    }
  };

  const signOut = async () => {
    // GUARD — this shares the same Supabase client as the owner's real CRM
    // session; in demoMode a real signOut would sign the OWNER out. Just
    // close the demo overlay instead.
    if (demoMode) { onExitDemo(); return; }
    await supabase.auth.signOut({ scope: "local" }); setSession(null);
  };

  const handleForgotPassword = async () => {
    setAuthError("");
    if (!email.trim()) { setAuthError("Enter your email above first, then tap \"Forgot password?\""); return; }
    setForgotBusy(true);
    try {
      const redirectTo = `${window.location.origin}${window.location.pathname}#/reset-password`;
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo });
      if (error) throw error;
      setForgotSent(true);
      toast?.("Password reset email sent ✓", "green");
    } catch (e: any) {
      setAuthError(e?.message || "Failed to send reset email");
    } finally {
      setForgotBusy(false);
    }
  };

  // BUG FIX — this used to always read the GLOBAL `settings` prop, which is
  // empty on a real customer's own device (they're not the owner, so it
  // never resolves current_owner_id()) — and, once a customer can belong to
  // more than one business, was wrong regardless since each account has its
  // own name. Prefer the active account's own resolved company name once
  // logged in; the prop/generic fallback only matters pre-login.
  const companyName = active?.settings?.companyName || settings?.companyName || "CRM Starter";

  if (!demoMode && (!checked || (session?.user?.email && portalData === null))) {
    return <div className="min-h-screen bg-black flex items-center justify-center text-white/40 text-sm">Loading…</div>;
  }

  if (demoMode && !demoAccount) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center p-4 text-center">
        <div className="max-w-sm space-y-3">
          <div className="text-white/60 font-semibold">No customer with jobs or quotes yet to preview</div>
          <div className="text-sm text-white/40">Create a customer with at least one quote or job, then try this demo again.</div>
          <GBtn onClick={onExitDemo}>Close</GBtn>
        </div>
      </div>
    );
  }

  // ── Logged out — login / signup form ──────────────────────────────────────
  if (!demoMode && !session) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center p-4">
        <div className="w-full max-w-sm space-y-5">
          <AuthHeader subtitle="General Client Portal" />
          {!invite && <AuthRoleTabs active="customer" />}
          {invite && !invite.error && !invite.claimed && (
            <Glass className="p-3 text-xs text-white/70 !border-green-700/40">
              <span className="font-semibold text-white">{invite.companyName || "Your service company"} set up your account{invite.firstName ? `, ${invite.firstName}` : ""}.</span> Your details are filled in — just choose a password.
            </Glass>
          )}
          {invite?.error && <Glass className="p-3 text-xs text-danger-300">{invite.error}</Glass>}

          <Glass className="p-5 space-y-3">
            <div className="flex gap-1 p-1 bg-black/40 border border-white/10 rounded-xl">
              {(["login", "signup"] as const).map(m => (
                <button key={m} onClick={() => { setMode(m); setAuthError(""); }} className={"flex-1 py-1.5 rounded-lg text-xs font-medium transition capitalize " + (mode === m ? "bg-brand-600 text-brand-fg border border-brand-600" : "text-white/50")}>{m === "login" ? "Log In" : "Sign Up"}</button>
              ))}
            </div>

            {mode === "signup" && (
              <div className="grid grid-cols-2 gap-2">
                <GInput placeholder="First name" value={firstName} onChange={(e: any) => setFirstName(e.target.value)} className="!text-sm" />
                <GInput placeholder="Last name" value={lastName} onChange={(e: any) => setLastName(e.target.value)} className="!text-sm" />
              </div>
            )}
            <GInput type="email" placeholder="Email" value={email} onChange={(e: any) => setEmail(e.target.value)} className="!text-sm" />
            {mode === "signup" && <GInput type="tel" placeholder="Phone" value={phone} onChange={(e: any) => setPhone(e.target.value)} className="!text-sm" />}
            <div className="relative">
              <GInput type={showPassword ? "text" : "password"} placeholder="Password" value={password} onChange={(e: any) => setPassword(e.target.value)} onKeyDown={(e: any) => e.key === "Enter" && handleAuth()} className="!text-sm !pr-10" />
              <button type="button" onClick={() => setShowPassword(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60 transition" tabIndex={-1}>
                {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>
            <div className="flex justify-end -mt-1">
              <button type="button" onClick={() => setShowPassword(v => !v)} className="text-xs font-medium text-white/60 hover:text-white">{showPassword ? "Hide password" : "Show password"}</button>
            </div>
            {authInfo && <div className="text-xs text-green-400">{authInfo}</div>}
            {authError && <div className="text-xs text-danger-400">{authError}</div>}
            <GBtn onClick={handleAuth} disabled={authBusy} className="w-full !py-3">{authBusy ? "Please wait…" : mode === "login" ? "Log In" : "Create Account"}</GBtn>
            {mode === "login" && (
              forgotSent ? (
                <div className="text-xs text-green-400 text-center">Check your email for a password reset link.</div>
              ) : (
                <button type="button" onClick={handleForgotPassword} disabled={forgotBusy} className="w-full text-center text-xs text-white/40 hover:text-white/70 transition disabled:opacity-50">
                  {forgotBusy ? "Sending…" : "Forgot password?"}
                </button>
              )
            )}
          </Glass>
        </div>
      </div>
    );
  }

  // ── Logged in, no matching customer record yet — "Find & Connect" ─────────
  // BUG FIX — this used to be a dead end ("we couldn't find a customer
  // record... contact the business to link your account") with no way
  // forward from inside the app at all. Now lets the customer search
  // businesses on the platform and request to become their customer —
  // lands as a pending "lead" the owner approves from Lead Intake, same as
  // any other inbound lead.
  if (!cust) {
    return (
      <div className="min-h-screen bg-black p-4">
        <div className="max-w-sm mx-auto space-y-4 pt-8">
          <div className="text-center space-y-1.5">
            <Building2 size={32} className="mx-auto text-white/20" />
            <div className="text-white font-semibold">Find a business</div>
            <div className="text-xs text-white/40">Search for the company you hire — we'll let them know you'd like to connect.</div>
            <div className="text-[11px] text-white/30">Work for the business? Don't connect here — open the invite link your boss sent you.</div>
          </div>
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30" />
            <GInput placeholder="Search by business name..." value={findQuery} onChange={(e: any) => searchBusinesses(e.target.value)} className="!text-sm !pl-9" />
          </div>
          {findBusy && <div className="text-center text-xs text-white/30">Searching…</div>}
          {findError && <div className="text-center text-xs text-danger-400">{findError}</div>}
          <div className="space-y-2">
            {findResults.map(b => {
              const isConnecting = connectingOwnerId === b.ownerId;
              const isConnected = connectedOwnerIds.includes(b.ownerId);
              return (
                <Glass key={b.ownerId} className="p-3 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-sm font-medium truncate">{b.companyName}</div>
                    {b.companyPhone && <div className="text-[11px] text-white/40">{b.companyPhone}</div>}
                  </div>
                  {isConnected ? (
                    <Badge tone="green">Requested</Badge>
                  ) : (
                    <GBtn disabled={isConnecting} onClick={() => requestConnect(b.ownerId)} className="!text-xs !py-1.5 flex-shrink-0">
                      {isConnecting ? "Sending…" : <><Plus size={12} className="inline mr-1" />Connect</>}
                    </GBtn>
                  )}
                </Glass>
              );
            })}
            {!findBusy && !findError && findQuery.trim().length >= 2 && findResults.length === 0 && (
              <div className="text-center text-xs text-white/30 py-4">No businesses found matching "{findQuery}" — double-check the spelling, or ask them for their direct signup link instead.</div>
            )}
          </div>
          <div className="text-center pt-2">
            <GBtn variant="ghost" onClick={signOut}><LogOut size={13} className="inline mr-1.5" />Sign Out</GBtn>
          </div>
        </div>
      </div>
    );
  }

  const myEstimates = active?.estimates || [];

  // FEATURE — "owners for multi-property accounts should manage the
  // different addresses under one login inside the customer portal." A
  // customer with saved additional properties (cust.addresses, added by the
  // owner in CustomerModal) can switch between them here to see just that
  // property's jobs/quotes/invoices — one login, every property, instead of
  // needing a separate account per address. Customers with zero additional
  // addresses see no switcher at all — no behavior change for the common
  // single-property case.
  const propertyOptions = [
    { id: "", label: "All Properties", address: null as string | null },
    ...(((cust.addresses || []).length > 0) ? [{ id: "__primary__", label: "Primary", address: cust.address || null }] : []),
    ...(cust.addresses || []).map((a: any) => ({ id: a.id, label: a.label || a.street, address: [a.street, a.city, a.state].filter(Boolean).join(", ") })),
  ];
  const hasMultipleProperties = (cust.addresses || []).length > 0;
  const selectedProperty = propertyOptions.find(p => p.id === selectedPropertyId);
  const propertyFilterAddress = selectedProperty?.address || null;

  const myInvoicesAll = myEstimates.filter(e => e.customerId === cust.id && e.invoiced);
  const myInvoices = propertyFilterAddress
    ? myInvoicesAll.filter(e => (active?.jobs || []).find((j: any) => j.id === e.jobId)?.address === propertyFilterAddress)
    : myInvoicesAll;
  const outstanding = myInvoices.filter(e => !e.paidAt);
  const paid = myInvoices.filter(e => !!e.paidAt);
  const myJobsList = active?.jobs || [];
  const myJobs = myJobsList.filter(j => j.customerId === cust.id && (!propertyFilterAddress || j.address === propertyFilterAddress)).sort((a, b) => (b.scheduledDate || "").localeCompare(a.scheduledDate || ""));
  const completedJobs = myJobs.filter(j => j.status === "completed");
  // AUDIT FIX (round 13, item 7) — upcoming vs past, instead of one
  // undifferentiated list newest-first (a customer's next job could be
  // buried below a year of completed history).
  const upcomingJobs = myJobs.filter(j => j.status !== "completed" && j.status !== "cancelled").sort((a, b) => (a.scheduledDate || "").localeCompare(b.scheduledDate || ""));
  const pastJobs = myJobs.filter(j => j.status === "completed" || j.status === "cancelled");
  const myQuotesAll = myEstimates.filter(e => e.customerId === cust.id && !e.invoiced).sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""));
  const myQuotes = propertyFilterAddress
    ? myQuotesAll.filter(e => myJobsList.find((j: any) => j.id === e.jobId)?.address === propertyFilterAddress)
    : myQuotesAll;

  const requestReschedule = async (jobId: string) => {
    setReschedulingSend(true);
    try {
      const j = myJobsList.find(x => x.id === jobId);
      // SECURITY/SYNC FIX (audit finding) — this never checked the result at
      // all (not even `.error`, let alone RLS's 0-row-silent-success case),
      // so a customer always saw "request sent ✓" even when the write never
      // landed and the owner's dashboard never saw the request. Bail out of
      // the whole flow (no notification, no optimistic UI, no success toast)
      // unless the write actually matched a row.
      const rescheduleRes = await (supabase as any).from("jobs").update({
        rescheduleRequested: true, rescheduleRequestNote: rescheduleNote.trim() || null, rescheduleRequestedAt: new Date().toISOString(),
      }).eq("id", jobId).select("id");
      if (rescheduleRes?.error || !Array.isArray(rescheduleRes?.data) || rescheduleRes.data.length === 0) {
        toast?.("Couldn't send request — please call or text us directly", "red");
        return;
      }
      // Same anonymous-safe owner-notification proxy CustomerReviewPage.tsx/
      // ClientPortal.tsx use — see functions/api/alfred-notify.ts.
      fetch("/api/alfred-notify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: "Alfred Notifications",
          message: `📅 RESCHEDULE REQUESTED\n\n${cust.firstName} ${cust.lastName} asked to reschedule their ${j?.scheduledDate || "upcoming"} job at ${j?.address || "their property"}.${rescheduleNote.trim() ? `\n\nNote: "${rescheduleNote.trim()}"` : ""}`,
          jobId: jobId, customerId: cust.id,
        }),
      }).catch(() => {});
      // Optimistic local update — portalData is now this page's source of
      // truth for `jobs` (see MULTI-TENANT note above), so without this the
      // "Reschedule requested" badge wouldn't show until the next full
      // fetchPortalData() call.
      patchActiveJobs(jobs => jobs.map(x => x.id === jobId ? { ...x, rescheduleRequested: true } as any : x));
      toast?.("Reschedule request sent — we'll be in touch to confirm a new date ✓", "green");
      setRescheduleJobId(null);
      setRescheduleNote("");
    } catch (e: any) {
      toast?.("Couldn't send request — please call or text us directly", "red");
    } finally {
      setReschedulingSend(false);
    }
  };
  // TODO(multitenant): referredCustomers still reads the App.tsx global
  // `customers` prop, which is owner_id-scoped and will be empty for this
  // customer session once RLS is live — public-data.ts has no action for
  // "customers this customer referred" yet, so this list will just render
  // empty rather than crash. Flagging rather than guessing at a new
  // server-side action for it.
  const referredCustomers = customers.filter(c => c.referredBy === cust.id);
  const referralLink = `${window.location.origin}${window.location.pathname}#/referral?ref=${cust.referralCode || ""}`;
  const isCommercial = !!cust.isCommercial || (cust.tags || []).includes("Commercial");

  // `cust` now comes from portalData (see MULTI-TENANT note above), not from
  // the `customers` prop array — so a setCustomers() call updating that prop
  // array no longer touches what `cust` reads from. Mirror any patch into
  // portalData.customer too so recurring-payment/save-card UI still updates
  // immediately, same as it did when `cust` was sourced from `customers`.
  const patchCust = (patch: Partial<Customer> | ((c: Customer) => Partial<Customer>)) => {
    setPortalData(prev => {
      if (!prev?.accounts?.[activeIdx]?.customer) return prev;
      const c = prev.accounts[activeIdx].customer;
      const p = typeof patch === "function" ? patch(c) : patch;
      const accounts = prev.accounts.map((a, i) => i === activeIdx ? { ...a, customer: { ...a.customer, ...p } } : a);
      return { ...prev, accounts };
    });
  };
  // Patches jobs/estimates on the currently active account only.
  const patchActiveJobs = (fn: (jobs: Job[]) => Job[]) => {
    setPortalData(prev => {
      if (!prev?.accounts?.[activeIdx]) return prev;
      const accounts = prev.accounts.map((a, i) => i === activeIdx ? { ...a, jobs: fn(a.jobs) } : a);
      return { ...prev, accounts };
    });
  };
  const patchActiveEstimates = (fn: (estimates: Estimate[]) => Estimate[]) => {
    setPortalData(prev => {
      if (!prev?.accounts?.[activeIdx]) return prev;
      const accounts = prev.accounts.map((a, i) => i === activeIdx ? { ...a, estimates: fn(a.estimates) } : a);
      return { ...prev, accounts };
    });
  };

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="bg-brand-600 px-5 py-4 flex items-center justify-between text-brand-fg">
        <div>
          <div className="font-bold">{companyName}</div>
          <div className="text-brand-fg/60 text-xs">Hi {cust.firstName} 👋</div>
        </div>
        <button onClick={signOut} className="text-brand-fg/70 hover:text-brand-fg flex items-center gap-1 text-xs"><LogOut size={14} />Sign Out</button>
      </div>

      {/* MULTI-BUSINESS — switcher, only shown once there's more than one
          business to switch between (a brand-new single-business customer
          sees nothing extra here). */}
      {(portalData?.accounts?.length || 0) > 1 && (
        <div className="bg-black/60 border-b border-white/10 px-4 py-2 flex items-center gap-2 overflow-x-auto">
          {portalData!.accounts.map((a, i) => (
            <button key={a.customer.id} onClick={() => setActiveIdx(i)} className={"flex-shrink-0 px-3 py-1.5 rounded-lg text-xs font-medium transition whitespace-nowrap " + (i === activeIdx ? "bg-brand-700/40 text-white border border-brand-700/50" : "bg-white/5 text-white/50 border border-white/10 hover:text-white/80")}>
              {a.settings?.companyName || "Business " + (i + 1)}
            </button>
          ))}
          <button onClick={() => setFindOpen(true)} className="flex-shrink-0 px-3 py-1.5 rounded-lg text-xs text-white/40 hover:text-white/70 border border-dashed border-white/15 flex items-center gap-1"><Plus size={11} />Add</button>
        </div>
      )}

      {/* MULTI-PROPERTY — switcher, only shown once this customer has
          additional properties on file (added by the owner). Filters
          Jobs/Quotes/Invoices below to just the selected property. */}
      {hasMultipleProperties && (
        <div className="bg-black/60 border-b border-white/10 px-4 py-2 flex items-center gap-2 overflow-x-auto">
          <Building2 size={12} className="text-white/30 flex-shrink-0" />
          {propertyOptions.map(p => (
            <button key={p.id || "all"} onClick={() => setSelectedPropertyId(p.id)} className={"flex-shrink-0 px-3 py-1.5 rounded-lg text-xs font-medium transition whitespace-nowrap " + (selectedPropertyId === p.id ? "bg-blue-700/40 text-white border border-blue-700/50" : "bg-white/5 text-white/50 border border-white/10 hover:text-white/80")}>
              {p.label}
            </button>
          ))}
        </div>
      )}

      <div className="max-w-2xl mx-auto p-4 space-y-4">
        {(portalData?.accounts?.length || 0) <= 1 && (
          <button onClick={() => setFindOpen(true)} className="w-full text-center text-[11px] text-white/30 hover:text-white/60 transition flex items-center justify-center gap-1.5"><Plus size={11} />Connect to another business</button>
        )}
        {(cust as any).pipelineStage === "lead" && !demoMode && (
          <Glass className="p-3 text-xs text-white/60">
            <span className="font-semibold text-white">Request sent to {companyName}.</span> They'll confirm you as a customer — your quotes, jobs and invoices from them will show up here.
          </Glass>
        )}
        <div className="grid grid-cols-3 gap-3">
          <Stat icon={Receipt} label="Outstanding" value={fmt(outstanding.reduce((s, e) => s + e.total, 0))} />
          <Stat icon={CheckCircle} label="Jobs Done" value={String(completedJobs.length)} />
          <Stat icon={Gift} label="Referral Credit" value={fmt(cust.referralCreditOwed || 0)} />
        </div>

        <ReviewNudgeBanner cust={cust} completedJobsCount={completedJobs.length} settings={active?.settings} />

        <div className="flex gap-1 p-1 bg-white/5 border border-white/10 rounded-xl overflow-x-auto">
          {/* AUDIT FIX (round 13, item 7) — added a Quotes tab (pending,
              not-yet-invoiced estimates were previously invisible here —
              only invoiced ones showed, under "Invoices"), and renamed
              "Past Jobs" -> "Jobs" since that tab now shows upcoming AND
              past jobs together (see below). */}
          {([["invoices", "Invoices", Receipt], ["quotes", "Quotes", FileText], ["jobs", "Jobs", Clock], ["coupons", `Coupons${(active?.coupons || []).length ? ` (${(active?.coupons || []).length})` : ""}`, Tag], ["referrals", "Referrals", Gift], ["payment", "Payment", CreditCard]] as const).map(([key, label, Icon]) => (
            <button key={key} onClick={() => setTab(key)} className={"flex-1 py-2 rounded-lg text-xs font-medium transition flex items-center justify-center gap-1.5 whitespace-nowrap " + (tab === key ? "bg-brand-700/40 text-white border border-brand-700/50" : "text-white/50")}><Icon size={12} />{label}</button>
          ))}
        </div>

        {tab === "coupons" && (
          <div className="space-y-3">
            {(active?.coupons || []).length === 0 && <Glass className="p-6 text-center text-sm text-white/40">No coupons right now — when {companyName} sends you one (like a birthday coupon), it shows up here.</Glass>}
            {(active?.coupons || []).map(cp => {
              const daysLeft = cp.validTo ? Math.ceil((Date.parse(cp.validTo + "T23:59:59") - Date.now()) / 86400000) : null;
              return (
                <Glass key={cp.id} className={"p-4 space-y-2 " + (cp.justForYou ? "!border-yellow-600/40" : "")} data-coupon={cp.code}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="font-semibold text-sm">{cp.discountType === "percent" ? `${cp.discountValue}% off` : `${fmt(cp.discountValue)} off`}{cp.justForYou && <span className="ml-2 text-[10px] text-yellow-300 font-normal">Just for you</span>}</div>
                      <div className="text-xs text-white/50">{cp.name}{cp.description ? ` · ${cp.description}` : ""}</div>
                    </div>
                    <button onClick={() => { try { navigator.clipboard.writeText(cp.code); toast?.("Code copied ✓", "green"); } catch {} }} className="font-mono text-sm px-2.5 py-1 rounded-lg border border-dashed border-white/30 bg-white/5 hover:bg-white/10 flex-shrink-0">{cp.code}</button>
                  </div>
                  <div className={"text-[11px] " + (daysLeft !== null && daysLeft <= 7 ? "text-orange-300" : "text-white/45")}>
                    {cp.validTo ? `Expires ${new Date(cp.validTo + "T12:00:00").toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}${daysLeft !== null ? ` · ${daysLeft <= 0 ? "last day" : daysLeft === 1 ? "1 day left" : daysLeft + " days left"}` : ""}` : "No expiry date"}
                    {" · "}Enter the code when you pay an invoice. One use.
                  </div>
                </Glass>
              );
            })}
          </div>
        )}

        {tab === "invoices" && (
          <div className="space-y-3">
            {outstanding.length > 0 && <div className="text-xs text-white/40 uppercase tracking-wider">Outstanding</div>}
            {outstanding.map(inv => (
              <Glass key={inv.id} className="p-4 flex items-center justify-between gap-3">
                <div>
                  <div className="font-semibold">{fmt(inv.total)}</div>
                  <div className="text-xs text-white/40">{inv.invoicedAt || inv.createdAt}</div>
                </div>
                <GBtn onClick={() => { setAgreedInvoiceTerms(false); setPayDisclaimerInv(inv); }} className="!text-xs !py-2"><CreditCard size={13} className="inline mr-1" />Pay Now</GBtn>
              </Glass>
            ))}
            {outstanding.length === 0 && <div className="text-center py-6 text-white/30 text-sm">No outstanding invoices 🎉</div>}

            {payDisclaimerInv && (
              <Glass className="p-4 space-y-3 !border-brand-700/40">
                <div className="text-sm font-semibold">Confirm payment of {fmt(payDisclaimerInv.total)}</div>
                <label className="flex items-start gap-2.5 cursor-pointer">
                  <input type="checkbox" checked={agreedInvoiceTerms} onChange={ev => setAgreedInvoiceTerms(ev.target.checked)} className="mt-0.5 flex-shrink-0" />
                  <span className="text-[13px] text-white/70 leading-relaxed">
                    I authorize {companyName} to charge {fmt(payDisclaimerInv.total)} to my payment method. I understand this charge is non-refundable once service has been rendered, and that {companyName} may retain job photos/videos as service records for up to {(settings as any)?.mediaRetentionDays || 30} days. If I provided a phone number, I may receive text updates about this service (message/data rates may apply — reply STOP at any time to opt out, HELP for help; see {companyName}'s{" "}
                    <a href={"#/terms?co=" + encodeURIComponent(companyName)} target="_blank" rel="noopener noreferrer" className="underline text-brand-300">Terms</a> and{" "}
                    <a href={"#/privacy?co=" + encodeURIComponent(companyName)} target="_blank" rel="noopener noreferrer" className="underline text-brand-300">Privacy Policy</a>)
                    {payDisclaimerInv.terms ? <> — see full terms below.</> : "."}
                    {payDisclaimerInv.terms && <div className="mt-1.5 text-white/40 whitespace-pre-wrap">{payDisclaimerInv.terms}</div>}
                  </span>
                </label>
                <div className="flex gap-2">
                  <GBtn variant="ghost" onClick={() => setPayDisclaimerInv(null)} className="!text-xs">Cancel</GBtn>
                  <GBtn onClick={() => { setPayingInv(payDisclaimerInv); setPayDisclaimerInv(null); }} disabled={!agreedInvoiceTerms} className="!text-xs flex-1">Continue to Payment</GBtn>
                </div>
              </Glass>
            )}

            <div className="text-xs text-white/40 uppercase tracking-wider pt-2">Paid</div>
            {paid.length === 0 && <div className="text-center py-6 text-white/30 text-sm">No paid invoices yet</div>}
            {paid.map(inv => (
              <Glass key={inv.id} className="p-4 flex items-center justify-between gap-3 !bg-black/30">
                <div>
                  <div className="font-semibold">{fmt(inv.total)}</div>
                  <div className="text-xs text-white/40">Paid {inv.paidAt}</div>
                </div>
                <Badge tone="green">Paid</Badge>
              </Glass>
            ))}
          </div>
        )}

        {/* AUDIT FIX (round 13, item 7) — Quotes tab: pending (not yet
            invoiced) estimates, previously invisible in this portal — only
            invoiced ones ever showed, under Invoices. */}
        {tab === "quotes" && (
          <div className="space-y-3">
            {myQuotes.length === 0 && <div className="text-center py-6 text-white/30 text-sm">No quotes on file</div>}
            {myQuotes.map(q => (
              <Glass key={q.id} className="p-4 flex items-center justify-between gap-3">
                <div>
                  <div className="font-semibold">{fmt(q.total)}</div>
                  <div className="text-xs text-white/40">{q.createdAt}</div>
                </div>
                <Badge tone={q.status === "approved" ? "green" : q.status === "rejected" ? "red" : "yellow"}>{q.status}</Badge>
              </Glass>
            ))}
          </div>
        )}

        {tab === "jobs" && (
          <div className="space-y-5">
            <div>
              <div className="text-xs text-white/50 uppercase tracking-wider font-semibold mb-2 flex items-center gap-1.5"><CalendarClock size={12} />Upcoming</div>
              {upcomingJobs.length === 0 && <div className="text-center py-6 text-white/30 text-sm">No upcoming jobs</div>}
              {upcomingJobs.map(j => (
                <Glass key={j.id} className="p-4 mb-2">
                  <div className="flex items-center justify-between mb-2 gap-2">
                    <div className="text-sm font-medium truncate">{j.address}</div>
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      {j.jobType === "commercial" && <Badge tone="blue">Commercial</Badge>}
                      {j.isRecurring && <Badge tone="purple"><Repeat size={9} className="inline mr-0.5" />{j.recurringFreq || "Recurring"}</Badge>}
                      <Badge tone={j.status === "cancelled" ? "red" : "blue"}>{j.status}</Badge>
                    </div>
                  </div>
                  <div className="text-xs text-white/40">{j.scheduledDate}{j.scheduledTime ? ` · ${j.scheduledTime}` : ""}</div>
                  {/* FEATURE — "business name shows for each job, especially
                      with multiple businesses." myJobs is already scoped to
                      whichever business account is currently active, so this
                      is unambiguous — but it's easy to lose track of which
                      business you're viewing after switching or scrolling,
                      so label it on every job explicitly rather than relying
                      on the header alone. */}
                  {(portalData?.accounts?.length || 0) > 1 && <div className="text-[10px] text-brand-400/70 mt-0.5">{companyName}</div>}

                  {/* FEATURE — self-serve cancel/reschedule, independently
                      owner-toggleable (settings.clientPortalCanCancel /
                      clientPortalCanReschedule — see SettingsModal.tsx).
                      Falls back to the legacy combined
                      clientPortalCancelReschedule flag when the new per-
                      action ones aren't set, so existing owners' choice
                      keeps working unchanged; falls back further to the
                      request-only flow for reschedule when direct self-serve
                      is off for that action. There's no self-serve "request
                      to cancel" equivalent — an owner who wants cancellation
                      requestable-but-not-automatic should tell customers to
                      call/text, same as before this feature existed. */}
                  {(() => {
                    const canCancel = (settings as any)?.clientPortalCanCancel ?? settings?.clientPortalCancelReschedule;
                    const canReschedule = (settings as any)?.clientPortalCanReschedule ?? settings?.clientPortalCancelReschedule;
                    if (directActionJobId === j.id) {
                      return (
                        <div className="mt-2 space-y-2">
                          <div className="text-[11px] font-semibold text-white/70">{directActionType === "cancel" ? "Cancel this job" : "Reschedule this job"}</div>
                          {directActionType === "reschedule" && (
                            <div className="flex gap-2">
                              <input type="date" value={directNewDate} onChange={e => setDirectNewDate(e.target.value)} className="flex-1 bg-white/5 border border-white/15 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-brand-500/50" />
                              <input type="time" value={directNewTime} onChange={e => setDirectNewTime(e.target.value)} className="flex-1 bg-white/5 border border-white/15 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-brand-500/50" />
                            </div>
                          )}
                          <textarea value={directReason} onChange={e => setDirectReason(e.target.value)} rows={2} placeholder="Reason (required)" className="w-full bg-white/5 border border-white/15 rounded-lg px-2.5 py-1.5 text-xs text-white placeholder-white/25 resize-none focus:outline-none focus:border-white/40" />
                          <div className="flex gap-2">
                            <button disabled={directSending} onClick={submitDirectAction} className="flex-1 py-1.5 rounded-lg bg-brand-700/40 border border-brand-600/50 text-white text-xs font-semibold disabled:opacity-50">{directSending ? "Sending…" : directActionType === "cancel" ? "Confirm Cancellation" : "Confirm New Date"}</button>
                            <button disabled={directSending} onClick={() => { setDirectActionJobId(null); setDirectActionType(null); setDirectReason(""); setDirectNewDate(""); setDirectNewTime(""); }} className="px-3 text-[11px] text-white/40 hover:text-white/60">Back</button>
                          </div>
                        </div>
                      );
                    }
                    if (canCancel || canReschedule) {
                      return (
                        <div className="mt-2 flex items-center gap-3 flex-wrap">
                          {canReschedule && <button onClick={() => { setDirectActionJobId(j.id); setDirectActionType("reschedule"); }} className="text-[11px] text-blue-400 hover:text-blue-300 flex items-center gap-1"><CalendarClock size={11} />Reschedule</button>}
                          {canCancel && <button onClick={() => { setDirectActionJobId(j.id); setDirectActionType("cancel"); }} className="text-[11px] text-brand-400 hover:text-brand-300">Cancel Job</button>}
                          {!canReschedule && (
                            j.rescheduleRequested
                              ? <span className="text-[11px] text-yellow-300/80">📅 Reschedule requested</span>
                              : <button onClick={() => setRescheduleJobId(j.id)} className="text-[11px] text-blue-400 hover:text-blue-300 flex items-center gap-1"><CalendarClock size={11} />Request Reschedule</button>
                          )}
                        </div>
                      );
                    }
                    if (j.rescheduleRequested) {
                      return <div className="text-[11px] text-yellow-300/80 mt-2">📅 Reschedule requested — we'll confirm a new date soon.</div>;
                    }
                    if (rescheduleJobId === j.id) {
                      return (
                        <div className="mt-2 space-y-2">
                          <textarea value={rescheduleNote} onChange={e => setRescheduleNote(e.target.value)} rows={2} placeholder="Preferred new date/time (optional)" className="w-full bg-white/5 border border-white/15 rounded-lg px-2.5 py-1.5 text-xs text-white placeholder-white/25 resize-none focus:outline-none focus:border-brand-500/50" />
                          <div className="flex gap-2">
                            <button disabled={reschedulingSend} onClick={() => requestReschedule(j.id)} className="flex-1 py-1.5 rounded-lg bg-brand-700/40 border border-brand-600/50 text-white text-xs font-semibold disabled:opacity-50">{reschedulingSend ? "Sending…" : "Send Request"}</button>
                            <button disabled={reschedulingSend} onClick={() => { setRescheduleJobId(null); setRescheduleNote(""); }} className="px-3 text-[11px] text-white/40 hover:text-white/60">Cancel</button>
                          </div>
                        </div>
                      );
                    }
                    return <button onClick={() => setRescheduleJobId(j.id)} className="mt-2 text-[11px] text-blue-400 hover:text-blue-300 flex items-center gap-1"><CalendarClock size={11} />Request Reschedule</button>;
                  })()}
                </Glass>
              ))}
            </div>
            <div>
              <div className="text-xs text-white/50 uppercase tracking-wider font-semibold mb-2 flex items-center gap-1.5"><Clock size={12} />Past Jobs</div>
              {pastJobs.length === 0 && <div className="text-center py-6 text-white/30 text-sm">No past jobs yet</div>}
              {pastJobs.map(j => (
                <Glass key={j.id} className="p-4 mb-2">
                  <div className="flex items-center justify-between mb-2 gap-2">
                    <div className="text-sm font-medium truncate">{j.address}</div>
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      {j.jobType === "commercial" && <Badge tone="blue">Commercial</Badge>}
                      {j.isRecurring && <Badge tone="purple"><Repeat size={9} className="inline mr-0.5" />{j.recurringFreq || "Recurring"}</Badge>}
                      <Badge tone={j.status === "completed" ? "green" : "red"}>{j.status}</Badge>
                    </div>
                  </div>
                  <div className="text-xs text-white/40">{j.scheduledDate}</div>
                  {(portalData?.accounts?.length || 0) > 1 && <div className="text-[10px] text-brand-400/70 mt-0.5">{companyName}</div>}
                  {(j.photos || []).length > 0 && (
                    <div className="flex gap-2 mt-2 overflow-x-auto">
                      {j.photos.map(p => <img key={p.id} src={mediaSrc(p.url, p.dataUrl)} alt="" className="w-16 h-16 rounded-lg object-cover border border-white/10 flex-shrink-0" />)}
                    </div>
                  )}
                </Glass>
              ))}
            </div>
          </div>
        )}

        {tab === "referrals" && (() => {
          // FEATURE — referral progress tracker. Reuses the SAME reward tier
          // ladder ReferralsPage.tsx already shows the owner (lib/seed.ts's
          // seedRewardTiers) so a client's "how close am I" view matches what
          // the owner actually offers, instead of a made-up parallel scale.
          const referredCount = referredCustomers.length;
          const sortedTiers = [...seedRewardTiers].sort((a, b) => a.minReferrals - b.minReferrals);
          const tiersReached = sortedTiers.filter(t => referredCount >= t.minReferrals);
          const currentTier = tiersReached[tiersReached.length - 1] || null;
          const nextTier = sortedTiers.find(t => t.minReferrals > referredCount) || null;
          const prevThreshold = currentTier?.minReferrals || 0;
          const progressPct = nextTier
            ? Math.min(100, Math.round(((referredCount - prevThreshold) / (nextTier.minReferrals - prevThreshold)) * 100))
            : 100;
          return (
            <div className="space-y-3">
              <Glass className="p-4">
                <div className="text-xs text-white/50 mb-1">Your referral code</div>
                <div className="text-2xl font-bold tracking-wider">{cust.referralCode || "—"}</div>
                <button onClick={() => { navigator.clipboard.writeText(referralLink); toast?.("Referral link copied ✓"); }} className="mt-3 w-full py-2.5 rounded-xl bg-white/10 hover:bg-white/15 text-sm flex items-center justify-center gap-2"><Copy size={13} />Copy Referral Link</button>
              </Glass>
              <div className="grid grid-cols-2 gap-3">
                <Stat icon={User} label="Referred" value={String(referredCount)} />
                <Stat icon={Gift} label="Credit Owed" value={fmt(cust.referralCreditOwed || 0)} />
              </div>

              {sortedTiers.length > 0 && (
                <Glass className="p-4">
                  <div className="flex items-center justify-between mb-2">
                    <div className="text-xs font-semibold text-white/70">
                      {currentTier ? <>Unlocked: {currentTier.icon} {currentTier.reward}</> : "Refer a friend to start earning rewards"}
                    </div>
                    {nextTier && <div className="text-[10px] text-white/40">{nextTier.minReferrals - referredCount} more to {nextTier.icon} {nextTier.label}</div>}
                  </div>
                  {nextTier && (
                    <div className="h-2 rounded-full bg-white/10 overflow-hidden mb-3">
                      <div className="h-full bg-brand-600 rounded-full transition-all text-brand-fg" style={{ width: `${progressPct}%` }} />
                    </div>
                  )}
                  <div className="space-y-1.5">
                    {sortedTiers.map(t => {
                      const reached = referredCount >= t.minReferrals;
                      return (
                        <div key={t.id} className={"flex items-center justify-between text-xs px-2.5 py-1.5 rounded-lg " + (reached ? "bg-green-950/20 text-green-300" : "text-white/40")}>
                          <span className="flex items-center gap-1.5">{t.icon} {t.label} ({t.minReferrals})</span>
                          <span className="flex items-center gap-1">{reached && <CheckCircle size={11} />}{t.reward}</span>
                        </div>
                      );
                    })}
                  </div>
                </Glass>
              )}
            </div>
          );
        })()}

        {tab === "payment" && (
          <div className="space-y-3">
            <Glass className="p-4">
              <div className="text-sm font-medium mb-2">Saved Payment Methods</div>
              {myCards.length > 0 ? (
                <div className="space-y-2 mb-2">
                  {myCards.map(card => {
                    const isDefault = card.id === cust.savedPaymentMethodId;
                    const canRemove = !isDefault || myCards.length > 1 || !(cust.recurringPayment?.enabled || jobs.some(j => j.customerId === cust.id && j.isRecurring));
                    return (
                      <div key={card.id} className={"flex items-center justify-between p-2.5 rounded-xl border " + (isDefault ? "border-emerald-600/40 bg-emerald-950/10" : "border-white/10 bg-white/5")}>
                        <div className="text-xs text-white/70 flex items-center gap-2">
                          <CreditCard size={14} className={isDefault ? "text-emerald-400" : "text-white/40"} />
                          {(card.brand || "Card").replace(/^./, c => c.toUpperCase())} •••• {card.last4}
                          {card.expMonth ? <span className="text-white/30">· exp {String(card.expMonth).padStart(2, "0")}/{String(card.expYear).slice(-2)}</span> : null}
                          {isDefault && <Badge tone="green">Default</Badge>}
                        </div>
                        <div className="flex items-center gap-2">
                          {!isDefault && (
                            <button
                              disabled={cardsBusyId === card.id}
                              onClick={() => {
                                const label = `${(card.brand || "Card").replace(/^./, c => c.toUpperCase())} •••• ${card.last4}`;
                                setCustomers((prev: Customer[]) => prev.map(c => c.id === cust.id ? { ...c, savedPaymentMethodId: card.id, savedPaymentMethodLabel: label } : c));
                                patchCust({ savedPaymentMethodId: card.id, savedPaymentMethodLabel: label } as any);
                                toast?.("Default card updated ✓", "green");
                              }}
                              className="text-[11px] text-purple-400 hover:text-purple-300"
                            >Make Default</button>
                          )}
                          {canRemove && (
                            <button
                              disabled={cardsBusyId === card.id}
                              onClick={async () => {
                                setCardsBusyId(card.id);
                                try {
                                  await detachMyPaymentMethod(session!.access_token!, card.id);
                                  const remaining = myCards.filter(c => c.id !== card.id);
                                  if (isDefault) {
                                    const next = remaining[0];
                                    const label = next ? `${(next.brand || "Card").replace(/^./, c => c.toUpperCase())} •••• ${next.last4}` : "";
                                    setCustomers((prev: Customer[]) => prev.map(c => c.id === cust.id ? { ...c, savedPaymentMethodId: next?.id || "", savedPaymentMethodLabel: label } : c));
                                    patchCust({ savedPaymentMethodId: next?.id || "", savedPaymentMethodLabel: label } as any);
                                  }
                                  setMyCards(remaining);
                                  toast?.("Card removed", "green");
                                } catch (e: any) {
                                  toast?.("Couldn't remove card: " + (e?.message || "unknown error"), "red");
                                } finally {
                                  setCardsBusyId(null);
                                }
                              }}
                              className="text-[11px] text-brand-400 hover:text-brand-300"
                            >Remove</button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-xs text-white/40 mb-2">No cards saved yet.</div>
              )}
              <button onClick={() => setShowSaveCard(true)} disabled={!active?.settings?.stripePublishableKey} className="w-full py-2.5 rounded-xl bg-white/10 hover:bg-white/15 text-sm flex items-center justify-center gap-2 disabled:opacity-40"><CreditCard size={14} />+ Add New Card</button>
              {!active?.settings?.stripePublishableKey && <div className="text-[10px] text-white/30 mt-2">{companyName} hasn't connected online payments yet.</div>}
            </Glass>

            {isCommercial && (
              <Glass className="p-4 space-y-3">
                <div className="text-sm font-medium flex items-center gap-1.5"><Repeat size={14} />Recurring Payment</div>
                <label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={!!cust.recurringPayment?.enabled} onChange={(e: any) => patchCust(c => ({ recurringPayment: { ...(c.recurringPayment || { frequency: "monthly" }), enabled: e.target.checked } }))} className="accent-brand-600" />Enable recurring billing</label>
                {cust.recurringPayment?.enabled && (
                  <>
                    <div className="flex gap-1 p-1 bg-black/40 border border-white/10 rounded-xl">
                      {(["monthly", "quarterly"] as const).map(f => (
                        <button key={f} onClick={() => patchCust(c => ({ recurringPayment: { ...c.recurringPayment!, frequency: f } }))} className={"flex-1 py-1.5 rounded-lg text-xs capitalize transition " + (cust.recurringPayment?.frequency === f ? "bg-brand-700/40 text-white" : "text-white/50")}>{f}</button>
                      ))}
                    </div>
                    <GInput type="number" placeholder="Amount per charge ($)" value={cust.recurringPayment?.amount || ""} onChange={(e: any) => patchCust(c => ({ recurringPayment: { ...c.recurringPayment!, amount: Number(e.target.value) } }))} className="!text-sm" />
                    <div className="text-[10px] text-white/30">{companyName} will reach out before each charge — saved card required.</div>
                  </>
                )}
              </Glass>
            )}
          </div>
        )}
      </div>

      {/* AUDIT FIX — "Square unreachable from the full customer login
          portal." Same provider-resolution rule as ClientPortal.tsx: an
          explicit paymentProviderPreference wins; otherwise Stripe if
          configured, else Square — never both buttons/modals at once. */}
      {(() => {
        return resolvePaymentProvider({
          preference: (active?.settings as any)?.paymentProviderPreference,
          stripeConnected: !!active?.settings?.stripePublishableKey,
          squareConnected: !!squareConfig?.connected,
        }) === "square";
      })() ? (
        <SquarePaymentModal
          open={!!payingInv}
          onClose={() => setPayingInv(null)}
          applicationId={squareConfig?.applicationId || ""}
          locationId={squareConfig?.locationId || ""}
          amount={payingInv?.total || 0}
          description={`${companyName} — Invoice #${payingInv?.id || ""}`}
          invoiceId={payingInv?.id}
          onSuccess={(paymentId) => {
            const invId = payingInv?.id;
            setEstimates((prev: Estimate[]) => prev.map(e => e.id === invId ? { ...e, paidAt: today(), squarePaymentId: paymentId, stripePaymentStatus: "paid" as const } as any : e));
            patchActiveEstimates(ests => ests.map(e => e.id === invId ? { ...e, paidAt: today(), squarePaymentId: paymentId, stripePaymentStatus: "paid" as const } as any : e));
            // The receipt goes out once the payment is recorded (the server
            // only sends receipts for invoices with a payment on file).
            const recorded = invId ? confirmSquareInvoicePayment(invId, paymentId).catch((e: any) => {
              console.error("[Payment] confirmSquareInvoicePayment failed:", e?.message);
              toast?.("Payment received, but confirming it with the business is taking longer than usual — it may take a minute to show as paid.", "yellow");
            }) : Promise.resolve();
            recorded.then(() => sendPaymentReceipt({
              customerPhone: cust.phone, customerEmail: cust.email, customerFirstName: cust.firstName, customerId: cust.id,
              amountCents: Math.round((payingInv?.total || 0) * 100), description: `Invoice #${invId || ""}`, invoiceId: invId,
            })).catch((e: any) => console.warn("[PaymentReceipt] failed:", e?.message));
            toast?.("Payment received ✓", "green");
            setPayingInv(null);
          }}
        />
      ) : (
      <StripePaymentModal
        open={!!payingInv}
        onClose={() => setPayingInv(null)}
        publishableKey={active?.settings?.stripePublishableKey || ""}
        stripeAccountId={active?.settings?.stripeAccountId}
        amount={payingInv?.total || 0}
        description={`${companyName} — Invoice #${payingInv?.id || ""}`}
        invoiceId={payingInv?.id}
        allowSaveCard
        onSuccess={(paymentIntentId, savedCard) => {
          const invId = payingInv?.id;
          if (savedCard) {
            const isFirstCard = myCards.length === 0;
            const patch: any = { stripeCustomerId: savedCard.stripeCustomerId, cardConsentAt: new Date().toISOString() };
            if (isFirstCard) { patch.savedPaymentMethodId = savedCard.paymentMethodId; patch.savedPaymentMethodLabel = savedCard.label; }
            setCustomers((prev: Customer[]) => prev.map(c => c.id === cust.id ? { ...c, ...patch } : c));
            patchCust(patch);
            (async () => {
              try {
                const { data: sessData } = await supabase.auth.getSession();
                const token = sessData.session?.access_token;
                await fetch("/api/public-data", {
                  method: "POST",
                  headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
                  body: JSON.stringify({ action: "client_save_card_link", ...savedCard, consentAt: patch.cardConsentAt, setAsDefault: isFirstCard }),
                });
                refreshMyCards();
              } catch (e: any) { console.warn("[Payment] card save-on-file sync failed:", e?.message); }
            })();
          }
          // Global `estimates` prop is owner_id-scoped/empty for this
          // customer session now — this page renders from portalData, so
          // update that instead. Still call setEstimates too in case it's
          // ever non-empty (e.g. owner previewing this portal).
          setEstimates((prev: Estimate[]) => prev.map(e => e.id === invId ? { ...e, paidAt: today(), stripePaymentIntentId: paymentIntentId, stripePaymentStatus: "paid" as const } : e));
          patchActiveEstimates(ests => ests.map(e => e.id === invId ? { ...e, paidAt: today(), stripePaymentIntentId: paymentIntentId, stripePaymentStatus: "paid" as const } : e));
          // Persist to Supabase so the OWNER's CRM poll sees the payment and
          // fires an owner notification (BUG 15 / FEATURE 5).
          // AUDIT FIX — this used to write `estimates` directly on the
          // CUSTOMER's own Supabase session. Under owner_id-scoped RLS
          // (docs/ARCHITECTURE.md) a customer never resolves to that invoice's
          // owner_id, so this matched 0 rows EVERY time, silently — no
          // error, nothing caught. The charge itself was real; only the
          // CRM's record of it depended entirely on the Stripe webhook
          // eventually landing. confirmInvoicePayment re-verifies the
          // payment with Stripe itself and writes via the service role
          // (same trust level as the webhook), so the invoice is marked
          // paid even on a deployment whose webhook isn't configured yet.
          const recorded = invId ? confirmInvoicePayment(invId, paymentIntentId).catch((e: any) => {
            console.error("[Payment] confirmInvoicePayment failed:", e?.message);
            toast?.("Payment received, but confirming it with the business is taking longer than usual — it may take a minute to show as paid.", "yellow");
          }) : Promise.resolve();
          recorded.then(() => sendPaymentReceipt({
            customerPhone: cust.phone, customerEmail: cust.email, customerFirstName: cust.firstName, customerId: cust.id,
            amountCents: Math.round((payingInv?.total || 0) * 100), description: `Invoice #${invId || ""}`, invoiceId: invId,
          })).catch((e: any) => console.warn("[PaymentReceipt] failed:", e?.message));
          toast?.("Payment received ✓", "green");
          setPayingInv(null);
        }}
      />
      )}

      <SaveCardModal
        open={showSaveCard}
        onClose={() => setShowSaveCard(false)}
        publishableKey={active?.settings?.stripePublishableKey || ""}
        stripeAccountId={active?.settings?.stripeAccountId}
        ownerId={(cust as any).owner_id}
        email={cust.email}
        name={`${cust.firstName} ${cust.lastName}`}
        existingStripeCustomerId={cust.stripeCustomerId}
        isRecurringClient={!!cust.recurringPayment?.enabled || jobs.some(j => j.customerId === cust.id && j.isRecurring)}
        onSaved={async (stripeCustomerId, paymentMethodId, label, consentAt) => {
          // First card ever saved becomes the default automatically; a
          // second/third card just joins the list (myCards) without
          // disturbing whichever one is already the default — the customer
          // picks explicitly via "Make Default" above.
          const isFirstCard = myCards.length === 0;
          const patch: any = { stripeCustomerId, cardConsentAt: consentAt || cust.cardConsentAt };
          if (isFirstCard) { patch.savedPaymentMethodId = paymentMethodId; patch.savedPaymentMethodLabel = label; }
          setCustomers((prev: Customer[]) => prev.map(c => c.id === cust.id ? { ...c, ...patch } : c));
          patchCust(patch);
          setShowSaveCard(false);
          refreshMyCards();
          // BUG FIX — this used to only update local React state, with no
          // Supabase write at all. The card really did get saved on
          // Stripe's side, but the CRM never durably linked it to this
          // customer's row, so it silently disappeared again on next
          // login/page refresh even though the toast said "Card saved ✓."
          try {
            const { data: sessData } = await supabase.auth.getSession();
            const token = sessData.session?.access_token;
            const res = await fetch("/api/public-data", {
              method: "POST",
              headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
              body: JSON.stringify({ action: "client_save_card_link", stripeCustomerId, paymentMethodId, label, consentAt: patch.cardConsentAt, setAsDefault: isFirstCard }),
            });
            const data = await res.json().catch(() => null);
            if (!res.ok || data?.error) { toast?.("Card saved, but didn't sync — it may not appear next time you log in (" + (data?.error || "sync failed") + ")", "yellow"); return; }
            toast?.("Card saved ✓", "green");
          } catch (e: any) {
            toast?.("Card saved, but didn't sync — it may not appear next time you log in", "yellow");
          }
        }}
      />

      {/* MULTI-BUSINESS — "Connect to another business" from inside an
          already-logged-in portal, same search/request flow as the
          logged-in-but-no-account screen above. */}
      <Modal open={findOpen} onClose={() => setFindOpen(false)} title="Connect to a Business">
        <div className="space-y-3">
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30" />
            <GInput placeholder="Search by business name..." value={findQuery} onChange={(e: any) => searchBusinesses(e.target.value)} className="!text-sm !pl-9" />
          </div>
          {findBusy && <div className="text-center text-xs text-white/30">Searching…</div>}
          {findError && <div className="text-center text-xs text-danger-400">{findError}</div>}
          <div className="space-y-2 max-h-[50vh] overflow-y-auto">
            {findResults.filter(b => !(portalData?.accounts || []).some(a => (a.customer as any).owner_id === b.ownerId)).map(b => {
              const isConnecting = connectingOwnerId === b.ownerId;
              const isConnected = connectedOwnerIds.includes(b.ownerId);
              return (
                <div key={b.ownerId} className="p-3 rounded-xl bg-white/5 border border-white/10 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-sm font-medium truncate">{b.companyName}</div>
                    {b.companyPhone && <div className="text-[11px] text-white/40">{b.companyPhone}</div>}
                  </div>
                  {isConnected ? (
                    <Badge tone="green">Requested</Badge>
                  ) : (
                    <GBtn disabled={isConnecting} onClick={() => requestConnect(b.ownerId)} className="!text-xs !py-1.5 flex-shrink-0">
                      {isConnecting ? "Sending…" : <><Plus size={12} className="inline mr-1" />Connect</>}
                    </GBtn>
                  )}
                </div>
              );
            })}
            {!findBusy && !findError && findQuery.trim().length >= 2 && findResults.length === 0 && (
              <div className="text-center text-xs text-white/30 py-4">No businesses found matching "{findQuery}"</div>
            )}
          </div>
        </div>
      </Modal>
    </div>
  );
}

// FEATURE — "if a customer hasn't left a review yet, prompt them in the
// portal." Shows once the customer has at least one completed job and no
// reviewSubmittedAt on file (see migration 0094 + public-data.ts's
// submit_review action, which stamps this on real submission). Dismissible
// for a week at a time (localStorage, per-customer) rather than nagging on
// every single visit — reappears automatically if still unreviewed.
function ReviewNudgeBanner({ cust, completedJobsCount, settings }: { cust: any; completedJobsCount: number; settings?: any }) {
  const dismissKey = `crm.reviewNudgeDismissed.${cust?.id || "x"}`;
  const [dismissed, setDismissed] = useState(() => {
    try {
      const until = Number(localStorage.getItem(dismissKey) || 0);
      return until > Date.now();
    } catch { return false; }
  });
  if (dismissed || !cust?.id || completedJobsCount === 0 || cust.reviewSubmittedAt) return null;
  const gm = Math.min(5, Math.max(1, Number(settings?.reviewGoogleMinStars) || 4));
  const rateLink = `${window.location.origin}${window.location.pathname}#/rate?c=${encodeURIComponent(cust.id)}&n=${encodeURIComponent(cust.firstName || "")}&g=${encodeURIComponent(settings?.googlePlaceId || "")}&rl=${encodeURIComponent(settings?.googleReviewLink || "")}&co=${encodeURIComponent(settings?.companyName || "CRM Starter")}&gm=${gm}`;
  const dismiss = () => {
    try { localStorage.setItem(dismissKey, String(Date.now() + 7 * 86400000)); } catch {}
    setDismissed(true);
  };
  return (
    <Glass className="p-3.5 flex items-center justify-between gap-3 !bg-yellow-950/15 !border-yellow-700/30">
      <div className="flex items-center gap-2.5 min-w-0">
        <Gift size={16} className="text-yellow-400 flex-shrink-0" />
        <div className="min-w-0">
          <div className="text-sm font-semibold text-white truncate">Enjoying our service?</div>
          <div className="text-[11px] text-white/50">Leave us a quick review — it takes 10 seconds.</div>
        </div>
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        <a href={rateLink} className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-yellow-700/30 border border-yellow-600/40 text-yellow-200 hover:bg-yellow-700/40 transition">Leave a review</a>
        <button onClick={dismiss} className="text-xs text-white/30 hover:text-white/60 px-1">Later</button>
      </div>
    </Glass>
  );
}
