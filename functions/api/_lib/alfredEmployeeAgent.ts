// alfredEmployeeAgent.ts — a THIRD, separate Alfred agent (alongside the
// owner-facing alfredSmsAgent.ts and the customer-facing
// alfredCustomerAgent.ts) for employees the owner has explicitly opted in
// to texting Alfred (employees.permissions.can_text_alfred — off by
// default, toggled per-employee in Settings/Employees, same pattern as
// customers."alfredAutoRespond").
//
// Deliberately narrow, matching alfredCustomerAgent.ts's philosophy: this
// employee can only ever act on THEIR OWN record — clock themselves in/out,
// check their own hours, see their own upcoming jobs, manage events on
// THEIR OWN connected Google Calendar. No tool here takes an employeeId/
// employeeName the model could substitute to act as someone else, and
// nothing here touches other employees, customers, money, or CRM-wide data.

import { effectiveModel } from "./modelOverrides";
import { stripMarkdownForSms } from "./textFormat";
import { SUPABASE_URL } from "./env";

const SMS_MODELS: Record<string, { provider: string; modelId: string; endpoint: string; maxTokens: number }> = {
  claude: { provider: "anthropic", modelId: "claude-sonnet-5-5", endpoint: "https://api.anthropic.com/v1/messages", maxTokens: 400 },
  openai: { provider: "openai-compat", modelId: "gpt-4o", endpoint: "https://api.openai.com/v1/chat/completions", maxTokens: 400 },
  gemini: { provider: "google", modelId: "gemini-2.5-flash", endpoint: "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent", maxTokens: 400 },
  groq: { provider: "openai-compat", modelId: "openai/gpt-oss-120b", endpoint: "https://api.groq.com/openai/v1/chat/completions", maxTokens: 400 },
  mistral: { provider: "openai-compat", modelId: "mistral-large-latest", endpoint: "https://api.mistral.ai/v1/chat/completions", maxTokens: 400 },
  nvidia_kimi: { provider: "openai-compat", modelId: "deepseek-ai/deepseek-v4.1-flash", endpoint: "https://integrate.api.nvidia.com/v1/chat/completions", maxTokens: 400 },
  openrouter: { provider: "openai-compat", modelId: "openrouter/free", endpoint: "https://openrouter.ai/api/v1/chat/completions", maxTokens: 400 },
  cerebras: { provider: "openai-compat", modelId: "gpt-oss-120b", endpoint: "https://api.cerebras.ai/v1/chat/completions", maxTokens: 400 },
  nvidia_nemotron: { provider: "openai-compat", modelId: "nvidia/nemotron-3.5-lightning-30b-a3b", endpoint: "https://integrate.api.nvidia.com/v1/chat/completions", maxTokens: 400 },
  nvidia_muse: { provider: "openai-compat", modelId: "meta/muse-glimmer-30b", endpoint: "https://integrate.api.nvidia.com/v1/chat/completions", maxTokens: 400 },
  nvidia_deepseek_r1: { provider: "openai-compat", modelId: "moonshotai/kimi-k2.6", endpoint: "https://integrate.api.nvidia.com/v1/chat/completions", maxTokens: 400 },
  nvidia_qwen: { provider: "openai-compat", modelId: "nvidia/nemotron-3-super-120b-a12b", endpoint: "https://integrate.api.nvidia.com/v1/chat/completions", maxTokens: 400 },
};
const DEFAULT_PRIORITY = ["claude", "openai", "gemini", "groq", "mistral"];

export type Ctx = {
  authHeaders: Record<string, string>;
  ownerId: string | null;
  companyName: string;
  origin: string;
  env: Record<string, string>;
  twilioSid?: string;
  twilioToken?: string;
  twilioFrom?: string;
  owmKey?: string;
  weatherLocation?: string;
  companyAddress?: string;
};

