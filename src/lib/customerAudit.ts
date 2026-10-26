// Whole-customer-base search for Alfred (in-app chat and text-Alfred both
// import this — functions/ bundles it straight from src/lib).
//
// FEATURE — "check my entire client base for duplicate names", "do I have
// anyone like this", "which customers are missing info". Alfred used to only
// search by an exact name fragment, so it told the owner it could only check
// names they gave it. These run over every customer at once.
//
// Pure functions, no browser or server APIs.

export type AuditCustomer = {
  id: string; firstName?: string; lastName?: string; email?: string; phone?: string; address?: string;
  city?: string; state?: string; zip?: string; company?: string; notes?: string; tags?: string[];
  leadSource?: string; totalSpent?: number; birthday?: string; createdAt?: string; pipelineStage?: string | null;
  smsOptOut?: boolean; [k: string]: any;
};
export type AuditJob = { customerId?: string; scheduledDate?: string; completedAt?: string; status?: string; amount?: number };

const norm = (s: any) => String(s || "").toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9@. ]+/g, " ").replace(/\s+/g, " ").trim();
const digits = (p: any) => { const d = String(p || "").replace(/\D/g, ""); return d.length === 11 && d[0] === "1" ? d.slice(1) : d; };
export const fullName = (c: AuditCustomer) => `${c.firstName || ""} ${c.lastName || ""}`.replace(/\s+/g, " ").trim();
const brief = (c: AuditCustomer) => ({ id: c.id, name: fullName(c) || "(no name)", phone: c.phone || "", email: c.email || "", address: c.address || "" });

// Common nicknames, so "Bill Smith" and "William Smith" read as possibly the same person.
const NICK: Record<string, string> = {
  bill: "william", will: "william", billy: "william", liam: "william", bob: "robert", rob: "robert", bobby: "robert", robbie: "robert",
  jim: "james", jimmy: "james", jamie: "james", mike: "michael", mikey: "michael", mick: "michael", dave: "david", davey: "david",
  steve: "steven", stephen: "steven", chris: "christopher", tom: "thomas", tommy: "thomas", joe: "joseph", joey: "joseph",
  dan: "daniel", danny: "daniel", matt: "matthew", tony: "anthony", nick: "nicholas", rick: "richard", rich: "richard", dick: "richard",
  ed: "edward", eddie: "edward", ted: "edward", ken: "kenneth", kenny: "kenneth", jeff: "jeffrey", greg: "gregory", pat: "patrick",
  sam: "samuel", ben: "benjamin", andy: "andrew", drew: "andrew", alex: "alexander", jon: "jonathan", john: "jonathan", johnny: "jonathan",
  kate: "katherine", katie: "katherine", kathy: "katherine", cathy: "katherine", liz: "elizabeth", beth: "elizabeth", betty: "elizabeth",
  sue: "susan", susie: "susan", jen: "jennifer", jenny: "jennifer", meg: "margaret", peggy: "margaret", maggie: "margaret",
  barb: "barbara", deb: "deborah", debbie: "deborah", pam: "pamela", cindy: "cynthia", becky: "rebecca", vicky: "victoria", abby: "abigail",
};
const canon = (w: string) => NICK[w] || w;

