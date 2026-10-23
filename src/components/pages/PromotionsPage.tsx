import React, { useState } from "react";
import { Plus, Trash2, Edit, Mail, MessageSquare, Tag, MapPin, Calendar, Percent, DollarSign, Send, Eye, X, Users } from "lucide-react";
import { fmt, uid, today, daysSince, escapeHtml } from "../../lib/utils";
import type { Customer, Promotion, Service, AppSettings } from "../../types";
import { twilioSend, sendEmail, emailShell, emailButton, logOutboundSmsToInbox } from "../../lib/messaging";
import { supabase } from "../../lib/supabase";
import { Glass } from "../ui/Glass";
import { GBtn } from "../ui/GBtn";
import { GInput } from "../ui/GInput";
import { GDate } from "../ui/GDate";
import { GSel } from "../ui/GSel";
import { GTxt } from "../ui/GTxt";
import { Modal } from "../ui/Modal";
import { Badge } from "../ui/Badge";
import { Stat } from "../ui/Stat";

const blankPromo = (): Promotion => ({
  id: "", name: "", description: "", discountType: "percent", discountValue: 10,
  validFrom: today(), validTo: today(), serviceRestrictions: [], usageLimit: undefined,
  audience: "all", channel: "email", status: "draft", createdAt: today(), code: "",
});

