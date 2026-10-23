import React, { useState } from "react";
import { BarChart2, Trophy, Sparkles } from "lucide-react";
import { Glass } from "./Glass";
import { GBtn } from "./GBtn";
import { GTxt } from "./GTxt";
import { twilioSend, logOutboundSmsToInbox } from "../../lib/messaging";
import { uid, today } from "../../lib/utils";

// FEATURE — "give me more templates for A/B testing campaigns, and make
// sure the results are real, not mock-ups." Several real starting-point
// message pairs across different angles an owner is likely to actually
// test, instead of the single hardcoded example that used to be the only
// option.
const AB_TEMPLATES: { name: string; a: string; b: string }[] = [
  {
    name: "Seasonal Discount",
    a: "Hi {{first_name}}, spring is here! 15% off house washes this month. Book at (555) 555-0100 — CRM Starter",
    b: "{{first_name}} — spots are filling up for spring cleanings. Lock in 15% off before they're gone! Book now — CRM Starter",
  },
  {
    name: "Urgency / FOMO",
    a: "{{first_name}} — your neighbors are getting their homes washed. Don't be the last one 😅 Call us! — CRM Starter",
    b: "{{first_name}}, only 3 spots left this week for an appointment. Grab one before they're gone — CRM Starter",
  },
  {
    name: "Referral Push",
    a: "Hi {{first_name}}! Know anyone who needs exterior cleaning? Refer a friend and earn $25 credit — CRM Starter",
    b: "{{first_name}} — loved your last wash? Share the love: refer a friend, you both save — CRM Starter",
  },
  {
    name: "Review Ask",
    a: "Hi {{first_name}}, thanks for choosing us! Mind leaving a quick review? It really helps a small business — CRM Starter",
    b: "{{first_name}} — got 30 seconds? A quick review from you would mean the world to our small team — CRM Starter",
  },
  {
    name: "Win-Back (lapsed customer)",
    a: "Hi {{first_name}}, it's been a while! Come back for 10% off your next wash — CRM Starter",
    b: "{{first_name}}, we miss you! Book this month and save 10% — CRM Starter",
  },
  {
    name: "Loyalty Reward",
    a: "Hi {{first_name}}, as a thank-you for being a repeat customer, here's 10% off your next service — CRM Starter",
    b: "{{first_name}} — you're one of our favorite customers. Enjoy 10% off as a thank-you — CRM Starter",
  },
];