// Edit distance, capped — only small distances matter here.
export function editDistance(a: string, b: string, cap = 3): number {
  if (a === b) return 0;
  if (Math.abs(a.length - b.length) > cap) return cap + 1;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    let rowMin = i;
    for (let j = 1; j <= b.length; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      rowMin = Math.min(rowMin, cur[j]);
    }
    if (rowMin > cap) return cap + 1;
    prev = cur;
  }
  return prev[b.length];
}
// American Soundex — catches "Smith"/"Smyth", "Katherine"/"Catherine"-ish spellings.
export function soundex(s: string): string {
  const w = norm(s).replace(/[^a-z]/g, "");
  if (!w) return "";
  const code: Record<string, string> = { b: "1", f: "1", p: "1", v: "1", c: "2", g: "2", j: "2", k: "2", q: "2", s: "2", x: "2", z: "2", d: "3", t: "3", l: "4", m: "5", n: "5", r: "6" };
  let out = w[0].toUpperCase(), last = code[w[0]] || "";
  for (let i = 1; i < w.length && out.length < 4; i++) {
    const c = code[w[i]] || "";
    if (c && c !== last) out += c;
    if (w[i] !== "h" && w[i] !== "w") last = c;
  }
  return out.padEnd(4, "0");
}
const similarWord = (a: string, b: string) => {
  if (!a || !b) return false;
  if (a === b || canon(a) === canon(b)) return true;
  if (a.length >= 4 && b.length >= 4 && editDistance(a, b, 2) <= (Math.min(a.length, b.length) >= 7 ? 2 : 1)) return true;
  return a.length >= 3 && b.length >= 3 && soundex(a) === soundex(b) && a[0] === b[0] && Math.abs(a.length - b.length) <= 2;
};

// ── Duplicates ──────────────────────────────────────────────────────────────
export type DuplicateGroup = { reason: string; strength: "certain" | "likely" | "possible"; customers: ReturnType<typeof brief>[] };

export function findDuplicateCustomers(list: AuditCustomer[], opts: { includePossible?: boolean; limit?: number } = {}): { groups: DuplicateGroup[]; customersChecked: number } {
  const groups: DuplicateGroup[] = [];
  const seenPair = new Set<string>();
  const add = (reason: string, strength: DuplicateGroup["strength"], members: AuditCustomer[]) => {
    const uniq = Array.from(new Map(members.map(m => [m.id, m])).values());
    if (uniq.length < 2) return;
    const key = uniq.map(m => m.id).sort().join("|");
    if (seenPair.has(key)) return;
    seenPair.add(key);
    groups.push({ reason, strength, customers: uniq.map(brief) });
  };
  const bucket = (keyOf: (c: AuditCustomer) => string) => {
    const m = new Map<string, AuditCustomer[]>();
    for (const c of list) { const k = keyOf(c); if (k) m.set(k, [...(m.get(k) || []), c]); }
    return m;
  };
  bucket(c => digits(c.phone).length >= 10 ? digits(c.phone) : "").forEach((g, k) => add(`same phone ${k.replace(/(\d{3})(\d{3})(\d{4})/, "($1) $2-$3")}`, "certain", g));
  bucket(c => norm(c.email).includes("@") ? norm(c.email) : "").forEach((g, k) => add(`same email ${k}`, "certain", g));
  bucket(c => { const n = norm(fullName(c)); return n.includes(" ") ? n : ""; }).forEach((g, k) => add(`same name "${fullName(g[0])}"`, "likely", g));
  bucket(c => { const n = norm(fullName(c)).split(" "); return n.length >= 2 ? `${canon(n[0])} ${n[n.length - 1]}` : ""; }).forEach(g => add(`same person, nickname ("${g.map(fullName).join('" / "')}")`, "likely", g));
  bucket(c => { const a = norm(c.address).replace(/\b(street|st|road|rd|avenue|ave|lane|ln|drive|dr|court|ct)\b/g, "").replace(/\s+/g, " ").trim(); return /^\d+ \w/.test(a) ? a.split(" ").slice(0, 3).join(" ") : ""; })
    .forEach(g => add(`same address (${g[0].address})`, "possible", g));
  if (opts.includePossible !== false) {
    // Similar spellings: compare within the same last-name sound to keep it fast.
    const byLastSound = bucket(c => { const p = norm(fullName(c)).split(" "); return p.length >= 2 ? soundex(p[p.length - 1]) : ""; });
    byLastSound.forEach(g => {
      if (g.length > 400) return;
      for (let i = 0; i < g.length; i++) for (let j = i + 1; j < g.length; j++) {
        const a = norm(fullName(g[i])).split(" "), b = norm(fullName(g[j])).split(" ");
        if (norm(fullName(g[i])) === norm(fullName(g[j]))) continue;
        if (similarWord(a[0], b[0]) && similarWord(a[a.length - 1], b[b.length - 1])) add(`similar names ("${fullName(g[i])}" / "${fullName(g[j])}")`, "possible", [g[i], g[j]]);
      }
    });
  }
  const order = { certain: 0, likely: 1, possible: 2 };
  groups.sort((x, y) => order[x.strength] - order[y.strength]);
  return { groups: groups.slice(0, opts.limit || 200), customersChecked: list.length };
}

