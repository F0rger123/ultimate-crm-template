// Turns a raw Alfred / AI-provider error into something a person can act on.
//
// FEATURE (user report — "when Alfred has an API error or any error while
// you're messaging, it shouldn't show the error in the chat; it should be a
// pop-up and a notification saying something went wrong, or the API ran
// out"). The raw text ("HTTP 429: …", "Tried 3 model(s): …") used to be
// posted into the conversation as if Alfred had said it. Now it goes to a
// pop-up and the bell (AlfredPage.tsx → AlfredErrorPopup), worded by kind.

export type AlfredErrorKind = "credit" | "limit" | "key" | "no_ai" | "timeout" | "network" | "file" | "other";

export type AlfredError = {
  kind: AlfredErrorKind;
  title: string;
  message: string;
  details: string;      // the raw error, for the Details section
  retryText?: string;   // what the owner sent, so Try again can resend it
  at: number;
};

const has = (s: string, re: RegExp) => re.test(s);

export function classifyAlfredError(raw: unknown, opts: { retryText?: string; file?: boolean } = {}): AlfredError {
  const details = String((raw as any)?.message ?? raw ?? "").trim() || "Unknown error";
  const s = details.toLowerCase();
  const base = { details, retryText: opts.retryText, at: Date.now() };
  // Order matters: "out of credit" also says 402/billing, a rate limit also says 429.
  if (has(s, /credit|billing|insufficient|balance|payment required|\b402\b|out of funds|exceeded your current quota|plan limit/))
    return { ...base, kind: "credit", title: "The AI ran out of credit", message: "Your AI provider says the account is out of credit or over its plan. Add credit with that provider, or put another provider first in Settings → AI Models." };
  if (has(s, /rate.?limit|\b429\b|too many requests|quota|resource.?exhausted|rate-limited|resets in/))
    return { ...base, kind: "limit", title: "The AI hit its usage limit", message: "Too many requests for now. Try again in a few minutes, or add a second AI provider in Settings → AI Models so Alfred can switch automatically." };
  if (has(s, /no ai models available|no api keys set|needs an api key|add one in settings/))
    return { ...base, kind: "no_ai", title: "No AI is set up", message: "Alfred needs an AI provider key. Add one (Claude, Gemini, OpenAI, Groq, NVIDIA or OpenRouter) in Settings → AI Models." };
  if (has(s, /\b401\b|\b403\b|invalid.{0,20}key|api key.{0,20}(invalid|not valid|incorrect|rejected)|unauthorized|permission denied|authentication/))
    return { ...base, kind: "key", title: "An AI key isn't working", message: "Your AI provider rejected the key. Paste a fresh key in Settings → AI Models, or check that it hasn't been revoked." };
  if (has(s, /timed out|timeout|didn't answer in time|took too long/))
    return { ...base, kind: "timeout", title: "The AI took too long", message: "The AI didn't answer in time — it's usually busy. Try again; for big requests, a second provider in Settings → AI Models helps." };
  if (has(s, /failed to fetch|network|cors|offline|load failed|connection/))
    return { ...base, kind: "network", title: "Couldn't reach the AI", message: "The request didn't get through. Check your internet connection and try again." };
  if (opts.file)
    return { ...base, kind: "file", title: "Couldn't read that file", message: "Alfred couldn't read the file you attached. Try a clearer photo, a smaller PDF, or send it again." };
  return { ...base, kind: "other", title: "Something went wrong", message: "Alfred couldn't finish that. Try again — if it keeps happening, check Settings → AI Models → Check connections." };
}