const sbGet = async (ctx: Ctx, path: string): Promise<any[]> => {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, { headers: ctx.authHeaders });
  const data = await res.json().catch(() => []);
  return Array.isArray(data) ? data : [];
};
const ownerScope = (ctx: Ctx) => (ctx.ownerId ? `&owner_id=eq.${encodeURIComponent(ctx.ownerId)}` : "");
const shiftDayStr = () => new Date().toISOString().slice(0, 10);

// Texts a CUSTOMER on the employee's behalf (running-late notices only —
// see notify_upcoming_customers_running_late). Logged to inbox_threads like
// every other outbound SMS in this app (docs/ARCHITECTURE.md "Critical rules").
const sendCustomerSms = async (ctx: Ctx, toPhone: string, bodyRaw: string, contact: { name: string; customerId: string }): Promise<{ ok: boolean; error?: string }> => {
  if (!ctx.twilioSid || !ctx.twilioToken || !ctx.twilioFrom) return { ok: false, error: "Twilio isn't configured for this account." };
  const body = stripMarkdownForSms(bodyRaw);
  const auth = `Basic ${btoa(`${ctx.twilioSid}:${ctx.twilioToken}`)}`;
  const params = new URLSearchParams({ To: toPhone, From: ctx.twilioFrom, Body: body });
  const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${ctx.twilioSid}/Messages.json`, {
    method: "POST", headers: { Authorization: auth, "Content-Type": "application/x-www-form-urlencoded" }, body: params.toString(),
  });
  if (!res.ok) return { ok: false, error: (await res.text().catch(() => "")).slice(0, 200) };
  try {
    const threads = await sbGet(ctx, `inbox_threads?channel=eq.sms&select=id,contact_phone,messages${ownerScope(ctx)}`);
    const digits = (toPhone || "").replace(/\D/g, "");
    const norm = (p: string) => { const d = (p || "").replace(/\D/g, ""); return d.length === 11 && d.startsWith("1") ? d.slice(1) : d; };
    const existing = threads.find((t: any) => norm(t.contact_phone) === norm(digits));
    const msg = { id: crypto.randomUUID(), dir: "out", body, ts: Date.now(), via: "alfred" };
    if (existing) {
      // BUG FIX — atomic append (see append_inbox_message migration) —
      // this same thread's other loggers (the inbound webhook, the owner
      // agent's own reply) can write around the same moment; a plain
      // read-then-write PATCH here could win the race and drop one side.
      await fetch(`${SUPABASE_URL}/rest/v1/rpc/append_inbox_message`, {
        method: "POST", headers: { ...ctx.authHeaders, "Content-Type": "application/json" },
        body: JSON.stringify({ p_thread_id: existing.id, p_message: msg, p_unread: existing.unread !== false }),
      });
    } else {
      await fetch(`${SUPABASE_URL}/rest/v1/inbox_threads`, {
        method: "POST", headers: { ...ctx.authHeaders, "Content-Type": "application/json", Prefer: "return=minimal" },
        body: JSON.stringify({ id: crypto.randomUUID(), channel: "sms", contact_name: contact.name, contact_phone: toPhone, customer_id: contact.customerId, unread: false, messages: [msg], last_message_at: msg.ts, updated_at: new Date().toISOString(), ...(ctx.ownerId ? { owner_id: ctx.ownerId } : {}) }),
      });
    }
  } catch { /* non-fatal */ }
  return { ok: true };
};

const TOOLS = [
  {
    name: "clock_in",
    description: "Clock the employee in for the day (starts their shift timer). Use for 'clock me in' / 'I'm starting my shift'.",
    input_schema: { type: "object", properties: {} },
  },
  {
    name: "clock_out",
    description: "Clock the employee out, ending their shift for the day and logging the hours worked. Use for 'clock me out' / 'I'm done for the day'.",
    input_schema: { type: "object", properties: {} },
  },
  {
    name: "get_my_hours",
    description: "Check current shift status and hours — whether clocked in right now (and for how long), plus their most recently completed shift. Use for 'how many hours have I worked' / 'am I clocked in'.",
    input_schema: { type: "object", properties: {} },
  },
  {
    name: "get_my_earnings",
    description: "THIS employee's own hourly rate and pay for their current/most recent shift. Use for 'how much have I made' / 'what did I make today' / any question about THEIR OWN pay — never answer a pay question with business revenue, that is a completely different number and not this employee's own earnings.",
    input_schema: { type: "object", properties: {} },
  },
  {
    name: "list_my_upcoming_jobs",
    description: "List THIS employee's own upcoming assigned jobs. Use for 'what's on my schedule' / 'what job am I on next'.",
    input_schema: { type: "object", properties: { days: { type: "number", description: "how many days forward, default 7" } } },
  },
  {
    name: "add_my_calendar_event",
    description: "Add an event to THIS employee's own connected Google Calendar (personal, not a CRM job). Only works if they've connected Google from their portal.",
    input_schema: {
      type: "object",
      properties: { title: { type: "string" }, date: { type: "string", description: "YYYY-MM-DD" }, time: { type: "string", description: "HH:MM 24h" }, durationMinutes: { type: "number" }, notes: { type: "string" } },
      required: ["title", "date", "time"],
    },
  },
  {
    name: "delete_my_calendar_event",
    description: "Delete an event from this employee's own Google Calendar, found by title.",
    input_schema: { type: "object", properties: { title: { type: "string" }, date: { type: "string", description: "YYYY-MM-DD, narrows the search" } }, required: ["title"] },
  },
  {
    name: "get_weather",
    description: "Current weather and conditions at the business's location — use for 'what's the weather', 'is it going to rain', 'should we work today', etc.",
    input_schema: { type: "object", properties: {} },
  },
  {
    name: "notify_upcoming_customers_running_late",
    description: "Text the next customer(s) on THIS employee's own schedule TODAY to say the crew is running behind. Use for 'text my next few clients I'm running late' — never touches any other employee's jobs.",
    input_schema: {
      type: "object",
      properties: {
        count: { type: "number", description: "how many upcoming customers to text, default 3" },
        minutesLate: { type: "number", description: "how many minutes behind, default 30" },
        message: { type: "string", description: "optional custom wording — otherwise a standard running-late message is used" },
      },
    },
  },
  // FEATURE — owner-grantable, off by default (Employees → this employee →
  // Permissions → "Message customers via Alfred", nested under Text
  // Alfred). Scoped identical to the running-late tool above: only a
  // customer on one of THIS employee's OWN current/upcoming jobs, never an
  // arbitrary lookup — same "can only act on their own record" philosophy
  // this whole agent follows, just extended to a custom message instead of
  // the fixed running-late wording.
  {
    name: "text_my_customer",
    description: "Send a custom SMS to a customer on one of YOUR OWN jobs (today or upcoming) — use for 'text [customer] and tell them [anything]'. Only works for a customer you're actually assigned to; won't work for anyone else's customer.",
    input_schema: {
      type: "object",
      properties: { customerName: { type: "string" }, message: { type: "string" } },
      required: ["customerName", "message"],
    },
  },
];

const getEmployeeGoogleToken = async (ctx: Ctx, employee: any): Promise<string | null> => {
  if (!employee.google_refresh_token && !employee.google_token) return null;
  let accessToken = employee.google_token || "";
  if (employee.google_refresh_token && (!employee.google_token_expires_at || Date.now() > Number(employee.google_token_expires_at) - 60000)) {
    try {
      const refreshRes = await fetch(`${ctx.origin}/api/google-refresh`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ refresh_token: employee.google_refresh_token }),
      });
      const data = await refreshRes.json().catch(() => null) as any;
      if (refreshRes.ok && data?.access_token) accessToken = data.access_token;
    } catch { /* fall through with whatever token we have */ }
  }
  return accessToken || null;
};

const executeTool = async (ctx: Ctx, employee: any, name: string, input: Record<string, any>): Promise<any> => {
  try {
    switch (name) {
      case "clock_in": {
        if (employee.dayClockInAt) return { error: "Already clocked in for today." };
        const patch = { dayClockInAt: Date.now(), dayLunchStartAt: null, dayPausedMinutes: 0 };
        const res = await fetch(`${SUPABASE_URL}/rest/v1/employees?id=eq.${encodeURIComponent(employee.id)}`, {
          method: "PATCH", headers: { ...ctx.authHeaders, "Content-Type": "application/json", Prefer: "return=minimal" }, body: JSON.stringify(patch),
        });
        if (!res.ok) return { error: (await res.text().catch(() => "")).slice(0, 200) };
        return { success: true, clockedInAt: patch.dayClockInAt };
      }
      case "clock_out": {
        if (!employee.dayClockInAt) return { error: "Not currently clocked in." };
        const elapsedMs = Date.now() - Number(employee.dayClockInAt) - (Number(employee.dayPausedMinutes) || 0) * 60000;
        const hours = Math.round((elapsedMs / 3600000) * 100) / 100;
        const patch = { dayClockInAt: null, dayLunchStartAt: null, dayPausedMinutes: 0, lastShiftHours: hours, lastShiftDate: shiftDayStr() };
        const res = await fetch(`${SUPABASE_URL}/rest/v1/employees?id=eq.${encodeURIComponent(employee.id)}`, {
          method: "PATCH", headers: { ...ctx.authHeaders, "Content-Type": "application/json", Prefer: "return=minimal" }, body: JSON.stringify(patch),
        });
        if (!res.ok) {
          // Safe-column retry (docs/ARCHITECTURE.md) — lastShiftHours/lastShiftDate may
          // not exist on an older deployment; dayClockInAt must still clear.
          const core = { dayClockInAt: null, dayLunchStartAt: null, dayPausedMinutes: 0 };
          const retry = await fetch(`${SUPABASE_URL}/rest/v1/employees?id=eq.${encodeURIComponent(employee.id)}`, {
            method: "PATCH", headers: { ...ctx.authHeaders, "Content-Type": "application/json", Prefer: "return=minimal" }, body: JSON.stringify(core),
          });
          if (!retry.ok) return { error: (await retry.text().catch(() => "")).slice(0, 200) };
        }
        return { success: true, hoursWorked: hours };
      }
      case "get_my_hours": {
        if (employee.dayClockInAt) {
          const elapsedMs = Date.now() - Number(employee.dayClockInAt) - (Number(employee.dayPausedMinutes) || 0) * 60000;
          return { success: true, clockedIn: true, hoursSoFarToday: Math.round((elapsedMs / 3600000) * 100) / 100 };
        }
        return { success: true, clockedIn: false, lastShiftHours: employee.lastShiftHours ?? null, lastShiftDate: employee.lastShiftDate ?? null };
      }
      case "get_my_earnings": {
        const rate = Number(employee.hourlyRate) || 0;
        if (!rate) return { success: false, error: "No hourly rate is on file for this employee — ask the owner to set one in Employees." };
        if (employee.dayClockInAt) {
          const elapsedMs = Date.now() - Number(employee.dayClockInAt) - (Number(employee.dayPausedMinutes) || 0) * 60000;
          const hoursSoFar = Math.round((elapsedMs / 3600000) * 100) / 100;
          return { success: true, status: "still clocked in today", hourlyRate: rate, hoursSoFarToday: hoursSoFar, estimatedPayToday: Math.round(hoursSoFar * rate * 100) / 100 };
        }
        if (!employee.lastShiftHours) return { success: true, status: "no completed shift on file yet", hourlyRate: rate };
        // NOTE — only the most recently completed shift is tracked per
        // employee (no historical per-day hours log exists yet), so this can
        // answer "what did I make on my last shift" accurately but NOT a
        // true month-to-date total. Being explicit about that scope here so
        // the agent doesn't imply a monthly figure it doesn't actually have.
        return {
          success: true, status: "most recently completed shift", lastShiftDate: employee.lastShiftDate ?? null,
          hourlyRate: rate, lastShiftHours: employee.lastShiftHours,
          lastShiftPay: Math.round(Number(employee.lastShiftHours) * rate * 100) / 100,
          note: "Only the most recent shift is tracked — this is not a month-to-date total.",
        };
      }
      case "get_weather": {
        if (!ctx.owmKey) return { success: false, error: "No weather API key configured (Settings → Company → Weather)." };
        let location = (ctx.weatherLocation || "").trim();
        if (!location) {
          const parts = (ctx.companyAddress || "").split(",").map(s => s.trim()).filter(Boolean);
          if (parts.length >= 2) {
            const city = parts[1];
            const stateSeg = parts[parts.length - 1].replace(/\d+/g, "").trim();
            location = stateSeg ? `${city},${stateSeg}` : city;
          }
        }
        if (!location) location = "York,PA,US";
        const locParam = /^\d{5}$/.test(location) ? `zip=${location},US` : `q=${encodeURIComponent(location)}`;
        const res = await fetch(`https://api.openweathermap.org/data/2.5/weather?${locParam}&units=imperial&appid=${ctx.owmKey}`);
        if (!res.ok) {
          const err = await res.json().catch(() => ({} as any));
          return { success: false, error: err?.message || `Weather API error ${res.status}` };
        }
        const data = await res.json() as any;
        return {
          success: true, location,
          tempF: Math.round(data.main?.temp), feelsLikeF: Math.round(data.main?.feels_like),
          condition: data.weather?.[0]?.description || "", windMph: Math.round(data.wind?.speed), humidity: data.main?.humidity,
        };
      }
      case "list_my_upcoming_jobs": {
        const days = Math.max(1, Math.min(30, Number(input.days) || 7));
        const start = new Date().toISOString().slice(0, 10);
        const end = new Date(); end.setDate(end.getDate() + days);
        // BUG FIX — this select never included `crew`, so the filter right
        // below it (Array.isArray(j.crew) ? j.crew.includes(employee.id) ...)
        // always evaluated against undefined and returned zero jobs no
        // matter what — "what's on my schedule" always came back empty.
        const rows = await sbGet(ctx, `jobs?select=id,customerName,status,scheduledDate,scheduledTime,address,crew${ownerScope(ctx)}&scheduledDate=gte.${start}&scheduledDate=lt.${end.toISOString().slice(0, 10)}&limit=200`);
        const mine = rows.filter((j: any) => Array.isArray(j.crew) ? j.crew.includes(employee.id) : false).filter((j: any) => j.status !== "cancelled" && j.status !== "completed");
        if (mine.length === 0) return { success: true, jobs: [], summary: "Nothing on your schedule in that window." };
        return { success: true, jobs: mine.sort((a: any, b: any) => (a.scheduledDate + (a.scheduledTime || "")).localeCompare(b.scheduledDate + (b.scheduledTime || ""))).map((j: any) => ({ date: j.scheduledDate, time: j.scheduledTime, customer: j.customerName, address: j.address })) };
      }
      case "notify_upcoming_customers_running_late": {
        const count = Math.max(1, Math.min(10, Number(input.count) || 3));
        const minutesLate = Number(input.minutesLate) || 30;
        const todayStr = shiftDayStr();
        const rows = await sbGet(ctx, `jobs?select=id,customerId,customerName,status,scheduledDate,scheduledTime${ownerScope(ctx)}&scheduledDate=eq.${todayStr}&limit=200`);
        const mine = rows
          .filter((j: any) => Array.isArray(j.crew) ? j.crew.includes(employee.id) : false)
          .filter((j: any) => j.status !== "cancelled" && j.status !== "completed" && j.customerId)
          .sort((a: any, b: any) => (a.scheduledTime || "").localeCompare(b.scheduledTime || ""));
        if (mine.length === 0) return { error: "No more jobs on your schedule today to notify." };
        const targets = mine.slice(0, count);
        const custIds = targets.map((j: any) => j.customerId);
        const custs = await sbGet(ctx, `customers?id=in.(${custIds.map(encodeURIComponent).join(",")})&select=id,firstName,lastName,phone`);
        const results: any[] = [];
        for (const j of targets) {
          const c = custs.find((x: any) => x.id === j.customerId);
          if (!c?.phone) { results.push({ customer: j.customerName, error: "no phone on file" }); continue; }
          const body = input.message
            ? String(input.message)
            : `Hi ${c.firstName || ""}, this is ${ctx.companyName} — we're running about ${minutesLate} minutes behind schedule today. Thanks for your patience!`;
          const res = await sendCustomerSms(ctx, c.phone, body, { name: `${c.firstName || ""} ${c.lastName || ""}`.trim(), customerId: c.id });
          results.push({ customer: j.customerName, ...(res.ok ? { sent: true } : { error: res.error }) });
        }
        const sentCount = results.filter(r => r.sent).length;
        return { success: true, sentCount, totalTargeted: targets.length, results };
      }
      case "text_my_customer": {
        if (!employee.permissions?.can_text_alfred_message_customers) {
          return { error: "You don't have permission to message customers through Alfred — ask the owner to turn it on in Employees → Permissions." };
        }
        if (!input.customerName || !input.message) return { error: "customerName and message required" };
        // Scope check: must be a customer on one of THIS employee's own
        // current/upcoming jobs — same rule notify_upcoming_customers_
        // running_late already enforces, just for an arbitrary message.
        const rows = await sbGet(ctx, `jobs?select=customerId,customerName,status,scheduledDate,crew${ownerScope(ctx)}&limit=500`);
        const mine = rows.filter((j: any) => Array.isArray(j.crew) && j.crew.includes(employee.id) && j.status !== "cancelled" && j.customerId);
        const q = String(input.customerName).toLowerCase().trim();
        const match = mine.find((j: any) => (j.customerName || "").toLowerCase() === q) || mine.find((j: any) => (j.customerName || "").toLowerCase().includes(q));
        if (!match) return { error: `"${input.customerName}" isn't a customer on any of your own jobs — you can only message customers you're assigned to.` };
        const cust = (await sbGet(ctx, `customers?id=eq.${encodeURIComponent(match.customerId)}&select=id,firstName,lastName,phone`))[0];
        if (!cust?.phone) return { error: `No phone on file for ${match.customerName}.` };
        const res = await sendCustomerSms(ctx, cust.phone, input.message, { name: `${cust.firstName || ""} ${cust.lastName || ""}`.trim(), customerId: cust.id });
        if (!res.ok) return { error: res.error };
        return { success: true, sentTo: match.customerName };
      }
      case "add_my_calendar_event": {
        const token = await getEmployeeGoogleToken(ctx, employee);
        if (!token) return { error: "You haven't connected Google Calendar — connect it from your portal's Google tab first." };
        const startDate = new Date(`${input.date}T${input.time}:00`);
        if (isNaN(startDate.getTime())) return { error: "Couldn't parse that date/time." };
        const endDate = new Date(startDate.getTime() + (Number(input.durationMinutes) || 60) * 60000);
        const res = await fetch("https://www.googleapis.com/calendar/v3/calendars/primary/events", {
          method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
          body: JSON.stringify({ summary: input.title, description: input.notes || "", start: { dateTime: startDate.toISOString() }, end: { dateTime: endDate.toISOString() } }),
        });
        if (!res.ok) return { error: "Google Calendar error: " + (await res.text().catch(() => "")).slice(0, 200) };
        const data = await res.json().catch(() => null) as any;
        return { success: true, eventId: data?.id, title: input.title };
      }
      case "delete_my_calendar_event": {
        const token = await getEmployeeGoogleToken(ctx, employee);
        if (!token) return { error: "You haven't connected Google Calendar." };
        const now = new Date(); const farOut = new Date(now.getTime() + 90 * 24 * 3600000);
        const listRes = await fetch(`https://www.googleapis.com/calendar/v3/calendars/primary/events?timeMin=${encodeURIComponent(now.toISOString())}&timeMax=${encodeURIComponent(farOut.toISOString())}&singleEvents=true&maxResults=100`, { headers: { Authorization: `Bearer ${token}` } });
        const listData = await listRes.json().catch(() => null) as any;
        const q = String(input.title || "").toLowerCase();
        const match = (listData?.items || []).find((ev: any) => (ev.summary || "").toLowerCase().includes(q) && (!input.date || (ev.start?.dateTime || ev.start?.date || "").slice(0, 10) === input.date));
        if (!match) return { error: `No event found matching "${input.title}".` };
        await fetch(`https://www.googleapis.com/calendar/v3/calendars/primary/events/${encodeURIComponent(match.id)}`, { method: "DELETE", headers: { Authorization: `Bearer ${token}` } });
        return { success: true, deleted: true };
      }
      default:
        return { error: `Unknown tool "${name}".` };
    }
  } catch (e: any) {
    return { error: e?.message || "Tool failed." };
  }
};

