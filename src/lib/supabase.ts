import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;
if (!supabaseUrl || !supabaseAnonKey) {
  console.error("[Config] VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY are not set — copy .env.example to .env and fill them in (see README.md).");
}

// [GoogleConnect] — after four rounds of trying to make the React-side
// onAuthStateChange/applyGoogleIdentity flow the single source of truth (a
// closure flag, then checking `prev` inside the setState updater, then
// guarding the app_settings sync merges) and STILL seeing a second SIGNED_IN
// event with no provider_token win the race in real testing, this abandons
// that entirely. React state, onAuthStateChange, and resolveUserRole() all
// sit behind at least one await — and this codebase's own extensive comments
// elsewhere document Supabase auth calls (getSession, onAuthStateChange
// handlers awaiting a Postgrest role lookup) hanging or resolving out of
// order under real-world navigator-lock/network conditions. Any fix that
// depends on "whichever event's async chain finishes first" is fragile by
// construction, no matter how carefully the merge logic is written.
// localStorage, read/written synchronously with no await anywhere in the
// path, has no such race to lose. This block is the ENTIRE mechanism now:
// it runs at module load, before React mounts and before createClient()
// below even exists to kick off its own async detectSessionInUrl hash
// parsing — nothing else needs to run first, and nothing async can beat it.
const GOOGLE_TOKEN_KEY = "crm_google_provider_token";
const GOOGLE_REFRESH_KEY = "crm_google_refresh_token";
const GOOGLE_EMAIL_KEY = "crm_google_email";
const GOOGLE_EXPIRES_KEY = "crm_google_token_expires_at";

// Google's OAuth access_token Supabase hands back is a plain JWT with the
// user's email in its payload — decoding it is a pure base64 string op, not
// a network call, so we can learn the email with zero dependency on a
// session ever being established.
function decodeEmailFromJwt(jwt: string): string {
  try {
    const payload = jwt.split(".")[1];
    const json = JSON.parse(decodeURIComponent(escape(atob(payload.replace(/-/g, "+").replace(/_/g, "/")))));
    return json.email || json.user_metadata?.email || "";
  } catch {
    return "";
  }
}

// Captured here (before `supabase` even exists) and pushed to the cloud
// further down, once the client is constructed — see the block right after
// createClient() below.
let _bridgeCapturedToken: string | null = null;
let _bridgeCapturedRefreshToken: string | null = null;
let _bridgeCapturedEmail: string | null = null;
let _bridgeCapturedExpiresAt = 0;

if (typeof window !== "undefined" && window.location.hash.includes("provider_token")) {
  try {
    // BUG FIX (Google accounts mixed up) — this bridge used to treat EVERY
    // completed Google OAuth as the OWNER's, unconditionally writing it into
    // these `crm_google_*` keys (the "authoritative" source getStoredGoogleConnection()
    // hands to sendOwnerGmailOnly/sendEmail/GoogleWorkspacePage) and pushing it
    // to the shared app_settings row below. But FOUR call sites in this app
    // trigger a Google OAuth redirect through this exact same callback:
    // the owner's login/reconnect (App.tsx, GoogleWorkspacePage.tsx,
    // SettingsModal.tsx — correctly meant for this shared slot) AND an
    // EMPLOYEE linking their own separate Google account for their own
    // Gmail/Calendar from inside the portal (EmployeePortal.tsx's
    // handleConnectGoogle/handleEmployeeGoogleLogin, meant for the PER-
    // EMPLOYEE employees.google_token column via App.tsx's
    // persistEmployeeGoogleToken instead). Nothing distinguished them, so an
    // employee connecting their own Google account silently overwrote the
    // owner's shared connection — every subsequent "owner" send (invoices,
    // job assignments, the daily briefing) went out from the EMPLOYEE's
    // Gmail, and GoogleWorkspacePage's Calendar/Tasks/Contacts started
    // reading the employee's data instead of the business's. Both employee
    // OAuth entry points now call setOAuthIntent("employee") right before
    // redirecting (a plain sessionStorage flag, since this bridge runs at
    // module load, before React/any async role lookup exists) — reading
    // (not consuming — App.tsx's resolveUserRole still needs to consume it
    // separately) that same flag here is what lets this bridge tell the two
    // apart and skip the owner-facing writes for an employee's own connect.
    const isEmployeeGoogleOAuth = sessionStorage.getItem("crm.oauthIntent") === "employee";
    const params = new URLSearchParams(window.location.hash.substring(1));
    const providerToken = params.get("provider_token");
    const providerRefreshToken = params.get("provider_refresh_token");
    const accessToken = params.get("access_token");
    if (providerToken) {
      // Still bridged to sessionStorage unconditionally — App.tsx's
      // persistEmployeeGoogleToken (the CORRECT per-employee destination)
      // reads it from here regardless of which flow this was.
      sessionStorage.setItem("crm.gpt", providerToken);
      if (!isEmployeeGoogleOAuth) {
        localStorage.setItem(GOOGLE_TOKEN_KEY, providerToken);
        _bridgeCapturedToken = providerToken;
        _bridgeCapturedExpiresAt = Date.now() + 55 * 60 * 1000;
        localStorage.setItem(GOOGLE_EXPIRES_KEY, String(_bridgeCapturedExpiresAt));
      }
    }
    if (providerRefreshToken) {
      sessionStorage.setItem("crm.grt", providerRefreshToken);
      if (!isEmployeeGoogleOAuth) {
        localStorage.setItem(GOOGLE_REFRESH_KEY, providerRefreshToken);
        _bridgeCapturedRefreshToken = providerRefreshToken;
      }
    }
    if (accessToken && !isEmployeeGoogleOAuth) {
      const email = decodeEmailFromJwt(accessToken);
      if (email) {
        localStorage.setItem(GOOGLE_EMAIL_KEY, email);
        _bridgeCapturedEmail = email;
      }
    }
    console.log("[GoogleConnect] localStorage bridge (pre-React) — provider_token saved:", !!providerToken, "· refresh_token saved:", !!providerRefreshToken, "· email:", localStorage.getItem(GOOGLE_EMAIL_KEY) || "(not decoded)", "· employee-own-connect (owner slot skipped):", isEmployeeGoogleOAuth);
  } catch (e: any) {
    console.warn("[GoogleConnect] localStorage bridge failed:", e?.message);
  }
}

