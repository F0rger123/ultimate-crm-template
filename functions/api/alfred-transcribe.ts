// alfred-transcribe.ts — turns a voice note recorded in the Alfred chat into
// text (also dictation and Voice Mode when the browser's own recognizer
// can't be used — see src/lib/voiceCapture.ts). The engines are in
// _lib/transcribe.ts. Works for any recording format the browser makes
// (webm on Chrome/Android, mp4/aac on iPhone).
//
// BUG FIX — "I record, press stop, and it does nothing." The chat's voice
// note relied on an OpenAI key typed into the browser or on the browser's
// own speech recognition running alongside the recorder; on an iPhone the
// second fights the first for the microphone, so there was never a
// transcript to send.
// POST multipart: audio=<file>; owner's Supabase access token as Bearer.
import { getOwnerSecrets, resolveCallerOwnerId } from "./_lib/ownerSecrets";
import { transcribeAudioBuffer, TRANSCRIBE_SETUP_HELP } from "./_lib/transcribe";

const json = (b: any, status = 200) => new Response(JSON.stringify(b), { status, headers: { "Content-Type": "application/json" } });

// GET — is the free Cloudflare speech-to-text set up on this deployment?
// No secrets, no owner data: just whether the "AI" binding exists, so the
// health check (and support) can tell why voice isn't working.
export const onRequestGet = async (context: { env: Record<string, any> }) => json({ cloudflareAI: !!context.env.AI });


export const onRequestPost = async (context: { request: Request; env: Record<string, any> }) => {
  try {
    const token = (context.request.headers.get("Authorization") || "").replace(/^Bearer /, "");
    const ownerId = await resolveCallerOwnerId(token).catch(() => null);
    if (!ownerId) return json({ error: "Sign in again to send voice notes." }, 401);
    const form = await context.request.formData();
    const file = form.get("audio");
    if (!(file instanceof File)) return json({ error: "No audio received." }, 400);
    if (file.size < 800) return json({ error: "That recording was empty — check the microphone permission and try again." }, 400);
    if (file.size > 24 * 1024 * 1024) return json({ error: "That recording is too long — keep voice notes under about 10 minutes." }, 400);
    const buf = await file.arrayBuffer();
    const secrets = context.env.SUPABASE_SERVICE_ROLE_KEY ? await getOwnerSecrets(ownerId, context.env.SUPABASE_SERVICE_ROLE_KEY).catch(() => null) : null;
    const r = await transcribeAudioBuffer(context.env.AI, secrets?.modelKeys || {}, buf, file.type || "audio/webm");
    if (r.text) return json({ text: r.text, via: r.via });
    if (r.heardNothing) return json({ text: "", via: "none", note: "No words heard" });
    return json({ error: "Couldn't turn that into text. " + (r.configured ? r.errors.join("; ") : TRANSCRIBE_SETUP_HELP), details: r.errors }, 502);
  } catch (e: any) {
    return json({ error: e?.message || "Transcription failed" }, 500);
  }
};
