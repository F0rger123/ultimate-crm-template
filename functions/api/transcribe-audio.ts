// FEATURE — "can it automatically create captions? I feel like you can
// build it." Real speech-to-text isn't something a browser can do offline
// for a pre-recorded file (the Web Speech API only works on a LIVE
// microphone stream, not an audio blob — already used elsewhere in this
// app for voice-to-text checklist notes, which is exactly that live-mic
// case) — genuine transcription needs a real model call. Runs server-side
// only because CORS blocks a direct browser→api multipart/binary upload
// the same way every other direct-API integration in this app already
// routes through a Cloudflare Function.
//
// FEATURE — "make it so it uses any API, not just OpenAI's." Three real,
// independently-selectable providers, not just OpenAI reskinned: OpenAI
// Whisper and Groq's Whisper endpoint are both OpenAI-compatible multipart
// APIs (reuses whichever of those keys the owner already has in Settings →
// AI Models — no new signup needed), while Deepgram is a genuinely
// different API shape entirely (raw audio bytes, not multipart form-data,
// its own response schema) — added so an owner isn't locked into one
// vendor if OpenAI's is down, rate-limited, or they'd rather not use it.
export const onRequestPost = async (context: { request: Request; env: Record<string, string> }) => {
  try {
    const incomingForm = await context.request.formData();
    const audioFile = incomingForm.get("audio");
    const apiKey = incomingForm.get("apiKey");
    const provider = String(incomingForm.get("provider") || "openai");
    if (!(audioFile instanceof File)) return json({ error: "Missing audio file" }, 400);
    if (!apiKey || typeof apiKey !== "string") return json({ error: noKeyMessage(provider) }, 400);

    if (provider === "deepgram") {
      const audioBuf = await audioFile.arrayBuffer();
      const res = await fetch("https://api.deepgram.com/v1/listen?model=nova-2&smart_format=true&punctuate=true&utterances=true", {
        method: "POST",
        headers: { Authorization: `Token ${apiKey}`, "Content-Type": audioFile.type || "audio/mpeg" },
        body: audioBuf,
      });
      const data = await res.json().catch(() => null) as any;
      if (!res.ok) return json({ error: data?.err_msg || data?.error?.message || `Deepgram transcription failed (HTTP ${res.status})` }, 502);
      const utterances = Array.isArray(data?.results?.utterances) ? data.results.utterances : [];
      const segments = utterances
        .map((u: any) => ({ text: String(u.transcript || "").trim(), start: Number(u.start) || 0, end: Number(u.end) || 0 }))
        .filter((s: any) => s.text);
      const fullText = data?.results?.channels?.[0]?.alternatives?.[0]?.transcript || "";
      return json({ segments, fullText });
    }

    // OpenAI + Groq — both OpenAI-compatible multipart Whisper endpoints,
    // differing only in host + model id.
    const endpoint = provider === "groq" ? "https://api.groq.com/openai/v1/audio/transcriptions" : "https://api.openai.com/v1/audio/transcriptions";
    const model = provider === "groq" ? "whisper-large-v3-turbo" : "whisper-1";
    const outgoing = new FormData();
    outgoing.append("file", audioFile, "audio.mp3");
    outgoing.append("model", model);
    outgoing.append("response_format", "verbose_json");
    outgoing.append("timestamp_granularities[]", "segment");

    const res = await fetch(endpoint, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}` },
      body: outgoing,
    });
    const data = await res.json().catch(() => null) as any;
    if (!res.ok) return json({ error: data?.error?.message || `Transcription failed (HTTP ${res.status})` }, 502);

    const segments = Array.isArray(data?.segments)
      ? data.segments.map((s: any) => ({ text: String(s.text || "").trim(), start: Number(s.start) || 0, end: Number(s.end) || 0 })).filter((s: any) => s.text)
      : [];
    return json({ segments, fullText: data?.text || "" });
  } catch (e: any) {
    return json({ error: e?.message || "Transcription proxy error" }, 500);
  }
};

const noKeyMessage = (provider: string): string => {
  if (provider === "deepgram") return "No Deepgram API key configured — add one in Settings → Social → Auto-Captions, or use manual captions instead (free, no key needed).";
  if (provider === "groq") return "No Groq API key configured — add one in Settings → AI Models → Groq, or use manual captions instead (free, no key needed).";
  return "No OpenAI API key configured — add one in Settings → AI Models → OpenAI, or use manual captions instead (free, no key needed).";
};

const json = (data: any, status = 200) => new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json" } });
