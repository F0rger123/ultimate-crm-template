// Speech to text for every voice path: chat voice notes / dictation / Voice
// Mode (/api/alfred-transcribe) and voice memos texted to Alfred
// (twilio-sms-webhook). Tries, in order: Cloudflare Workers AI Whisper
// (free; the large-v3-turbo model first — it reads the webm/opus and
// mp4/aac files phones record far more reliably — then the original), the
// owner's OpenAI key, Groq key, then Gemini (reads audio inline).

const toBase64 = (buf: ArrayBuffer) => {
  const bytes = new Uint8Array(buf);
  let bin = "";
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin);
};

export type TranscribeResult = { text: string; via: string; heardNothing: boolean; errors: string[]; configured: boolean };

export async function transcribeAudioBuffer(ai: any, keys: Record<string, string>, buf: ArrayBuffer, mimeType: string): Promise<TranscribeResult> {
  const errors: string[] = [];
  let heardNothing = false;
  const mime = (mimeType || "audio/webm").split(";")[0];
  if (ai) {
    for (const [name, model, input] of [
      ["Cloudflare Whisper turbo", "@cf/openai/whisper-large-v3-turbo", () => ({ audio: toBase64(buf), language: "en" })],
      ["Cloudflare Whisper", "@cf/openai/whisper", () => ({ audio: Array.from(new Uint8Array(buf)) })],
    ] as [string, string, () => any][]) {
      try {
        const r: any = await ai.run(model, input());
        const text = String(r?.text || r?.transcription_info?.text || "").trim();
        if (text) return { text, via: name, heardNothing: false, errors, configured: true };
        heardNothing = true;
        errors.push(name + " heard no words");
      } catch (e: any) { errors.push(name + ": " + (e?.message || "failed")); }
    }
  } else errors.push("Cloudflare AI binding not set up");

  const ext = (mime.split("/")[1] || "webm").replace("x-m4a", "m4a").replace("mpeg", "mp3").replace("amr", "amr");
  const tries: [string, string, string, string][] = [];
  if (keys.openai) tries.push(["OpenAI Whisper", "https://api.openai.com/v1/audio/transcriptions", "whisper-1", keys.openai]);
  if (keys.groq) tries.push(["Groq Whisper", "https://api.groq.com/openai/v1/audio/transcriptions", "whisper-large-v3-turbo", keys.groq]);
  for (const [name, url, model, key] of tries) {
    try {
      const fd = new FormData();
      fd.append("file", new Blob([buf], { type: mime }), `voice.${ext}`);
      fd.append("model", model);
      const res = await fetch(url, { method: "POST", headers: { Authorization: `Bearer ${key}` }, body: fd });
      const data: any = await res.json().catch(() => null);
      if (res.ok && String(data?.text || "").trim()) return { text: String(data.text).trim(), via: name, heardNothing: false, errors, configured: true };
      errors.push(`${name}: ${data?.error?.message || "HTTP " + res.status}`);
    } catch (e: any) { errors.push(`${name}: ${e?.message || "failed"}`); }
  }
  if (keys.gemini) {
    try {
      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${encodeURIComponent(keys.gemini)}`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contents: [{ parts: [{ text: "Transcribe this voice note word for word. Reply with only the words spoken, nothing else. If nobody speaks, reply with nothing." }, { inline_data: { mime_type: mime, data: toBase64(buf) } }] }], generationConfig: { temperature: 0, thinkingConfig: { thinkingBudget: 0 } } }),
      });
      const data: any = await res.json().catch(() => null);
      const text = String(data?.candidates?.[0]?.content?.parts?.map((p: any) => p.text || "").join("") || "").trim();
      if (res.ok && text) return { text, via: "Gemini", heardNothing: false, errors, configured: true };
      errors.push(`Gemini: ${data?.error?.message || (res.ok ? "heard no words" : "HTTP " + res.status)}`);
    } catch (e: any) { errors.push(`Gemini: ${e?.message || "failed"}`); }
  }
  const configured = !!ai || tries.length > 0 || !!keys.gemini;
  // Every engine that ran heard silence: an empty note, not a setup problem.
  if (heardNothing && errors.every(e => /heard no words|not set up/.test(e))) return { text: "", via: "none", heardNothing: true, errors, configured };
  return { text: "", via: "", heardNothing: false, errors, configured };
}

export const TRANSCRIBE_SETUP_HELP = "Voice needs one of: the free Cloudflare \"AI\" binding on this site (Cloudflare → Workers & Pages → this project → Settings → Bindings → add Workers AI named AI, then redeploy), or an OpenAI, Groq or Gemini key in Settings → AI Models.";
