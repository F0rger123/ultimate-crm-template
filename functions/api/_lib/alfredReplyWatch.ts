// Reply watching — when Alfred texts customers a question ("when's your
// birthday?"), it keeps a watch (owner_records kind "reply_watch") on who
// it asked. Every inbound text from one of those customers comes here
// first (twilio-sms-webhook.ts): a model reads the reply against the
// question, saves the answer to the customer's file, optionally thanks
// them, and tells the owner.
//
// FEATURE — "It wasn't watching for responses. It should be proactive:
// whenever someone responds with their birthday, it should automatically
// add it to their file."
import { SUPABASE_URL } from "./env";
import { recList, recPut } from "./ownerRecords";
import { askModelJson, sendCustomerSmsAsAlfred } from "./alfredSmsAgent";



// Customer columns a watch may write. Anything else stays in the owner note.
export const WATCH_FIELDS = ["birthday", "email", "address", "notes", "company"] as const;
export type WatchField = typeof WATCH_FIELDS[number];

export type ReplyWatch = {
  id: string;
  campaignId?: string;
  question: string;          // what was asked, in plain words
  saveField?: WatchField;    // where the answer goes on the customer file
  thankYouMessage?: string;  // optional reply once they answer ({{first_name}} ok)
  customers: Record<string, { name: string; status: "waiting" | "answered"; answer?: string; at?: string }>;
  createdAt: string;
  expiresAt: string;
  pendingOwnerNote?: string[]; // answers not yet reported to the owner
  lastOwnerTextAt?: string;
};

export async function findActiveWatch(authHeaders: Record<string, string>, ownerId: string, customerId: string): Promise<ReplyWatch | null> {
  if (!ownerId || !customerId) return null;
  const { ok, rows } = await recList(authHeaders, ownerId, "reply_watch", { limit: 50 });
  if (!ok) return null;
  const now = new Date().toISOString();
  return (rows as ReplyWatch[]).find(w => w.expiresAt > now && w.customers?.[customerId]?.status === "waiting") || null;
}

const normalizeBirthday = (v: string): string => {
  const s = String(v || "").trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s) || /^--\d{2}-\d{2}$/.test(s)) return s;
  const md = s.match(/^(\d{1,2})[/-](\d{1,2})$/);
  if (md) return `--${md[1].padStart(2, "0")}-${md[2].padStart(2, "0")}`;
  const t = Date.parse(s);
  return isNaN(t) ? "" : new Date(t).toISOString().slice(0, 10);
};

// Returns true when the reply answered the watched question (and was
// handled), false when it's about something else and should go through
// the normal inbound flow.
export async function handleWatchedReply(ctx: any, modelKeys: Record<string, string>, modelPriority: string[] | undefined, watch: ReplyWatch, customer: { id: string; firstName?: string; lastName?: string; phone?: string }, text: string): Promise<boolean> {
  const name = `${customer.firstName || ""} ${customer.lastName || ""}`.trim() || customer.phone || "A customer";
  const fieldHint = watch.saveField === "birthday"
    ? 'For a birthday, "value" is YYYY-MM-DD when they give a year, otherwise --MM-DD (e.g. "march 14th" → "--03-14").'
    : watch.saveField ? `"value" is what to save as their ${watch.saveField}.` : '"value" is their answer in a few words.';
  const parsed = await askModelJson(modelKeys, modelPriority,
    `A small business texted its customer this question: "${watch.question}". Below is the customer's reply. Decide if it answers the question. Reply with ONLY JSON, no prose: {"answered": boolean, "value": string, "summary": string}. ${fieldHint} "summary" is one short line for the business owner. If the reply is about something else (a question, a complaint, scheduling), answered is false.`,
    text);
  if (!parsed || !parsed.answered) return false;

  let value = String(parsed.value || "").trim();
  if (watch.saveField === "birthday") value = normalizeBirthday(value);
  let saved = false;
  if (watch.saveField && value) {
    const patch: Record<string, string> = { [watch.saveField]: value };
    if (watch.saveField === "notes") {
      const cur = await fetch(`${SUPABASE_URL}/rest/v1/customers?id=eq.${encodeURIComponent(customer.id)}&select=notes`, { headers: ctx.authHeaders }).then(r => r.json()).catch(() => []);
      patch.notes = [cur?.[0]?.notes, value].filter(Boolean).join("\n");
    }
    const res = await fetch(`${SUPABASE_URL}/rest/v1/customers?id=eq.${encodeURIComponent(customer.id)}&owner_id=eq.${encodeURIComponent(ctx.ownerId)}`, {
      method: "PATCH", headers: { ...ctx.authHeaders, "Content-Type": "application/json", Prefer: "return=representation" },
      body: JSON.stringify(patch),
    });
    const rows = await res.json().catch(() => []);
    saved = res.ok && Array.isArray(rows) && rows.length > 0;
    if (!saved) console.error("[ReplyWatch] couldn't save", watch.saveField, "for", customer.id, res.status, JSON.stringify(rows).slice(0, 200));
  }

  watch.customers[customer.id] = { ...(watch.customers[customer.id] || { name }), status: "answered", answer: value || String(parsed.summary || text).slice(0, 120), at: new Date().toISOString() };
  const line = `${name}: ${value || parsed.summary || text.slice(0, 60)}${watch.saveField ? (saved ? " (saved)" : " (couldn't save — check the customer file)") : ""}`;
  watch.pendingOwnerNote = [...(watch.pendingOwnerNote || []), line];

  if (watch.thankYouMessage && customer.phone) {
    await sendCustomerSmsAsAlfred(ctx, customer.phone, watch.thankYouMessage.replace(/{{first_name}}/g, customer.firstName || "there"), { name, customerId: customer.id }).catch(() => {});
  }

  // Tell the owner — a text at most every 10 minutes per watch (so 200
  // replies don't mean 200 texts), plus a phone push for each one.
  const answered = Object.values(watch.customers).filter(c => c.status === "answered").length;
  const total = Object.keys(watch.customers).length;
  const due = !watch.lastOwnerTextAt || Date.now() - Date.parse(watch.lastOwnerTextAt) > 10 * 60 * 1000;
  if (due && ctx.ownerPhone) {
    const notes = watch.pendingOwnerNote || [];
    const body = `Alfred — replies to "${watch.question.slice(0, 60)}" (${answered}/${total} answered):\n` + notes.slice(0, 8).join("\n") + (notes.length > 8 ? `\n+${notes.length - 8} more` : "");
    const r = await sendCustomerSmsAsAlfred(ctx, ctx.ownerPhone, body, undefined, true).catch(() => ({ ok: false }));
    if ((r as any).ok) { watch.pendingOwnerNote = []; watch.lastOwnerTextAt = new Date().toISOString(); }
  }
  if (ctx.origin && ctx.ownerId) {
    fetch(`${ctx.origin}/api/send-push`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ownerId: ctx.ownerId, title: `${name} replied`, body: line, url: "/#/inbox", tag: "watch-" + watch.id + "-" + customer.id }),
    }).catch(() => {});
  }

  await recPut(ctx.authHeaders, ctx.ownerId, "reply_watch", watch);
  return true;
}
