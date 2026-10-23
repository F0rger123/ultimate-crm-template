import { useEffect, useRef } from "react";

// AUDIT FIX (mobile round 10) — "Schedule for later" campaigns (CampaignScheduler.tsx)
// and the Sequences tab's "Holiday Greeting" (CampaignsPage.tsx) both save a
// Campaign record with status "scheduled" + a real sendAt, but nothing ever
// read that field back and actually sent it — the record just sat there
// forever. This hook, wired once globally in App.tsx (same pattern as
// useAutomationEngine), polls for campaigns whose sendAt has passed and
// actually sends them via the same Twilio/Gmail paths CampaignsPage.launch()
// uses, then marks them sent with real delivery counts.
import { twilioSend, sendEmail, logOutboundSmsToInbox } from "../lib/messaging";

interface ScheduledCampaignsProps {
  campaigns: any[];
  setCampaigns: React.Dispatch<React.SetStateAction<any[]>>;
  customers: any[];
  settings: any;
  toast: (msg: string, tone?: string) => void;
}

const merge = (template: string, customer: any, settings: any): string =>
  (template || "")
    .replace(/{{first_name}}/g, customer.firstName || "there")
    .replace(/{{last_name}}/g, customer.lastName || "")
    .replace(/{{address}}/g, customer.address || "")
    .replace(/{{phone}}/g, customer.phone || "")
    .replace(/{{company_name}}/g, settings?.companyName || "CRM Starter")
    .replace(/{{company_phone}}/g, settings?.companyPhone || "(555) 555-0100");

export function useScheduledCampaigns({ campaigns, setCampaigns, customers, settings, toast }: ScheduledCampaignsProps) {
  const campaignsRef = useRef(campaigns);
  const customersRef = useRef(customers);
  const settingsRef = useRef(settings);
  const toastRef = useRef(toast);
  const setCampaignsRef = useRef(setCampaigns);
  campaignsRef.current = campaigns;
  customersRef.current = customers;
  settingsRef.current = settings;
  toastRef.current = toast;
  setCampaignsRef.current = setCampaigns;

  const runningRef = useRef(false);
  // Session-level guard against double-sending the same scheduled campaign
  // if two poll ticks somehow overlap — mirrors useAutomationEngine's
  // firedThisSession pattern.
  const sentIdsRef = useRef(new Set<string>());

  useEffect(() => {
    const run = async () => {
      if (runningRef.current) return;
      const nowMs = Date.now();
      const due = (campaignsRef.current || []).filter(
        (c: any) => c.status === "scheduled" && c.sendAt && new Date(c.sendAt).getTime() <= nowMs && !sentIdsRef.current.has(c.id)
      );
      if (due.length === 0) return;
      runningRef.current = true;
      try {
        for (const camp of due) {
          sentIdsRef.current.add(camp.id);
          const settingsNow = settingsRef.current;
          const recipientIds = new Set(camp.matches || []);
          const targets = (customersRef.current || []).filter((c: any) => recipientIds.has(c.id));
          let sent = 0, failed = 0;
          const failureSamples: string[] = [];
          for (const customer of targets) {
            const personalized = merge(camp.body, customer, settingsNow);
            try {
              if (camp.ch === "sms") {
                if (!customer.phone) throw new Error("No phone on file");
                await twilioSend(settingsNow, customer.phone, personalized);
                logOutboundSmsToInbox({ contactName: `${customer.firstName} ${customer.lastName}`, contactPhone: customer.phone, customerId: customer.id, body: personalized }).catch(() => {});
              } else {
                if (!customer.email) throw new Error("No email on file");
                await sendEmail(settingsNow, { to: customer.email, subject: merge(camp.subject || camp.name || "", customer, settingsNow), body: personalized });
              }
              sent++;
            } catch (e: any) {
              failed++;
              if (failureSamples.length < 5) failureSamples.push(`${customer.firstName || customer.id}: ${e?.message || "unknown error"}`);
              console.error("[ScheduledCampaigns] send failed for", customer.id, "—", e?.message);
            }
          }
          setCampaignsRef.current((prev: any[]) => prev.map((c: any) => c.id === camp.id ? {
            ...c, status: "sent", sentAt: new Date().toISOString().slice(0, 10),
            sentCount: sent, failedCount: failed, failureSamples,
            recipientCount: targets.length, deliveryRate: targets.length > 0 ? Math.round((sent / targets.length) * 100) : 0,
          } : c));
          toastRef.current(
            `Scheduled campaign "${camp.name || "Campaign"}" sent — ${sent} delivered${failed ? `, ${failed} failed` : ""}`,
            failed > 0 ? (sent > 0 ? "yellow" : "red") : "green"
          );
        }
      } finally {
        runningRef.current = false;
      }
    };
    run();
    const interval = setInterval(run, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
}