// Authoritative read for "is Google connected" — Settings and any send-time
// code should call this instead of trusting settings.googleConnected/React
// state. Plain synchronous localStorage reads, nothing to race.
export function getStoredGoogleConnection(): { token: string; refreshToken: string; email: string; expiresAt: number } | null {
  try {
    const token = localStorage.getItem(GOOGLE_TOKEN_KEY) || "";
    if (!token) return null;
    return {
      token,
      refreshToken: localStorage.getItem(GOOGLE_REFRESH_KEY) || "",
      email: localStorage.getItem(GOOGLE_EMAIL_KEY) || "",
      expiresAt: Number(localStorage.getItem(GOOGLE_EXPIRES_KEY)) || 0,
    };
  } catch {
    return null;
  }
}

export function setStoredGoogleToken(token: string, expiresAt: number, email?: string): void {
  try {
    localStorage.setItem(GOOGLE_TOKEN_KEY, token);
    localStorage.setItem(GOOGLE_EXPIRES_KEY, String(expiresAt));
    if (email) localStorage.setItem(GOOGLE_EMAIL_KEY, email);
    console.log("[GoogleConnect] setStoredGoogleToken — refreshed token saved to localStorage");
  } catch (e: any) {
    console.warn("[GoogleConnect] setStoredGoogleToken failed:", e?.message);
  }
  // CROSS-DEVICE — localStorage only ever lives in the one browser that ran
  // the OAuth flow (or last refreshed a token). An employee's own phone/
  // laptop has no entry here at all, and even the owner's OTHER devices never
  // see a token refreshed on this one. Every refresh (proactive or reactive,
  // see sendViaGmail) funnels through this single function, so push it up to
  // the shared app_settings row too — fire-and-forget, never blocks the send
  // that triggered it.
  persistGoogleTokenToCloud(token, expiresAt, email).catch(() => {});
}

// Only the owner clicking "Disconnect Google Account" should ever call this.
export function clearStoredGoogleConnection(): void {
  try {
    localStorage.removeItem(GOOGLE_TOKEN_KEY);
    localStorage.removeItem(GOOGLE_REFRESH_KEY);
    localStorage.removeItem(GOOGLE_EMAIL_KEY);
    localStorage.removeItem(GOOGLE_EXPIRES_KEY);
    console.log("[GoogleConnect] clearStoredGoogleConnection — all google localStorage keys cleared");
  } catch (e: any) {
    console.warn("[GoogleConnect] clearStoredGoogleConnection failed:", e?.message);
  }
}

// CROSS-DEVICE — the authoritative fallback for any device that has no
// localStorage entry of its own (an employee's phone that never ran the
// owner's OAuth flow, or a browser where it simply expired/was cleared).
// app_settings already mirrors the owner's entire settings blob for exactly
// this reason (Twilio/Stripe keys sync the same way) — this is single-tenant
// per deployment (see docs/ARCHITECTURE.md), so there's exactly one row and no owner_id
// filter is needed, matching the existing public-page/portal settings
// fallback in App.tsx.
export async function fetchOwnerGoogleToken(): Promise<{ token: string; refreshToken: string; email: string; expiresAt: number } | null> {
  try {
    const { data, error } = await (supabase as any).from("app_settings").select("data").limit(1).maybeSingle();
    if (error || !data?.data) return null;
    const d = data.data as any;
    if (!d.googleProviderToken) return null;
    return {
      token: d.googleProviderToken,
      refreshToken: d.googleRefreshToken || "",
      email: d.googleEmail || "",
      expiresAt: d.googleTokenExpiresAt || 0,
    };
  } catch (e: any) {
    console.warn("[GoogleConnect] fetchOwnerGoogleToken failed:", e?.message);
    return null;
  }
}