export function PromotionsPage({ promotions = [], setPromotions = (() => {}) as any, customers = [], services = [], settings = {} as AppSettings, toast }: { promotions?: Promotion[]; setPromotions?: any; customers?: Customer[]; services?: Service[]; settings?: AppSettings; toast?: any }) {
  const [editing, setEditing] = useState<Promotion | null>(null);
  const [sending, setSending] = useState<Promotion | null>(null);
  const [previewOn, setPreviewOn] = useState(false);
  const [busy, setBusy] = useState(false);

  const companyName = settings?.companyName || "CRM Starter";
  // BUG FIX — the claim/book link below used to point at #/customers, the
  // owner CRM's own authenticated page. A customer clicking it hit a login
  // wall instead of anything they could actually use. #/lead-form is the
  // real public, no-login "request a quote" page (see LeadFormPage.tsx).
  const claimLink = `${window.location.origin}${window.location.pathname}#/lead-form?co=${encodeURIComponent(companyName)}&ph=${encodeURIComponent((settings as any)?.companyPhone || "")}`;

  const matchAudience = (p: Promotion): Customer[] => {
    if (p.audience === "all") return customers;
    if (p.audience === "individual") return customers.filter(c => (p.audienceCustomerIds || []).includes(c.id));
    if (p.audience === "tag") return customers.filter(c => (c.tags || []).includes(p.audienceTag || ""));
    if (p.audience === "folder") return customers.filter(c => c.folder === p.audienceFolder);
    if (p.audience === "location") return customers.filter(c => (c.city || "").toLowerCase() === (p.audienceCity || "").toLowerCase());
    if (p.audience === "lastService") return customers.filter(c => (p.audienceLastServiceBefore || 0) > 0 && daysSince(c.createdAt) >= (p.audienceLastServiceBefore || 0));
    return customers;
  };

  const discountLabel = (p: Promotion) => p.discountType === "percent" ? `${p.discountValue}% off` : `${fmt(p.discountValue)} off`;

  const promoHtml = (p: Promotion, cust: Customer) => {
    const body = `
      <div style="text-align:center;margin-bottom:16px">
        <div style="display:inline-block;background:#111111;color:#fff;font-weight:800;font-size:22px;padding:10px 22px;border-radius:12px">${discountLabel(p)}</div>
      </div>
      <p style="font-size:15px">Hi ${escapeHtml(cust.firstName)},</p>
      <p style="font-size:14px;color:#444">${p.description || `Enjoy ${discountLabel(p)} on your next service with ${companyName}!`}</p>
      <p style="font-size:12px;color:#888">Valid ${p.validFrom} through ${p.validTo}${p.usageLimit ? ` · Limited to ${p.usageLimit} uses` : ""}</p>
    `;
    return emailShell(settings, p.name, body + emailButton("Claim This Offer", claimLink));
  };

  const promoSms = (p: Promotion, cust: Customer) => {
    const line = p.description || `${discountLabel(p)} on your next service with ${companyName}`;
    return `Hi ${cust.firstName}! ${line} — valid through ${p.validTo}. Book here: ${claimLink} — ${companyName}`;
  };

  const send = async (p: Promotion) => {
    const targets = matchAudience(p);
    if (targets.length === 0) { toast?.("No customers match this audience", "red"); return; }
    setBusy(true);
    let sentCount = 0;
    let failedCount = 0;
    const failureSamples: string[] = [];
    for (const cust of targets) {
      try {
        if ((p.channel === "email" || p.channel === "both") && cust.email) {
          await sendEmail(settings as any, { to: cust.email, subject: `${p.name} — ${companyName}`, body: promoHtml(p, cust) });
          sentCount++;
        }
        if ((p.channel === "sms" || p.channel === "both") && cust.phone) {
          const smsBody = promoSms(p, cust);
          await twilioSend(settings as any, cust.phone, smsBody);
          logOutboundSmsToInbox({ contactName: `${cust.firstName} ${cust.lastName}`, contactPhone: cust.phone, customerId: cust.id, body: smsBody }).catch(() => {});
          sentCount++;
        }
      } catch (e: any) {
        failedCount++;
        const reason = e?.message || "Unknown error";
        if (failureSamples.length < 5) failureSamples.push(`${cust.firstName || cust.email || cust.phone}: ${reason}`);
        console.error("[Promotions] send failed for", cust.id, "—", reason);
      }
    }
    setPromotions((prev: Promotion[]) => prev.map(x => x.id === p.id ? { ...x, status: "sent", sentAt: today(), sentCount: (x.sentCount || 0) + sentCount } : x));
    if (failedCount > 0) {
      toast?.(`Promotion sent to ${sentCount} recipient${sentCount !== 1 ? "s" : ""} — ${failedCount} failed. First failure: ${failureSamples[0] || "unknown error"}`, sentCount > 0 ? "yellow" : "red");
    } else {
      toast?.(`Promotion sent to ${sentCount} recipient${sentCount !== 1 ? "s" : ""} ✓`, "green");
    }
    setBusy(false);
    setSending(null);
  };

  const remove = (id: string) => {
    setPromotions((prev: Promotion[]) => prev.filter(p => p.id !== id));
    // AUDIT FIX — was fully silent + toasted "deleted" unconditionally; a
    // 0-row RLS mismatch meant the row could reappear on the next fetch
    // with no error ever shown.
    (supabase as any).from("promotions").delete().eq("id", id).select("id").then(
      (r: any) => {
        if (!Array.isArray(r?.data) || r.data.length === 0) { toast?.("Deleted locally, but the server didn't confirm — it may reappear. Try again or refresh to check.", "red"); return; }
        toast?.("Promotion deleted");
      },
      (e: any) => toast?.("Deleted locally, but failed to delete from server — " + (e?.message || ""), "red")
    );
  };

  const active = promotions.filter(p => p.status === "sent" || p.status === "active");
  const drafts = promotions.filter(p => p.status === "draft" || p.status === "scheduled");

  const allTags = Array.from(new Set(customers.flatMap(c => c.tags || [])));
  const cities = Array.from(new Set(customers.map(c => c.city).filter(Boolean))) as string[];
  const allFolders = Array.from(new Set(customers.map(c => c.folder).filter(Boolean))) as string[];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Stat icon={Tag} label="Active/Sent" value={String(active.length)} />
        <Stat icon={Edit} label="Drafts" value={String(drafts.length)} />
        <Stat icon={Send} label="Total Sent" value={String(promotions.reduce((s, p) => s + (p.sentCount || 0), 0))} />
        <Stat icon={Percent} label="Redeemed" value={String(promotions.reduce((s, p) => s + (p.redeemedCount || 0), 0))} />
      </div>

      <div className="flex justify-end">
        <GBtn onClick={() => setEditing(blankPromo())}><Plus size={14} className="inline mr-1.5" />New Promotion</GBtn>
      </div>

      {promotions.length === 0 && (
        <div className="text-center py-16 text-white/40">
          <Tag size={32} className="mx-auto mb-3 opacity-30" />
          <div className="text-sm">No promotions yet</div>
        </div>
      )}

      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
        {promotions.map(p => (
          <Glass key={p.id} className="p-4">
            <div className="flex items-start justify-between gap-2 mb-2">
              <div>
                <div className="font-semibold text-sm">{p.name}</div>
                <div className="text-xs text-white/50 mt-0.5">{discountLabel(p)} · {p.audience === "all" ? "All customers" : p.audience}</div>
              </div>
              <Badge tone={p.status === "sent" ? "green" : p.status === "active" ? "blue" : "yellow"}>{p.status}</Badge>
            </div>
            {p.description && <div className="text-xs text-white/60 mb-2 line-clamp-2">{p.description}</div>}
            <div className="text-[10px] text-white/40 mb-3">{p.validFrom} → {p.validTo}{p.usageLimit ? ` · max ${p.usageLimit} uses` : ""}</div>
            {(p.sentCount || p.openedCount || p.redeemedCount) ? (
              <div className="grid grid-cols-3 gap-2 mb-3 text-center">
                <div className="p-1.5 bg-black/30 rounded-lg"><div className="text-sm font-bold">{p.sentCount || 0}</div><div className="text-[9px] text-white/40">Sent</div></div>
                <div className="p-1.5 bg-black/30 rounded-lg"><div className="text-sm font-bold">{p.openedCount || 0}</div><div className="text-[9px] text-white/40">Opened</div></div>
                <div className="p-1.5 bg-black/30 rounded-lg"><div className="text-sm font-bold">{p.redeemedCount || 0}</div><div className="text-[9px] text-white/40">Redeemed</div></div>
              </div>
            ) : null}
            <div className="flex gap-1.5 pt-2 border-t border-white/10">
              <button onClick={() => setEditing({ ...p })} className="flex-1 p-1.5 rounded-lg hover:bg-white/10 text-white/60 hover:text-white text-[11px] flex items-center justify-center gap-1"><Edit size={11} />Edit</button>
              <button onClick={() => setSending(p)} className="flex-1 p-1.5 rounded-lg hover:bg-green-900/30 text-white/60 hover:text-green-400 text-[11px] flex items-center justify-center gap-1"><Send size={11} />Send</button>
              <button onClick={() => remove(p.id)} className="p-1.5 rounded-lg hover:bg-danger-900/30 text-white/60 hover:text-danger-400"><Trash2 size={11} /></button>
            </div>
          </Glass>
        ))}
      </div>

      {/* Create / edit modal */}
      <Modal open={!!editing} onClose={() => setEditing(null)} title={editing?.id ? "Edit Promotion" : "New Promotion"} maxW="max-w-lg">
        {editing && (
          <div className="space-y-3">
            <div><label className="text-xs text-white/60 mb-1 block">Name *</label><GInput value={editing.name} onChange={(e: any) => setEditing({ ...editing, name: e.target.value })} placeholder="Summer Wash Special" /></div>
            <div><label className="text-xs text-white/60 mb-1 block">Description</label><GTxt rows={2} value={editing.description || ""} onChange={(e: any) => setEditing({ ...editing, description: e.target.value })} /></div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-white/60 mb-1 block">Discount Type</label>
                <GSel value={editing.discountType} onChange={(e: any) => setEditing({ ...editing, discountType: e.target.value })}>
                  <option value="percent" className="bg-black">Percentage (%)</option>
                  <option value="fixed" className="bg-black">Fixed Amount ($)</option>
                </GSel>
              </div>
              <div><label className="text-xs text-white/60 mb-1 block">Discount Value</label><GInput type="number" value={editing.discountValue} onChange={(e: any) => setEditing({ ...editing, discountValue: Number(e.target.value) })} /></div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div><label className="text-xs text-white/60 mb-1 block">Valid From</label><GDate value={editing.validFrom} onChange={(e: any) => setEditing({ ...editing, validFrom: e.target.value })} /></div>
              <div><label className="text-xs text-white/60 mb-1 block">Valid To</label><GDate value={editing.validTo} onChange={(e: any) => setEditing({ ...editing, validTo: e.target.value })} /></div>
            </div>

            <div><label className="text-xs text-white/60 mb-1 block">Usage Limit <span className="text-white/30">(blank = unlimited)</span></label><GInput type="number" value={editing.usageLimit || ""} onChange={(e: any) => setEditing({ ...editing, usageLimit: e.target.value ? Number(e.target.value) : undefined })} /></div>

            <div>
              <label className="text-xs text-white/60 mb-1 block">Promo Code <span className="text-white/30">(optional — customers enter this at checkout to redeem)</span></label>
              <GInput value={editing.code || ""} onChange={(e: any) => setEditing({ ...editing, code: e.target.value.toUpperCase().replace(/\s+/g, "") })} placeholder="SUMMER10" />
            </div>

            <div>
              <label className="text-xs text-white/60 mb-1 block">Service Restrictions <span className="text-white/30">(blank = all services)</span></label>
              <div className="flex flex-wrap gap-1.5">
                {services.map((s: any) => {
                  const on = (editing.serviceRestrictions || []).includes(s.id);
                  return <button key={s.id} onClick={() => setEditing({ ...editing, serviceRestrictions: on ? (editing.serviceRestrictions || []).filter(x => x !== s.id) : [...(editing.serviceRestrictions || []), s.id] })} className={"px-2 py-1 rounded-lg text-[11px] border transition " + (on ? "bg-brand-900/40 border-brand-500/50 text-white" : "bg-black/40 border-white/10 text-white/50")}>{s.name}</button>;
                })}
              </div>
            </div>

            <div>
              <label className="text-xs text-white/60 mb-1.5 block">Audience</label>
              <GSel value={editing.audience} onChange={(e: any) => setEditing({ ...editing, audience: e.target.value })}>
                <option value="all" className="bg-black">All customers</option>
                <option value="tag" className="bg-black">By tag</option>
                <option value="folder" className="bg-black">By folder</option>
                <option value="location" className="bg-black">By location (city)</option>
                <option value="lastService" className="bg-black">By last-service date</option>
                <option value="individual" className="bg-black">Select individual customers</option>
              </GSel>
              {editing.audience === "tag" && (
                <GSel value={editing.audienceTag || ""} onChange={(e: any) => setEditing({ ...editing, audienceTag: e.target.value })} className="mt-2">
                  <option value="" className="bg-black">— Choose tag —</option>
                  {allTags.map(t => <option key={t} value={t} className="bg-black">{t}</option>)}
                </GSel>
              )}
              {editing.audience === "folder" && (
                <GSel value={editing.audienceFolder || ""} onChange={(e: any) => setEditing({ ...editing, audienceFolder: e.target.value })} className="mt-2">
                  <option value="" className="bg-black">— Choose folder —</option>
                  {allFolders.map(f => <option key={f} value={f} className="bg-black">{f}</option>)}
                </GSel>
              )}
              {editing.audience === "location" && (
                <GSel value={editing.audienceCity || ""} onChange={(e: any) => setEditing({ ...editing, audienceCity: e.target.value })} className="mt-2">
                  <option value="" className="bg-black">— Choose city —</option>
                  {cities.map(c => <option key={c} value={c} className="bg-black">{c}</option>)}
                </GSel>
              )}
              {editing.audience === "lastService" && (
                <GInput type="number" placeholder="Days since last service (e.g. 90)" value={editing.audienceLastServiceBefore || ""} onChange={(e: any) => setEditing({ ...editing, audienceLastServiceBefore: Number(e.target.value) })} className="mt-2" />
              )}
              {editing.audience === "individual" && (
                <div className="mt-2 max-h-32 overflow-y-auto space-y-1 border border-white/10 rounded-xl p-2">
                  {customers.map(c => {
                    const on = (editing.audienceCustomerIds || []).includes(c.id);
                    return <label key={c.id} className="flex items-center gap-2 text-xs py-0.5"><input type="checkbox" checked={on} onChange={() => setEditing({ ...editing, audienceCustomerIds: on ? (editing.audienceCustomerIds || []).filter(x => x !== c.id) : [...(editing.audienceCustomerIds || []), c.id] })} className="accent-brand-600" />{c.firstName} {c.lastName}</label>;
                  })}
                </div>
              )}
              <div className="text-[10px] text-white/40 mt-1">{matchAudience(editing).length} customer{matchAudience(editing).length !== 1 ? "s" : ""} match</div>
            </div>

            <div>
              <label className="text-xs text-white/60 mb-1.5 block">Send Via</label>
              <div className="flex gap-1 p-1 bg-black/40 border border-white/10 rounded-xl">
                {(["email", "sms", "both"] as const).map(ch => (
                  <button key={ch} onClick={() => setEditing({ ...editing, channel: ch })} className={"flex-1 py-1.5 rounded-lg text-xs capitalize transition " + (editing.channel === ch ? "bg-brand-700/40 text-white border border-brand-700/50" : "text-white/50")}>{ch}</button>
                ))}
              </div>
            </div>

            <div className="flex gap-2 justify-end pt-2 border-t border-white/10">
              <GBtn variant="ghost" onClick={() => setEditing(null)}>Cancel</GBtn>
              <GBtn onClick={() => {
                if (!editing.name.trim()) return;
                const p = { ...editing, id: editing.id || uid() };
                setPromotions((prev: Promotion[]) => prev.find(x => x.id === p.id) ? prev.map(x => x.id === p.id ? p : x) : [...prev, p]);
                // Promo codes must reach Supabase — the public #/estimate page an
                // anonymous customer redeems a code from reads promotions from
                // Supabase directly, never from this device's localStorage.
                (supabase as any).from("promotions").upsert(p, { onConflict: "id" })
                  .then((r: any) => { if (r?.error) toast?.("Saved locally, but failed to sync — " + r.error.message, "red"); })
                  .catch((err: any) => toast?.("Saved locally, but failed to sync — " + (err?.message || ""), "red"));
                setEditing(null);
                toast?.(editing.id ? "Promotion updated" : "Promotion saved");
              }} disabled={!editing.name.trim()}>Save Promotion</GBtn>
            </div>
          </div>
        )}
      </Modal>

      {/* Send confirmation + preview */}
      <Modal open={!!sending} onClose={() => { setSending(null); setPreviewOn(false); }} title={`Send "${sending?.name}"`} maxW="max-w-md">
        {sending && (() => {
          const targets = matchAudience(sending);
          const sample = targets[0];
          return (
            <div className="space-y-3">
              <div className="text-sm text-white/70">This will message <strong className="text-white">{targets.length}</strong> customer{targets.length !== 1 ? "s" : ""} via <strong className="text-white capitalize">{sending.channel}</strong>.</div>
              <button onClick={() => setPreviewOn(p => !p)} className="text-xs text-purple-400 hover:text-purple-300 flex items-center gap-1"><Eye size={12} />{previewOn ? "Hide" : "Show"} preview</button>
              {previewOn && sample && (
                <div className="border border-white/10 rounded-xl overflow-hidden max-h-64 overflow-y-auto">
                  {(sending.channel === "sms") ? (
                    <div className="p-3 bg-black/40 text-xs whitespace-pre-wrap">{promoSms(sending, sample)}</div>
                  ) : (
                    <div dangerouslySetInnerHTML={{ __html: promoHtml(sending, sample) }} />
                  )}
                </div>
              )}
              <div className="flex gap-2 justify-end pt-2 border-t border-white/10">
                <GBtn variant="ghost" onClick={() => setSending(null)}>Cancel</GBtn>
                <GBtn onClick={() => send(sending)} disabled={busy}><Send size={13} className="inline mr-1" />{busy ? "Sending…" : "Send Now"}</GBtn>
              </div>
            </div>
          );
        })()}
      </Modal>
    </div>
  );
}