const callModel = async (modelKey: string, apiKey: string, systemPrompt: string, messages: Array<{ role: string; content: any }>, tools: any[]): Promise<{ text: string; toolUses: Array<{ id: string; name: string; input: any }>; stopReason: string; raw: unknown }> => {
  const def = effectiveModel(modelKey, SMS_MODELS[modelKey]);
  if (def.provider === "anthropic") {
    const res = await fetch(def.endpoint, { method: "POST", headers: { "Content-Type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01" }, body: JSON.stringify({ model: def.modelId, max_tokens: def.maxTokens, system: systemPrompt, messages, tools }) });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json() as any;
    const text = data.content?.find((b: any) => b.type === "text")?.text ?? "";
    const toolUses = (data.content ?? []).filter((b: any) => b.type === "tool_use").map((b: any) => ({ id: b.id, name: b.name, input: b.input ?? {} }));
    return { text, toolUses, stopReason: data.stop_reason ?? "end_turn", raw: data.content };
  }
  if (def.provider === "google") {
    const contents = messages.map((m: any) => {
      if (typeof m.content === "string") return { role: m.role === "assistant" ? "model" : "user", parts: [{ text: m.content }] };
      if (Array.isArray(m.content) && m.content[0]?.type === "tool_result") return { role: "user", parts: m.content.map((tr: any) => ({ functionResponse: { name: tr.tool_use_id, response: (() => { try { return JSON.parse(tr.content); } catch { return { result: tr.content }; } })() } })) };
      return { role: "model", parts: m.content };
    });
    const geminiTools = tools.length ? [{ functionDeclarations: tools.map((t: any) => ({ name: t.name, description: t.description, parameters: t.input_schema })) }] : undefined;
    const res = await fetch(`${def.endpoint}?key=${apiKey}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ contents, ...(geminiTools ? { tools: geminiTools } : {}), generationConfig: { maxOutputTokens: def.maxTokens, thinkingConfig: { thinkingBudget: 0 } }, systemInstruction: { parts: [{ text: systemPrompt }] } }) });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json() as any;
    const parts = data.candidates?.[0]?.content?.parts ?? [];
    const text = parts.filter((p: any) => typeof p.text === "string").map((p: any) => p.text).join("");
    const toolUses = parts.filter((p: any) => p.functionCall).map((p: any) => ({ id: p.functionCall.name, name: p.functionCall.name, input: p.functionCall.args ?? {} }));
    return { text, toolUses, stopReason: toolUses.length ? "tool_use" : "end_turn", raw: parts.length ? parts : [{ text }] };
  }
  const openAiMessages = [{ role: "system", content: systemPrompt }, ...messages.map((m: any) => {
    if (typeof m.content === "string") return { role: m.role, content: m.content };
    if (Array.isArray(m.content) && m.content[0]?.type === "tool_result") return m.content.map((tr: any) => ({ role: "tool", tool_call_id: tr.tool_use_id, content: tr.content }));
    return m.content;
  }).flat()];
  const openAiTools = tools.length ? tools.map((t: any) => ({ type: "function", function: { name: t.name, description: t.description, parameters: t.input_schema } })) : undefined;
  const res = await fetch(def.endpoint, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` }, body: JSON.stringify({ model: def.modelId, max_tokens: def.maxTokens, messages: openAiMessages, ...(openAiTools ? { tools: openAiTools } : {}) }) });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json() as any;
  const choice = data.choices?.[0]?.message;
  const toolUses = (choice?.tool_calls ?? []).map((tc: any) => ({ id: tc.id, name: tc.function?.name, input: (() => { try { return JSON.parse(tc.function?.arguments || "{}"); } catch { return {}; } })() }));
  return { text: choice?.content ?? "", toolUses, stopReason: toolUses.length ? "tool_use" : "end_turn", raw: choice ?? { role: "assistant", content: "" } };
};

