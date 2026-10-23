// FEATURE — "prioritize importing existing Stripe customers/cards." Lists
// the owner's real Stripe customers and lets them link each one to an
// existing CRM customer (matched by email/phone) or create a new CRM
// customer record for it. Only the Stripe customer ID gets attached
// (stripeCustomerId) — actual card details are never duplicated into our
// own database; they keep loading live from Stripe via the same
// CustomerDetail.tsx "Payment Methods" section every other card already
// uses, the moment a stripeCustomerId is on file.
import React, { useEffect, useState } from "react";
import { CreditCard, Link as LinkIcon, UserPlus, CheckCircle } from "lucide-react";
import { Modal } from "./Modal";
import { GBtn } from "./GBtn";
import { supabase } from "../../lib/supabase";
import { listStripeCustomers, StripeCustomerListItem } from "../../lib/stripe";
import { uid, today, withTimeout } from "../../lib/utils";
import { CUSTOMER_LIMIT } from "../../lib/planLimits";

export function ImportStripeCustomersModal({ open, onClose, customers = [], setCustomers, toast = (() => {}) as any }: {
  open: boolean; onClose: () => void; customers?: any[]; setCustomers: any; toast?: (msg: string, tone?: any) => void;
}) {
  const [loading, setLoading] = useState(false);
  const [stripeCustomers, setStripeCustomers] = useState<StripeCustomerListItem[]>([]);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [doneIds, setDoneIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!open) return;
    setStripeCustomers([]); setError(""); setDoneIds(new Set());
    (async () => {
      setLoading(true);
      try {
        // BUG FIX — "importing customers from Stripe doesn't load anymore,
        // just says Loading Stripe customers." getSession() has a known,
        // previously-diagnosed failure mode in this app (see AlfredPage's
        // ITEM 23 comment): a browser navigator-lock deadlock or a cold/
        // slow connection can leave it hanging indefinitely with no
        // rejection at all — nothing else in this try/catch ever gets a
        // chance to run, so `finally`'s setLoading(false) never fires
        // either. listStripeCustomers already had its own 20s timeout;
        // this call had none.
        // BUG FIX (user report — "didn't do anything, eventually said get
        // session timed out") — the 10s timeout above stops it from hanging
        // forever, but getSession() itself still genuinely times out on a
        // flaky/mobile connection with no second chance. One retry before
        // giving up, same pattern used for this exact class of flakiness
        // elsewhere in this app (lib/messaging.ts's twilioSend).
        let session: any;
        try {
          session = (await withTimeout(supabase.auth.getSession(), 10000, "Get session")).data.session;
        } catch {
          session = (await withTimeout(supabase.auth.getSession(), 10000, "Get session (retry)")).data.session;
        }
        const token = session?.access_token;
        if (!token) throw new Error("Not signed in");
        const { customers: list } = await listStripeCustomers(token);
        setStripeCustomers(list);
      } catch (e: any) {
        setError(e?.message || "Failed to load Stripe customers");
      } finally {
        setLoading(false);
      }
    })();
  }, [open]);

  const findMatch = (sc: StripeCustomerListItem) => {
    const emailL = (sc.email || "").toLowerCase();
    const phoneDigits = (sc.phone || "").replace(/\D/g, "");
    return customers.find((c: any) =>
      (emailL && (c.email || "").toLowerCase() === emailL) ||
      (phoneDigits && (c.phone || "").replace(/\D/g, "") === phoneDigits)
    );
  };

  const importOne = async (sc: StripeCustomerListItem) => {
    setBusyId(sc.id);
    try {
      const match = findMatch(sc);
      if (match) {
        const res = await (supabase as any).from("customers").update({ stripeCustomerId: sc.id }).eq("id", match.id).select("id");
        if (res?.error) throw new Error(res.error.message);
        if (!Array.isArray(res?.data) || res.data.length === 0) throw new Error("Save didn't match this customer's record.");
        setCustomers((prev: any[]) => prev.map(c => c.id === match.id ? { ...c, stripeCustomerId: sc.id } : c));
        toast(`Linked to existing customer ${match.firstName} ${match.lastName} ✓`, "green");
      } else {
        if (customers.length >= CUSTOMER_LIMIT) throw new Error(`you've reached the ${CUSTOMER_LIMIT.toLocaleString()} customer limit`);
        const nameParts = (sc.name || "").trim().split(" ");
        const newC = {
          id: uid(), firstName: nameParts[0] || sc.email || "Stripe", lastName: nameParts.slice(1).join(" ") || "Customer",
          email: sc.email || "", phone: sc.phone || "", address: "", totalSpent: 0, createdAt: today(), notes: "",
          gateCode: "", hasDog: false, dogName: "", sensitivePlants: "", stripeCustomerId: sc.id,
        };
        const res = await (supabase as any).from("customers").insert(newC).select().single();
        if (res?.error) throw new Error(res.error.message);
        setCustomers((prev: any[]) => [...prev, res.data]);
        toast(`Imported ${newC.firstName} ${newC.lastName} ✓`, "green");
      }
      setDoneIds(prev => new Set(prev).add(sc.id));
    } catch (e: any) {
      toast("Import failed — " + (e?.message || "unknown error"), "red");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="Import from Stripe" maxW="max-w-2xl">
      <div className="space-y-3">
        <div className="text-xs text-white/50">
          Every real customer on your Stripe account. Rows matching an existing CRM customer's email or phone link automatically — anything with no match creates a new customer record. Card details always load live from Stripe, never copied here.
        </div>
        {/* FEATURE — "add a spinner for when it's loading" — was text-only. */}
        {loading && (
          <div className="flex flex-col items-center justify-center gap-2 py-8 text-white/40 text-sm">
            <div className="w-5 h-5 border-2 border-white/20 border-t-white/70 rounded-full animate-spin" />
            Loading Stripe customers…
          </div>
        )}
        {error && <div className="p-3 rounded-xl bg-danger-950/30 border border-danger-700/40 text-danger-300 text-sm">{error}</div>}
        {!loading && !error && stripeCustomers.length === 0 && (
          <div className="text-center py-8 text-white/40 text-sm">No customers found on your connected Stripe account yet.</div>
        )}
        {!loading && stripeCustomers.length > 0 && (
          <div className="max-h-[55vh] overflow-auto space-y-1.5">
            {stripeCustomers.map(sc => {
              const match = findMatch(sc);
              const done = doneIds.has(sc.id);
              return (
                <div key={sc.id} className="flex items-center gap-3 p-2.5 rounded-xl bg-white/5 border border-white/10">
                  <CreditCard size={14} className="text-white/30 flex-shrink-0" />
                  <div className="flex-1 min-w-0 text-xs">
                    <div className="font-medium text-white truncate">{sc.name || sc.email || sc.id}</div>
                    <div className="text-white/40 truncate">{[sc.email, sc.phone].filter(Boolean).join(" · ") || "No contact info on Stripe"}</div>
                    {match && !done && <div className="text-blue-400 mt-0.5 flex items-center gap-1"><LinkIcon size={9} />Matches {match.firstName} {match.lastName}</div>}
                  </div>
                  {done ? (
                    <span className="text-green-400 text-xs flex items-center gap-1 flex-shrink-0"><CheckCircle size={12} />Done</span>
                  ) : (
                    <GBtn onClick={() => importOne(sc)} disabled={busyId === sc.id} className="!text-xs !py-1.5 !px-3 flex-shrink-0">
                      {busyId === sc.id ? "…" : match ? "Link" : <><UserPlus size={11} className="inline mr-1" />Import</>}
                    </GBtn>
                  )}
                </div>
              );
            })}
          </div>
        )}
        <div className="flex justify-end pt-1"><GBtn variant="ghost" onClick={onClose}>Done</GBtn></div>
      </div>
    </Modal>
  );
}
