import { useState, useEffect } from "react";
import { Lock, CheckCircle, AlertCircle, Eye, EyeOff } from "lucide-react";
import { supabase } from "../../lib/supabase";
import { Glass } from "../ui/Glass";
import { GBtn } from "../ui/GBtn";
import { GInput } from "../ui/GInput";

export function ResetPassword() {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [sessionReady, setSessionReady] = useState(false);

  // FIX 19 — Supabase's client is created with detectSessionInUrl: true
  // (lib/supabase.ts), which ALREADY parses the recovery access_token/
  // refresh_token out of the URL and establishes the session automatically
  // (and clears the tokens from the URL once done). Manually re-parsing and
  // calling setSession() here raced against that: depending on timing, the
  // tokens could already be consumed/stripped by the time this ran, which is
  // exactly why this sometimes showed "No valid recovery session" and
  // sometimes didn't. Instead, listen for Supabase's own PASSWORD_RECOVERY
  // auth event — fired precisely when it finishes processing a recovery
  // link — plus a synchronous getSession() check in case that event already
  // fired before this listener attached (e.g. a fast reload).
  useEffect(() => {
    let settled = false;
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY" && session) {
        settled = true;
        setSessionReady(true);
      }
    });
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (settled) return;
      if (session) { setSessionReady(true); return; }
      // Give detectSessionInUrl a brief window to finish processing the
      // fragment (it's async) before concluding there's truly no session.
      setTimeout(() => {
        if (settled) return;
        supabase.auth.getSession().then(({ data: { session: retry } }) => {
          if (retry) setSessionReady(true);
          else setError("No valid recovery session. Please use the link from your email.");
        });
      }, 1500);
    });
    return () => subscription.unsubscribe();
  }, []);

  const handleSubmit = async () => {
    setError("");
    if (password.length < 6) { setError("Password must be at least 6 characters."); return; }
    if (password !== confirm) { setError("Passwords do not match."); return; }

    setLoading(true);
    const { error: err } = await supabase.auth.updateUser({ password });
    setLoading(false);

    if (err) {
      setError(err.message);
      return;
    }

    setSuccess(true);
    // This route is shared by owner/employee/client password resets — send a
    // client back to the client portal instead of the employee portal by
    // checking whether their email matches a customer record.
    // BUG FIX (security audit finding) — this used to query `customers`
    // directly with the anon key, but that table's only RLS policy is
    // owner-scoped (owner_id = current_owner_id()), which never resolves
    // for a customer's own session (customers aren't in the `employees`
    // table current_owner_id relies on) — the query always returned 0 rows
    // under RLS, so every genuine customer silently got routed to /portal
    // instead of /client. Now calls a narrow SECURITY DEFINER RPC
    // (is_registered_customer_email, migration 0093) that checks the
    // session's own verified JWT email against `customers` server-side.
    let destination = "/portal";
    try {
      const { data } = await supabase.rpc("is_registered_customer_email" as any);
      if (data === true) destination = "/client";
    } catch { /* customer lookup best-effort — default to /portal */ }
    await supabase.auth.signOut();
    setTimeout(() => { window.location.hash = destination; }, 2500);
  };

  return (
    <div className="min-h-screen bg-black flex items-center justify-center p-4">
      <div className="w-full max-w-sm space-y-6">
        {/* Logo */}
        <div className="text-center">
          <div className="w-14 h-14 rounded-2xl bg-brand-600 flex items-center justify-center mx-auto mb-3 text-brand-fg">
            <Lock size={24} className="text-brand-fg" />
          </div>
          <div className="text-xl font-bold text-white">Reset Password</div>
          <div className="text-sm text-white/50 mt-1">Enter your new password below</div>
        </div>

        <Glass className="p-6 space-y-4">
          {success ? (
            <div className="text-center space-y-3 py-2">
              <CheckCircle size={36} className="text-green-400 mx-auto" />
              <div className="text-green-300 font-semibold">Password updated!</div>
              <div className="text-sm text-white/50">Redirecting to login…</div>
            </div>
          ) : (
            <>
              {error && (
                <div className="flex items-start gap-2 p-3 rounded-xl bg-brand-950/40 border border-brand-700/40 text-brand-300 text-sm">
                  <AlertCircle size={15} className="flex-shrink-0 mt-0.5" />
                  {error}
                </div>
              )}

              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <label className="text-xs text-white/50 font-medium">New Password</label>
                  <button type="button" onClick={() => setShowPassword(s => !s)} className="text-xs font-medium text-white/60 hover:text-white underline-offset-2 hover:underline">{showPassword ? "Hide" : "Show"}</button>
                </div>
                <div className="relative">
                  <GInput
                    type={showPassword ? "text" : "password"}
                    placeholder="At least 6 characters"
                    value={password}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setPassword(e.target.value)}
                    onKeyDown={(e: React.KeyboardEvent) => e.key === "Enter" && handleSubmit()}
                    disabled={loading || !sessionReady}
                    className="!pr-11"
                    autoFocus
                  />
                  <button type="button" onClick={() => setShowPassword(s => !s)} aria-label={showPassword ? "Hide password" : "Show password"}
                    className="absolute right-1 top-1/2 -translate-y-1/2 w-9 h-9 flex items-center justify-center text-white/40 hover:text-white/80">
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs text-white/50 font-medium">Confirm Password</label>
                <GInput
                  type={showPassword ? "text" : "password"}
                  placeholder="Repeat new password"
                  value={confirm}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setConfirm(e.target.value)}
                  onKeyDown={(e: React.KeyboardEvent) => e.key === "Enter" && handleSubmit()}
                  disabled={loading || !sessionReady}
                />
              </div>

              <GBtn
                onClick={handleSubmit}
                disabled={loading || !sessionReady || !password || !confirm}
                className="w-full justify-center py-2.5"
              >
                {loading ? "Updating…" : "Update Password"}
              </GBtn>
            </>
          )}
        </Glass>
      </div>
    </div>
  );
}