export function ABTestPanel({ matches = [], toast, settings = {} as any, setSettings, inboxThreads = [] }: { matches?: any[]; toast?: any; settings?: any; setSettings?: any; inboxThreads?: any[] }) {
  const [varA, setVarA] = useState(AB_TEMPLATES[0].a);
  const [varB, setVarB] = useState(AB_TEMPLATES[0].b);
  const [splitPct, setSplitPct] = useState(50);
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState({ sent: 0, total: 0 });

  // FEATURE — real results, persisted (were purely local component state
  // before, wiped the moment this panel unmounted). Stored on
  // settings.abTestHistory (JSONB, same cross-device sync every other
  // settings field already gets) rather than a new table — this is
  // low-volume, owner-only data, not something that needs its own RLS-
  // scoped table.
  const history: any[] = (settings as any)?.abTestHistory || [];

  const recipients = matches.filter((c: any) => c.phone);
  const aCount = Math.round(recipients.length * (splitPct / 100));
  const bCount = recipients.length - aCount;

  const applyTemplate = (t: typeof AB_TEMPLATES[number]) => { setVarA(t.a); setVarB(t.b); };

  const fillVars = (body: string, c: any) => body.replace(/\{\{first_name\}\}/gi, c.firstName || "there");

  // Sends REAL messages via Twilio (same twilioSend/logOutboundSmsToInbox
  // path every other SMS send in this app uses — see docs/ARCHITECTURE.md's Critical
  // rules) and computes REAL results afterward: sent count (from actual
  // send success/failure) and reply rate (a genuine count of inbound
  // replies logged to inbox_threads from each recipient's phone, in the
  // 48h window after the send — never a random number).
  const runTest = async () => {
    if (!settings?.twilioSid) { toast?.("Connect Twilio in Settings → Integrations to send a real A/B test", "red"); return; }
    if (recipients.length === 0) { toast?.("No recipients with a phone number in this segment", "yellow"); return; }
    setRunning(true);
    const shuffled = [...recipients].sort(() => Math.random() - 0.5);
    const groupA = shuffled.slice(0, aCount);
    const groupB = shuffled.slice(aCount);
    const startedAt = Date.now();
    let sentA = 0, sentB = 0, failed = 0;
    setProgress({ sent: 0, total: recipients.length });

    for (const [group, body, label] of [[groupA, varA, "A"], [groupB, varB, "B"]] as const) {
      for (const c of group) {
        try {
          const msg = fillVars(body, c);
          await twilioSend(settings, c.phone, msg);
          logOutboundSmsToInbox({ contactName: `${c.firstName} ${c.lastName}`, contactPhone: c.phone, customerId: c.id, body: msg }).catch(() => {});
          if (label === "A") sentA++; else sentB++;
        } catch {
          failed++;
        }
        setProgress(p => ({ ...p, sent: p.sent + 1 }));
      }
    }

    const test = {
      id: uid(), createdAt: today(), startedAt,
      varA, varB, splitPct, sentA, sentB, failed,
      recipientsA: groupA.map((c: any) => c.phone), recipientsB: groupB.map((c: any) => c.phone),
    };
    setSettings?.((prev: any) => ({ ...prev, abTestHistory: [test, ...(prev?.abTestHistory || [])].slice(0, 20) }));
    setRunning(false);
    toast?.(`A/B test sent — ${sentA} got A, ${sentB} got B${failed > 0 ? `, ${failed} failed` : ""}`, "green");
  };

  // Real reply count for a test: any inbound message from a recipient's
  // phone, logged to inbox_threads, timestamped after this test started.
  const normDigits = (p: string) => (p || "").replace(/\D/g, "");
  const countReplies = (phones: string[], sinceMs: number): number => {
    const phoneSet = new Set(phones.map(normDigits));
    let count = 0;
    for (const t of inboxThreads) {
      if (!phoneSet.has(normDigits(t.contact_phone))) continue;
      const hasReply = (t.messages || []).some((m: any) => m.dir === "in" && m.ts >= sinceMs);
      if (hasReply) count++;
    }
    return count;
  };

  return <div className="space-y-4">
    <Glass className="p-4 !bg-purple-950/20 !border-purple-700/30">
      <div className="font-semibold mb-1 flex items-center gap-2"><BarChart2 size={14} className="text-purple-400" />A/B Message Testing</div>
      <div className="text-xs text-white/60">Send two real SMS versions to split your audience via Twilio. Results below are real send counts and real reply rates — never simulated.</div>
    </Glass>

    <Glass className="p-4">
      <div className="text-xs font-semibold text-white/70 mb-2 flex items-center gap-1.5"><Sparkles size={12} className="text-yellow-400" />Templates</div>
      <div className="flex flex-wrap gap-2">
        {AB_TEMPLATES.map(t => (
          <button key={t.name} onClick={() => applyTemplate(t)} className="px-3 py-1.5 rounded-lg text-xs font-medium bg-white/5 border border-white/10 hover:bg-white/10 hover:border-purple-500/40 transition text-white/70 hover:text-white">
            {t.name}
          </button>
        ))}
      </div>
    </Glass>

    <div className="grid md:grid-cols-2 gap-4">
      <Glass className="p-4 !border-blue-700/30">
        <div className="text-xs font-bold text-blue-400 mb-2">VARIANT A — {splitPct}% of audience</div>
        <GTxt rows={4} value={varA} onChange={e => setVarA(e.target.value)} className="!text-xs" />
        <div className="text-[10px] text-white/40 mt-1">{varA.length} chars</div>
      </Glass>
      <Glass className="p-4 !border-purple-700/30">
        <div className="text-xs font-bold text-purple-400 mb-2">VARIANT B — {100 - splitPct}% of audience</div>
        <GTxt rows={4} value={varB} onChange={e => setVarB(e.target.value)} className="!text-xs" />
        <div className="text-[10px] text-white/40 mt-1">{varB.length} chars</div>
      </Glass>
    </div>

    <Glass className="p-4">
      <div className="flex items-center gap-4 flex-wrap">
        <div className="flex-1 min-w-32">
          <label className="text-xs text-white/60 mb-1 block">A/B Split: A gets {splitPct}%</label>
          <input type="range" min={10} max={90} value={splitPct} onChange={e => setSplitPct(Number(e.target.value))} className="w-full" />
        </div>
        <div className="text-center text-xs text-white/60"><div className="font-bold text-white">{recipients.length}</div>recipients</div>
        <div className="text-center text-xs text-white/60"><div className="font-bold text-blue-400">{aCount}</div>get A</div>
        <div className="text-center text-xs text-white/60"><div className="font-bold text-purple-400">{bCount}</div>get B</div>
        <GBtn onClick={runTest} disabled={running || recipients.length === 0} className="flex-shrink-0">
          {running ? <><div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin inline-block mr-1.5" />Sending {progress.sent}/{progress.total}…</> : "Launch Test"}
        </GBtn>
      </div>
    </Glass>

    {history.length > 0 && (
      <div className="space-y-3">
        <h3 className="font-semibold text-sm flex items-center gap-2"><Trophy size={14} className="text-yellow-400" />Test Results</h3>
        {history.map((test: any) => {
          const repliesA = countReplies(test.recipientsA || [], test.startedAt || 0);
          const repliesB = countReplies(test.recipientsB || [], test.startedAt || 0);
          const rateA = test.sentA > 0 ? Math.round((repliesA / test.sentA) * 100) : 0;
          const rateB = test.sentB > 0 ? Math.round((repliesB / test.sentB) * 100) : 0;
          const winner = rateA === rateB ? null : rateA > rateB ? "A" : "B";
          return (
            <Glass key={test.id} className="p-5">
              <div className="text-[10px] text-white/40 mb-3">{test.createdAt}{test.failed > 0 ? ` · ${test.failed} failed to send` : ""}</div>
              <div className="grid grid-cols-2 gap-4">
                {([["A", "blue", test.sentA, repliesA, rateA, test.varA], ["B", "purple", test.sentB, repliesB, rateB, test.varB]] as const).map(([v, color, sent, replies, rate, body]) => (
                  <div key={v} className={"p-4 rounded-xl border-2 " + (winner === v ? "border-yellow-500/60 bg-yellow-950/20" : "border-white/10 bg-black/40")}>
                    <div className={"font-bold text-sm mb-2 " + (color === "blue" ? "text-blue-400" : "text-purple-400")}>Variant {v} {winner === v ? "🏆 WINNER" : ""}</div>
                    <div className="text-[11px] text-white/50 mb-2 line-clamp-2">{body}</div>
                    <div className="space-y-1.5 text-xs">
                      <div className="flex justify-between"><span className="text-white/60">Sent</span><span className="font-semibold">{sent}</span></div>
                      <div className="flex justify-between"><span className="text-white/60">Replied</span><span className="font-semibold text-yellow-400">{replies} ({rate}%)</span></div>
                    </div>
                  </div>
                ))}
              </div>
              {winner && (
                <div className="mt-3 p-3 bg-black/40 rounded-xl text-xs text-white/60 text-center">
                  Winner: <span className="font-bold text-yellow-400">Variant {winner}</span> had a higher reply rate.
                </div>
              )}
            </Glass>
          );
        })}
      </div>
    )}
  </div>;
}
