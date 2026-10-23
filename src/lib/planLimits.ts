// FEATURE — "make it so people can create a free account but its very
// limited and whenever they (or any base account) hits their plan limit
// (customer limit, etc) it prompts them to upgrade to a higher tier."
//
// SAFETY — an account with NO platform_subscriptions row at all (every
// account created before the billing system existed — confirmed live via
// direct DB query, this production account included) is treated as
// grandfathered/unlimited, never as "free tier, limited." Only an account
// that actually went through billing and then lapsed (trial ran out with
// no upgrade, or a real subscription went past_due/canceled) drops to the
// limited free tier. Getting this backwards would silently lock out every
// pre-existing account the moment this shipped — this is the one line
// standing between that and a real production incident, so it stays this
// explicit rather than a one-line `!sub` fallthrough further down.
export type PlatformSubscription = {
  status: "trialing" | "active" | "past_due" | "canceled" | string;
  plan: string | null;
  trial_ends_at: string | null;
} | null;

export type PlanTier = "unlimited" | "trialing" | "free" | "solo" | "crew" | "growth";

export type PlanLimits = {
  tier: PlanTier;
  // null = no limit (customers always has a limit now — see CUSTOMER_LIMIT).
  customers: number | null;
  employeeSeats: number | null;
};

// Every account (every plan, trials and grandfathered accounts included) can
// hold at most CUSTOMER_LIMIT customers for now. Owner decision 2026-10-23:
// 5,000 to start, to be revisited later (it may move to 1,000 or differ by
// plan). The lapsed Free tier keeps its own smaller limit.
export const CUSTOMER_LIMIT = 5000;
const FREE_LIMITS = { customers: 15, employeeSeats: 1 };
const UNLIMITED = { customers: CUSTOMER_LIMIT, employeeSeats: null };
const SOLO_LIMITS = { customers: CUSTOMER_LIMIT, employeeSeats: 1 };

export const getPlanLimits = (sub: PlatformSubscription): PlanLimits => {
  if (!sub) return { tier: "unlimited", ...UNLIMITED };
  if (sub.status === "active") {
    const plan = (sub.plan || "").toLowerCase();
    if (plan === "solo") return { tier: "solo", ...SOLO_LIMITS };
    if (plan === "crew" || plan === "growth") return { tier: plan as PlanTier, ...UNLIMITED };
    return { tier: "unlimited", ...UNLIMITED }; // active but unrecognized plan string — fail open, not closed
  }
  if (sub.status === "trialing") {
    const trialEnd = sub.trial_ends_at ? new Date(sub.trial_ends_at).getTime() : 0;
    if (!trialEnd || Date.now() < trialEnd) return { tier: "trialing", ...UNLIMITED };
    return { tier: "free", ...FREE_LIMITS }; // trial expired, never upgraded
  }
  // past_due / canceled — a real lapsed paid account.
  return { tier: "free", ...FREE_LIMITS };
};

export const PLAN_TIER_LABEL: Record<PlanTier, string> = {
  unlimited: "your current plan",
  trialing: "your free trial",
  free: "the Free plan",
  solo: "the Solo plan",
  crew: "the Crew plan",
  growth: "the Growth plan",
};

// FEATURE — audit finding (critical): the three PLANS tiers on the pricing
// page (LandingPage.tsx) advertise campaign blasts as
// Growth-only, but nothing in the app ever checked that — every account
// got every feature regardless of which tier they paid for. This is the
// feature-level counterpart to the customer/seat-count limits above
// (those were already enforced; named features were not).
// `unlimited`/`trialing` stay full-access by the same grandfathering
// logic getPlanLimits() already applies; `free` (lapsed trial or lapsed
// subscription) is the most restricted, same as its customer/seat caps.
// NOTE — Alfred is deliberately NOT gated here (owner explicit call):
// every owner brings their own AI model key and their own Twilio account,
// so Alfred costs this platform nothing regardless of which plan someone
// is on — there's no revenue-leakage argument for it the way there is for
// campaigns, which run on this platform's own infrastructure.
export type GatedFeature = "campaigns";
const FEATURE_TIERS: Record<GatedFeature, PlanTier[]> = {
  campaigns: ["unlimited", "trialing", "growth"],
};
export const hasPlanFeature = (tier: PlanTier, feature: GatedFeature): boolean =>
  FEATURE_TIERS[feature].includes(tier);
export const FEATURE_MIN_TIER_LABEL: Record<GatedFeature, string> = {
  campaigns: "the Growth plan",
};