// Merge a freshly captured/refreshed token into the shared app_settings row
// (read-modify-write so Twilio/Stripe/branding fields already on that row
// aren't clobbered). Silently no-ops if the row doesn't exist yet (e.g. the
// very first Google connect, before the owner has ever saved settings once —
// App.tsx's own settings-sync effect will create the row shortly after via
// applyGoogleIdentity, so this isn't the only path that persists it).
export async function persistGoogleTokenToCloud(token: string, expiresAt: number, email?: string, refreshToken?: string): Promise<void> {
  try {
    const { data, error } = await (supabase as any).from("app_settings").select("owner_id, data").limit(1).maybeSingle();
    if (error || !data?.owner_id) {
      console.warn("[GoogleConnect] persistGoogleTokenToCloud — no app_settings row to merge into yet, skipping");
      return;
    }
    const merged = {
      ...(data.data || {}),
      googleConnected: true,
      googleProviderToken: token,
      googleTokenExpiresAt: expiresAt,
      ...(email ? { googleEmail: email } : {}),
      ...(refreshToken ? { googleRefreshToken: refreshToken } : {}),
    };
    const { error: upsertError } = await (supabase as any)
      .from("app_settings")
      .upsert({ owner_id: data.owner_id, data: merged, updated_at: new Date().toISOString() }, { onConflict: "owner_id" });
    if (upsertError) throw upsertError;
    console.log("[GoogleConnect] persistGoogleTokenToCloud — token pushed to Supabase, now readable from any device");
  } catch (e: any) {
    console.warn("[GoogleConnect] persistGoogleTokenToCloud failed:", e?.message);
  }
}

// Placeholder fallback keeps the app booting (createClient throws on an empty
// URL) so the console error above is what a misconfigured deploy shows.
export const supabase = createClient(supabaseUrl || "https://missing-config.supabase.co", supabaseAnonKey || "missing-anon-key", {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
    // supabase-js v2 serializes token-refresh (and, transitively, some
    // request paths) behind the browser's Web Locks API so multiple tabs of
    // this same origin don't race refreshing the same stored session. If a
    // tab holding that lock gets backgrounded/frozen or reloaded mid-refresh
    // (routine here — testing usually has the owner CRM and employee portal
    // open in separate tabs of the same browser at once), every OTHER tab's
    // next authenticated call can queue behind a lock that never releases —
    // a genuine, no-error, no-console-log hang, which is exactly the
    // unexplained "Save job timed out" symptom (a real 15s wait with no
    // PostgREST response at all, not a fast rejected column error). This
    // project's own auth comments already flagged Supabase calls "hanging...
    // under real-world navigator-lock/network conditions" as a known issue
    // (see the note above this client's construction). Single-owner app, no
    // multi-tenant session isolation to protect — a plain passthrough (skip
    // the mutex, just run the callback) trades theoretical cross-tab
    // refresh-race safety for never deadlocking on it, which is the better
    // trade here.
    lock: async (_name: string, _acquireTimeout: number, fn: () => Promise<any>) => fn(),
  },
});

// Push the token captured by the pre-React bridge above straight to the
// shared app_settings row too, the moment `supabase` exists — the very first
// connection shouldn't have to wait for React to mount, run
// applyGoogleIdentity, and clear its 1500ms settings-save debounce before
// another device can see it.
if (typeof window !== "undefined" && _bridgeCapturedToken) {
  persistGoogleTokenToCloud(_bridgeCapturedToken, _bridgeCapturedExpiresAt, _bridgeCapturedEmail || undefined, _bridgeCapturedRefreshToken || undefined).catch(() => {});
}

// BUG FIX — "I signed out of the employee portal, clicked an invoice link,
// and it logged me straight back in." supabase.auth.signOut() only deletes
// the stored session AFTER its network call succeeds; when that call fails
// or our withTimeout gives up on it, the session stays in localStorage and
// the next page load restores it. Call this after every sign-out attempt so
// signing out on this device always actually signs out.
export async function clearLocalAuthSession() {
  // Drop the in-memory session too (and fire SIGNED_OUT) — otherwise the
  // client keeps it and its auto-refresh writes it straight back to storage.
  try { await (supabase.auth as any)._removeSession?.(); } catch { /* fall through to the storage sweep */ }
  try {
    const keys: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && /^sb-.*-auth-token(-code-verifier)?$/.test(k)) keys.push(k);
    }
    keys.forEach(k => localStorage.removeItem(k));
  } catch { /* storage blocked — nothing stored to clear */ }
}

// Public pages a customer opens from a link (quote/invoice, client portal,
// reviews, referral, lead/job forms, legal). Whoever else is signed in on
// this device (an employee, the owner) must never be redirected off these.
export function isPublicCustomerHash(hash: string = typeof window !== "undefined" ? window.location.hash : ""): boolean {
  const h = hash.replace(/^#\/?/, "").split("?")[0];
  return h === "client" || h.startsWith("client/") || h.startsWith("estimate/") || h === "referral" || h.startsWith("r/")
    || h === "rate" || h === "lead-form" || h === "trash-cans" || h === "apply" || h === "terms" || h === "privacy";
}
