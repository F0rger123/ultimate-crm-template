import React, { useState } from "react";
import { Star, CheckCircle } from "lucide-react";

// Public-facing customer review page — no auth required.
// URL: #/rate?c=CUSTOMER_ID&n=CUSTOMER_FIRST_NAME&g=GOOGLE_PLACE_ID&rl=GOOGLE_REVIEW_LINK&co=COMPANY_NAME
// 4–5 stars → offers a Google Maps review link, if one is configured.
// 1–3 stars → private feedback form saved to Supabase reviews table.
//
// MULTI-TENANT (Phase D) — was a direct anon-key `.from("reviews").insert(...)`.
// Once RLS is owner_id-scoped (0033_multitenant_owner_scoping.sql), an
// anonymous visitor has no session for current_owner_id() to resolve, so a
// client-side insert has no owner_id to satisfy WITH CHECK. Routed through
// /api/public-data's "submit_review" action instead (service role, resolves
// owner_id server-side from the customerId already in the review link).

function hashParam(key: string): string {
  const hash = window.location.hash;
  const q = hash.includes("?") ? hash.slice(hash.indexOf("?") + 1) : "";
  return new URLSearchParams(q).get(key) || "";
}

// `overrides` lets the owner's in-app "Client Demo" modal (App.tsx) mount
// this same public page inline without touching window.location.hash (which
// would blow away the CRM's own hash-routed page underneath it) — falls
// back to reading the real #/rate query params when not supplied.
// `embedded` — used only by the CRM's in-app "Client Demo" preview, which
// wants this floating over a blurred, dimmed CRM background (matching every
// other demo popup) instead of this page's own normal full-screen solid
// black — the outer demo overlay already supplies the blur/dim, so this just
// stops fighting it with its own opaque min-h-screen background.
export function CustomerReviewPage({ overrides, embedded = false }: { overrides?: Partial<Record<"c" | "n" | "g" | "rl" | "co" | "gm", string>>; embedded?: boolean } = {}) {
  const param = (key: "c" | "n" | "g" | "rl" | "co" | "gm") => overrides?.[key] ?? hashParam(key);
  const customerId = param("c");
  const firstName = decodeURIComponent(param("n") || "there");
  const googlePlaceId = param("g");
  const companyName = decodeURIComponent(param("co") || "CRM Starter");
  // FEATURE — "ask the owner what star threshold sends to Google." Was
  // hardcoded at 1-3 → private feedback, 4-5 → Google, with no way for an
  // owner to tighten that to only 5-star reviews going public. Defaults to
  // 4 (unchanged behavior) when not present in the link — see the settings
  // toggle in SettingsModal.tsx (reviewGoogleMinStars) and the &gm= param
  // added everywhere this page's link gets built.
  const googleMinStars = Math.min(5, Math.max(1, Number(param("gm")) || 4));
  // FIX 13 — this used to fall back to a hardcoded
  // "g.page/r/your-business/review" link whenever no Place ID was
  // set, which sent every OTHER deployment's customers to a specific
  // different business's review page. A directly pasted review link (see
  // Settings → Company → "Google Maps Review Link") is now preferred; the
  // Place-ID-constructed URL is a fallback for anyone who already set that
  // instead; if genuinely neither is configured, there's no Google link to
  // offer at all — better than sending customers somewhere wrong.
  const googleReviewLink = decodeURIComponent(param("rl") || "");
  const googleUrl = googleReviewLink || (googlePlaceId ? `https://search.google.com/local/writereview?placeid=${googlePlaceId}` : "");

  const [step, setStep] = useState<"rate" | "happy" | "unhappy" | "done">("rate");
  const [rating, setRating] = useState(0);
  const [hover, setHover] = useState(0);
  const [feedback, setFeedback] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // BUG FIX — "I left a review and it didn't show in the owner CRM." This
  // never surfaced a failure anywhere — a bad/missing customerId (no
  // review recorded at all, just a 400 from public-data.ts) or a dropped
  // network request both silently showed the same friendly "Thank you!"
  // to whoever left the review, with the owner having zero way to know a
  // submission never actually landed. Now retries once on a genuine
  // network failure and logs loudly enough (with the exact reason) that a
  // real gap doesn't stay silently invisible — the friendly UI stays as-is
  // either way, since a customer shouldn't see a scary error, but this at
  // least gives a diagnosable trail for exactly this report.
  const saveToSupabase = async (r: number, text: string, _status: "pending" | "private"): Promise<boolean> => {
    if (!customerId) {
      console.error("[CustomerReview] submit_review skipped — no customerId in this link's URL (was #/rate opened without a real ?c= param?)");
      return false;
    }
    const attempt = async () => {
      const res = await fetch("/api/public-data", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "submit_review", customerId, rating: r, comment: text || undefined }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || data?.error) throw new Error(data?.error || `HTTP ${res.status}`);
      return true;
    };
    try {
      return await attempt();
    } catch (e: any) {
      console.warn("[CustomerReview] submit_review failed, retrying once:", e?.message);
      try {
        return await attempt();
      } catch (e2: any) {
        console.error("[CustomerReview] submit_review failed after retry — review was NOT saved:", e2?.message);
        return false;
      }
    }
  };

  const pick = (r: number) => {
    setRating(r);
    setTimeout(() => setStep(r >= googleMinStars ? "happy" : "unhappy"), 300);
  };

  // FEATURE — "ask what went wrong AND what prompted it." A single free-text
  // box asked one implicit question; this asks two explicit ones so the
  // owner gets more actionable private feedback, still saved as one comment.
  const [feedbackPrompt, setFeedbackPrompt] = useState("");
  const submitFeedback = async () => {
    if (!feedback.trim()) return;
    setSubmitting(true);
    const combined = feedbackPrompt.trim()
      ? `What went wrong: ${feedback.trim()}\n\nWhat prompted it: ${feedbackPrompt.trim()}`
      : feedback.trim();
    await saveToSupabase(rating, combined, "private");
    setSubmitting(false);
    setStep("done");
  };

  const stars = (n: number) => Array.from({ length: 5 }, (_, i) => (
    <Star
      key={i}
      size={n}
      className={"transition-colors " + (i < (hover || rating) ? "text-yellow-400 fill-yellow-400" : "text-white/20")}
    />
  ));

  return (
    <div className={embedded ? "text-white flex flex-col items-center justify-center px-4 py-8" : "min-h-screen bg-black text-white flex flex-col items-center justify-center px-4 py-8"}>
      {/* Brand header */}
      <div className="w-full max-w-sm">
        <div className="bg-brand-600 rounded-2xl p-6 text-center mb-6 shadow-2xl shadow-brand-900/40 text-brand-fg">
          <div className="w-16 h-16 rounded-full bg-white/10 border-2 border-white/30 flex items-center justify-center mx-auto mb-3">
            <span className="text-3xl">🚿</span>
          </div>
          <div className="font-black text-xl text-brand-fg">{companyName}</div>
          <div className="text-brand-fg/60 text-xs mt-1">your area</div>
        </div>

        <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
          {step === "rate" && (
            <div className="text-center space-y-6">
              <div>
                <div className="text-2xl font-bold">Hi {firstName}! 👋</div>
                <div className="text-white/60 mt-2">How was your recent service?</div>
              </div>
              <div className="flex justify-center gap-2 py-2"
                onMouseLeave={() => setHover(0)}>
                {[1,2,3,4,5].map(s => (
                  <button
                    key={s}
                    onMouseEnter={() => setHover(s)}
                    onTouchStart={() => setHover(s)}
                    onClick={() => pick(s)}
                    className="transition-all hover:scale-125 active:scale-95"
                  >
                    <Star
                      size={48}
                      className={"transition-colors " + (s <= (hover || rating) ? "text-yellow-400 fill-yellow-400" : "text-white/20")}
                    />
                  </button>
                ))}
              </div>
              <div className="text-sm text-white/40">
                {hover === 1 ? "Terrible" : hover === 2 ? "Poor" : hover === 3 ? "Okay" : hover === 4 ? "Good" : hover === 5 ? "Excellent! 🌟" : "Tap a star to rate"}
              </div>
            </div>
          )}

          {step === "happy" && (
            <div className="text-center space-y-5">
              <div className="text-5xl">🎉</div>
              <div>
                <div className="text-xl font-bold text-yellow-400">Awesome — thank you!</div>
                <div className="text-white/60 text-sm mt-1">
                  {googleUrl ? `Your ${rating}-star experience means the world to us. Would you share it on Google? It helps other homeowners find us.` : `Your ${rating}-star experience means the world to us — thank you for taking the time!`}
                </div>
              </div>
              <div className="flex justify-center gap-1">{stars(22)}</div>
              {googleUrl && (
                <a
                  href={googleUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => { saveToSupabase(rating, "", "pending"); setTimeout(() => setStep("done"), 600); }}
                  className="flex items-center justify-center gap-2 w-full py-4 bg-white text-gray-900 font-bold rounded-xl hover:bg-gray-100 transition text-base"
                >
                  <img src="https://www.google.com/images/branding/googleg/1x/googleg_standard_color_128dp.png" alt="G" className="w-5 h-5" />
                  Leave a Google Review
                </a>
              )}
              <button
                onClick={() => { saveToSupabase(rating, googleUrl ? "declined-google" : "", "pending"); setStep("done"); }}
                className="text-xs text-white/30 hover:text-white/60 transition"
              >
                {googleUrl ? "Maybe later" : "Done"}
              </button>
            </div>
          )}

          {step === "unhappy" && (
            <div className="space-y-5">
              <div className="text-center">
                <div className="text-4xl">😔</div>
                <div className="text-xl font-bold mt-2">We're sorry to hear that</div>
                <div className="text-white/60 text-sm mt-1">Please tell us what went wrong — we want to make it right.</div>
              </div>
              <div className="flex justify-center gap-1">{stars(20)}</div>
              <div>
                <label className="text-xs text-white/50 mb-1.5 block uppercase tracking-wider">What went wrong? (private — only we see this)</label>
                <textarea
                  value={feedback}
                  onChange={e => setFeedback(e.target.value)}
                  rows={3}
                  placeholder="What could we have done better?"
                  className="w-full bg-white/5 border border-white/15 rounded-xl px-3 py-2.5 text-sm text-white placeholder-white/25 resize-none focus:outline-none focus:border-brand-500/50"
                />
              </div>
              <div>
                <label className="text-xs text-white/50 mb-1.5 block uppercase tracking-wider">What prompted this? <span className="normal-case text-white/30">(optional)</span></label>
                <textarea
                  value={feedbackPrompt}
                  onChange={e => setFeedbackPrompt(e.target.value)}
                  rows={2}
                  placeholder="e.g. missed spots, late arrival, damage..."
                  className="w-full bg-white/5 border border-white/15 rounded-xl px-3 py-2.5 text-sm text-white placeholder-white/25 resize-none focus:outline-none focus:border-brand-500/50"
                />
              </div>
              <button
                onClick={submitFeedback}
                disabled={!feedback.trim() || submitting}
                className="w-full py-3.5 bg-brand-600 border border-brand-600/50 text-brand-fg font-bold rounded-xl transition disabled:opacity-40"
              >
                {submitting ? "Sending…" : "Send Private Feedback"}
              </button>
              <button onClick={() => setStep("rate")} className="text-xs text-white/30 hover:text-white/60 w-full text-center transition">← Change my rating</button>
            </div>
          )}

          {step === "done" && (
            <div className="text-center py-4 space-y-4">
              <CheckCircle size={52} className="mx-auto text-green-400" />
              <div className="text-xl font-bold">{rating >= googleMinStars ? "Thank you! ⭐" : "We appreciate your honesty"}</div>
              <div className="text-white/60 text-sm">
                {rating >= googleMinStars
                  ? "Your review helps homeowners in York find great service."
                  : "We'll be in touch to make this right. We really do care."}
              </div>
              <div className="pt-2 text-xs text-white/30">— {companyName}</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