// ── Fuzzy search across everything ──────────────────────────────────────────
// "Someone named Jon on Oak St", "a guy with a 555 number from Springfield", a
// misspelled name, part of an email or phone — every word is matched against
// every field, with typo/nickname/sound-alike tolerance on names.
export function searchCustomers(list: AuditCustomer[], query: string, limit = 25): { total: number; results: (ReturnType<typeof brief> & { score: number; matched: string[] })[] } {
  const words = norm(query).split(" ").filter(w => w.length >= 2 && !["a", "an", "the", "and", "or", "with", "from", "on", "in", "at", "named", "called", "customer", "customers", "client", "someone", "person", "guy", "lady", "like"].includes(w));
  const qDigits = String(query).replace(/\D/g, "");
  if (!words.length && qDigits.length < 3) return { total: 0, results: [] };
  const scored: any[] = [];
  for (const c of list) {
    const nameWords = norm(fullName(c)).split(" ").filter(Boolean);
    const fields: [string, string][] = [
      ["email", norm(c.email)], ["address", norm([c.address, c.city, c.state, c.zip].filter(Boolean).join(" "))],
      ["company", norm(c.company)], ["notes", norm(c.notes)], ["tags", norm((c.tags || []).join(" "))], ["source", norm(c.leadSource)],
    ];
    let score = 0; const matched = new Set<string>(); let missed = 0;
    for (const w of words) {
      let hit = false;
      if (nameWords.some(n => n === w || canon(n) === canon(w))) { score += 10; matched.add("name"); hit = true; }
      else if (nameWords.some(n => n.startsWith(w) && w.length >= 3)) { score += 7; matched.add("name"); hit = true; }
      else if (nameWords.some(n => similarWord(n, w))) { score += 5; matched.add("name (similar spelling)"); hit = true; }
      for (const [label, val] of fields) if (val && (` ${val} `).includes(` ${w}`)) { score += label === "notes" ? 2 : 4; matched.add(label); hit = true; }
      if (!hit) missed++;
    }
    if (qDigits.length >= 3 && digits(c.phone).includes(qDigits)) { score += qDigits.length >= 7 ? 12 : 4; matched.add("phone"); }
    else if (qDigits.length >= 3 && !words.length) continue;
    if (score === 0) continue;
    // Most words should hit something, or it's noise.
    if (words.length >= 2 && missed > Math.floor(words.length / 2)) continue;
    scored.push({ ...brief(c), score: score - missed * 3, matched: Array.from(matched) });
  }
  scored.sort((a, b) => b.score - a.score);
  return { total: scored.length, results: scored.slice(0, limit) };
}

