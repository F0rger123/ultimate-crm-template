// Reading a file someone sends Alfred (photo, screenshot, PDF) — working out
// what it is and pulling out everything in it, so Alfred can act on it.
//
// BUG FIX (user report — "attaching files, PDF sheets to Alfred should be a
// lot smarter at recognizing stuff and taking actions"). A file used to get
// one generic "describe this" read capped at 1,500 tokens: a client-list PDF
// came back as a short summary of the first few rows, and with no message
// Alfred only described the file and did nothing. Now the read:
//   - starts with a one-line JSON header saying what the file is
//     (client list, job list/schedule, receipt, bill/statement, invoice,
//     quote, property photo, other),
//   - transcribes lists COMPLETELY as a tab-separated table (continuing in
//     more requests when one answer runs out of room), so the import tools
//     get every row,
//   - and for receipts returns vendor / date / total / category.
// Kept free of React and the browser so the texting side can use the same
// prompts and parsing (functions/api/_lib/alfredSmsAgent.ts).

export type AttachmentKind = "client_list" | "job_list" | "schedule" | "receipt" | "bill_or_statement" | "invoice" | "quote" | "property_photo" | "other";
export const LIST_KINDS: AttachmentKind[] = ["client_list", "job_list", "schedule"];

export type AttachmentHeader = {
  kind: AttachmentKind; title?: string; rowCount?: number;
  receipt?: { vendor?: string; date?: string; total?: number; category?: string } | null;
};

export const END_MARK = "<<END>>";

export const READ_PROMPT = (businessType: string) => `You are Alfred, the office assistant for a ${businessType} business. Read this file carefully.

FIRST LINE: a single JSON object (no code fence) describing the file:
{"kind": "client_list" | "job_list" | "schedule" | "receipt" | "bill_or_statement" | "invoice" | "quote" | "property_photo" | "other", "title": "short description", "rowCount": number of clients/jobs/lines if it's a list, "receipt": {"vendor": "", "date": "YYYY-MM-DD", "total": 0, "category": "fuel|chemicals|equipment|supplies|repairs|meals|insurance|advertising|other"} only for a single purchase receipt, otherwise null}

client_list = a list of customers/clients (names, phones, addresses, prices…). job_list / schedule = jobs, routes or appointments (who, where, when, price, worker). bill_or_statement = a bill, bank/card statement or anything with several expense lines.

THEN:
- For client_list, job_list or schedule: the COMPLETE table as tab-separated values. First a header row, then one row per client/job — EVERY row in the file, in order, nothing summarized or skipped. Use these column names when the data exists (leave out empty ones, add others the file has): Name, Company, Phone, Email, Address, City, State, Zip, Day, Date, Time, Frequency, Price, Cans, Worker, Service, Notes.
- For bill_or_statement: one line per charge: date<TAB>description<TAB>amount.
- Anything else: a complete transcription of the useful content — names, dates, amounts, line items, totals, addresses, notes.

LAST LINE: ${END_MARK}`;

export const CONTINUE_PROMPT = (lastLine: string) => `You were transcribing this file and ran out of room. The last row you wrote was:
${lastLine}
Continue from the NEXT row, same columns, no header row, no repeats. Finish with a line containing only ${END_MARK}.`;

export function parseHeader(text: string): { header: AttachmentHeader; body: string } {
  const t = String(text || "").replace(/^```(?:json)?\s*/i, "");
  const nl = t.indexOf("\n");
  const first = (nl >= 0 ? t.slice(0, nl) : t).trim();
  const rest = nl >= 0 ? t.slice(nl + 1) : "";
  const m = first.match(/\{[\s\S]*\}/);
  if (m) {
    try {
      const h = JSON.parse(m[0]);
      if (h && typeof h.kind === "string") return { header: { ...h, kind: (h.kind as AttachmentKind) }, body: rest };
    } catch { /* not JSON — treat the whole answer as content */ }
  }
  return { header: { kind: "other" }, body: t };
}

export const isFinished = (text: string) => String(text || "").includes(END_MARK);
export const stripEnd = (text: string) => String(text || "").split(END_MARK)[0].replace(/```\s*$/g, "").trimEnd();
export const lastNonEmptyLine = (text: string) => stripEnd(text).split("\n").map(l => l.trim()).filter(Boolean).pop() || "";

// Reads one file to the end. `ask(prompt, previous?)` sends the file plus a
// prompt to a vision model and returns its text answer.
export async function readAttachmentFully(ask: (prompt: string) => Promise<string>, businessType: string, opts: { maxRounds?: number; onRound?: (n: number) => void } = {}): Promise<{ header: AttachmentHeader; body: string; complete: boolean }> {
  const first = await ask(READ_PROMPT(businessType));
  const { header, body } = parseHeader(first);
  let text = stripEnd(body);
  let complete = isFinished(first);
  const isList = LIST_KINDS.includes(header.kind) || header.kind === "bill_or_statement";
  for (let round = 2; isList && !complete && round <= (opts.maxRounds || 8); round++) {
    opts.onRound?.(round);
    const more = await ask(CONTINUE_PROMPT(lastNonEmptyLine(text)));
    const lines = stripEnd(more).split("\n").filter(l => l.trim());
    // Drop a repeated header or a repeated last row.
    const known = new Set(text.split("\n").map(l => l.trim()));
    const fresh = lines.filter(l => !known.has(l.trim()));
    if (!fresh.length) break;
    text += "\n" + fresh.join("\n");
    complete = isFinished(more);
  }
  return { header, body: text.trim(), complete };
}

export const KIND_LABEL: Record<AttachmentKind, string> = {
  client_list: "a client list", job_list: "a job list", schedule: "a schedule", receipt: "a receipt",
  bill_or_statement: "a bill/statement", invoice: "an invoice", quote: "a quote/estimate", property_photo: "a photo of a property/job", other: "a document",
};