export const runAlfredEmployeeAgent = async (
  ctx: Ctx,
  employee: any,
  modelKeys: Record<string, string>,
  modelPriority: string[] | undefined,
  incomingText: string,
): Promise<string> => {
  const chain = (modelPriority && modelPriority.length ? modelPriority : DEFAULT_PRIORITY).filter(m => SMS_MODELS[m] && !!modelKeys?.[m]);
  if (chain.length === 0) return "Alfred over text isn't set up yet — ask your boss to add an AI model API key in Settings → AI Models.";

  const systemPrompt = `You are Alfred, texting with ${employee.firstName || "an employee"}, a member of the ${ctx.companyName} crew. Keep replies short (this is a text, 1-3 sentences, no markdown).

You can ONLY act on THIS employee's own record and THEIR OWN assigned jobs' customers — never mention or look up other employees, other business data, or any customer not on one of their own jobs today, you don't have tools for any of that here. You can: clock them in/out (clock_in/clock_out), check their hours (get_my_hours), list their own upcoming jobs (list_my_upcoming_jobs), add/delete events on their own connected Google Calendar (add_my_calendar_event/delete_my_calendar_event — tell them to connect it from their portal's Google tab if not connected), and text the next customer(s) on THEIR OWN schedule today that the crew is running behind (notify_upcoming_customers_running_late — e.g. "text my next 3 clients I'm running late"). If a tool result has an "error", tell them exactly what went wrong — never claim something succeeded unless the tool actually said so.`;

  let finalText = "";
  for (const modelKey of chain) {
    const apiKey = modelKeys[modelKey];
    let convMessages: Array<{ role: string; content: any }> = [{ role: "user", content: incomingText }];
    let rounds = 0;
    let localFinal = "";
    let failed = false;
    while (rounds < 6) {
      rounds++;
      try {
        const result = await callModel(modelKey, apiKey, systemPrompt, convMessages, TOOLS);
        if (result.text) localFinal = result.text;
        if (result.toolUses.length > 0 && result.stopReason === "tool_use") {
          convMessages.push({ role: "assistant", content: result.raw });
          const results = await Promise.all(result.toolUses.map(async (tu) => ({
            type: "tool_result", tool_use_id: tu.id, content: JSON.stringify(await executeTool(ctx, employee, tu.name, tu.input || {})),
          })));
          convMessages.push({ role: "user", content: results });
          continue;
        }
        break;
      } catch (e: any) {
        console.error(`[AlfredEmployeeAgent] ${modelKey} failed:`, e?.message);
        failed = true;
        break;
      }
    }
    if (!failed) { finalText = localFinal; break; }
  }
  return finalText || "Got it.";
};
