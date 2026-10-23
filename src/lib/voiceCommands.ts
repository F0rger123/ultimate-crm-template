// FEATURE — "voice typing while on the job should understand commands, not
// just transcribe." A field employee with gloves on/wet hands needs to say
// "I just finished this, can you send the invoice" and have the app actually
// DO something, not just drop that sentence into a text box. This is a
// small, deterministic fuzzy-phrase matcher — no ML/LLM call, so it works
// offline and instantly on top of the existing VoiceMicButton dictation
// pipeline (VoiceMicButton.tsx already gets a clean transcript; this decides
// what to do with it).
//
// Design: each command is a set of trigger phrases. A transcript matches a
// command if, after normalizing (lowercase, strip punctuation, collapse
// whitespace), it contains any trigger phrase as a substring OR is within a
// small edit-distance of one (typo/mis-hearing tolerance — "sent the
// invoice" vs "send the invoice"). `dangerous: true` commands (anything that
// sends a real message to a customer, moves money, or is otherwise hard to
// undo) must be confirmed by the caller before executing — this module only
// classifies intent, it never calls the action itself.

export type VoiceCommandId =
  | "send_invoice"
  | "open_signature"
  | "start_complete_job"
  | "on_my_way"
  | "running_late"
  | "report_problem"
  | "clock_in"
  | "clock_out";

export interface VoiceCommandMatch {
  id: VoiceCommandId;
  label: string;
  dangerous: boolean;
  /** Whatever free text followed the trigger phrase — e.g. "the ladder slipped" from "report a problem, the ladder slipped." */
  remainder: string;
}

const COMMANDS: { id: VoiceCommandId; label: string; dangerous: boolean; triggers: string[] }[] = [
  { id: "send_invoice", label: "Send the invoice", dangerous: true, triggers: [
    "send the invoice", "send invoice", "text the invoice", "send them the invoice",
    "can you send the invoice", "pull up the invoice and send it", "send payment invoice", "send the payment invoice",
  ] },
  { id: "open_signature", label: "Open the signature screen", dangerous: false, triggers: [
    "pull up the signature", "get the signature", "get their signature", "pull up signature",
    "open the signature", "have them sign", "sign off", "customer needs to sign", "pull up the section for the customer to sign",
  ] },
  { id: "start_complete_job", label: "Start completing this job", dangerous: false, triggers: [
    "i just finished this", "i'm done with this job", "i am done with this job", "mark this job done",
    "job's done", "job is done", "complete this job", "finish this job", "i finished the job", "i just walked the property",
  ] },
  { id: "on_my_way", label: "Send On My Way", dangerous: true, triggers: [
    "on my way", "i'm on my way", "let them know i'm on my way", "send on my way",
  ] },
  { id: "running_late", label: "Send Running Late", dangerous: true, triggers: [
    "running late", "i'm running late", "let them know i'm running late", "send running late",
  ] },
  { id: "report_problem", label: "Report a problem", dangerous: false, triggers: [
    "report a problem", "report an issue", "there's a problem", "we have a problem",
  ] },
  { id: "clock_in", label: "Clock in", dangerous: false, triggers: ["clock me in", "clock in", "start my shift"] },
  { id: "clock_out", label: "Clock out", dangerous: false, triggers: ["clock me out", "clock out", "end my shift"] },
];

const normalize = (s: string): string => s.toLowerCase().replace(/[^\w\s]/g, "").replace(/\s+/g, " ").trim();

// Cheap Levenshtein distance, capped — only ever called on short trigger
// phrases (a handful of words), so no need for anything fancier.
const levenshtein = (a: string, b: string): number => {
  const dp: number[][] = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 0; j <= b.length; j++) dp[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      dp[i][j] = a[i - 1] === b[j - 1] ? dp[i - 1][j - 1] : 1 + Math.min(dp[i - 1][j - 1], dp[i - 1][j], dp[i][j - 1]);
    }
  }
  return dp[a.length][b.length];
};

export function matchVoiceCommand(rawText: string): VoiceCommandMatch | null {
  const text = normalize(rawText);
  if (!text) return null;
  for (const cmd of COMMANDS) {
    for (const trigger of cmd.triggers) {
      const idx = text.indexOf(trigger);
      if (idx !== -1) {
        const remainder = (text.slice(0, idx) + text.slice(idx + trigger.length)).trim();
        return { id: cmd.id, label: cmd.label, dangerous: cmd.dangerous, remainder };
      }
      // Fuzzy fallback — only for short triggers (<=4 words) to keep the
      // false-positive rate low; tolerance scales gently with phrase length.
      const words = trigger.split(" ");
      if (words.length <= 4) {
        const tolerance = Math.max(1, Math.floor(trigger.length * 0.15));
        // Slide a same-length window across the transcript and check distance.
        for (let i = 0; i + trigger.length <= text.length; i++) {
          const window = text.slice(i, i + trigger.length);
          if (levenshtein(window, trigger) <= tolerance) {
            const remainder = (text.slice(0, i) + text.slice(i + trigger.length)).trim();
            return { id: cmd.id, label: cmd.label, dangerous: cmd.dangerous, remainder };
          }
        }
      }
    }
  }
  return null;
}