// ── Missing information ─────────────────────────────────────────────────────
export const AUDIT_FIELDS = ["phone", "email", "address", "lastName", "birthday", "leadSource"] as const;
export function customersMissingInfo(list: AuditCustomer[], fields: string[] = ["phone", "email", "address"], limit = 50) {
  const want = fields.length ? fields : ["phone", "email", "address"];
  const isMissing = (c: AuditCustomer, f: string) => f === "phone" ? digits(c.phone).length < 10 : f === "email" ? !String(c.email || "").includes("@") : !String(c[f] ?? "").trim();
  const counts: Record<string, number> = {};
  want.forEach(f => { counts[f] = list.filter(c => isMissing(c, f)).length; });
  const rows = list.map(c => ({ c, missing: want.filter(f => isMissing(c, f)) })).filter(r => r.missing.length)
    .sort((a, b) => b.missing.length - a.missing.length);
  return {
    customersChecked: list.length, missingCounts: counts, customersWithGaps: rows.length,
    noWayToContact: list.filter(c => digits(c.phone).length < 10 && !String(c.email || "").includes("@")).length,
    customers: rows.slice(0, limit).map(r => ({ ...brief(r.c), missing: r.missing })),
  };
}

// ── "Customers like this" — filter by what's known about them ──────────────
export type CustomerFilter = {
  city?: string; tag?: string; leadSource?: string; minSpent?: number; maxSpent?: number;
  noServiceInDays?: number; servicedWithinDays?: number; hasJobs?: boolean; isLead?: boolean; createdAfter?: string; createdBefore?: string;
  textContains?: string; hasBirthdayThisMonth?: boolean; optedOutOfTexts?: boolean;
};
export function filterCustomers(list: AuditCustomer[], jobs: AuditJob[], f: CustomerFilter, limit = 50) {
  const lastService = new Map<string, string>();
  const jobCount = new Map<string, number>();
  for (const j of jobs) {
    if (!j.customerId || j.status === "cancelled") continue;
    jobCount.set(j.customerId, (jobCount.get(j.customerId) || 0) + 1);
    const d = String(j.completedAt || (j.status === "completed" ? j.scheduledDate : "") || "").slice(0, 10);
    if (d && d > (lastService.get(j.customerId) || "")) lastService.set(j.customerId, d);
  }
  const daysAgo = (n: number) => new Date(Date.now() - n * 86400000).toISOString().slice(0, 10);
  const month = new Date().toISOString().slice(5, 7);
  const out = list.filter(c => {
    if (f.city && !norm([c.city, c.address].join(" ")).includes(norm(f.city))) return false;
    if (f.tag && !(c.tags || []).some(t => norm(t) === norm(f.tag))) return false;
    if (f.leadSource && !norm(c.leadSource).includes(norm(f.leadSource))) return false;
    if (f.minSpent != null && (Number(c.totalSpent) || 0) < f.minSpent) return false;
    if (f.maxSpent != null && (Number(c.totalSpent) || 0) > f.maxSpent) return false;
    if (f.hasJobs != null && (jobCount.get(c.id) || 0) > 0 !== f.hasJobs) return false;
    if (f.isLead != null && (c.pipelineStage === "lead") !== f.isLead) return false;
    if (f.noServiceInDays != null) { const ls = lastService.get(c.id); if (ls && ls > daysAgo(f.noServiceInDays)) return false; }
    if (f.servicedWithinDays != null) { const ls = lastService.get(c.id); if (!ls || ls < daysAgo(f.servicedWithinDays)) return false; }
    if (f.createdAfter && String(c.createdAt || "") < f.createdAfter) return false;
    if (f.createdBefore && String(c.createdAt || "") > f.createdBefore) return false;
    if (f.textContains && !norm([fullName(c), c.notes, c.company, (c.tags || []).join(" "), c.address].join(" ")).includes(norm(f.textContains))) return false;
    if (f.hasBirthdayThisMonth && !String(c.birthday || "").match(new RegExp(`-${month}-\\d{2}$`))) return false;
    if (f.optedOutOfTexts != null && !!c.smsOptOut !== f.optedOutOfTexts) return false;
    return true;
  });
  return {
    total: out.length,
    customers: out.slice(0, limit).map(c => ({ ...brief(c), totalSpent: Number(c.totalSpent) || 0, jobs: jobCount.get(c.id) || 0, lastService: lastService.get(c.id) || null, tags: c.tags || [] })),
  };
}
