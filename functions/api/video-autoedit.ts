// Optional "Auto-Edit with AI" path (VideoEditorModal.tsx) — entirely
// separate from the free ffmpeg.wasm editor in src/lib/videoEditor.ts.
// Only reachable when the owner has entered their OWN Shotstack API key in
// Settings, so nothing here ever bills anyone but the owner, on their own
// account. Same reasoning as buffer-action.ts/twilio-send.ts: Shotstack's
// API doesn't send CORS headers for a browser fetch, so this runs
// server-side and is called same-origin.
//
// Shotstack takes a JSON "edit" (tracks of clips with in/out points + a
// title/caption overlay per clip) and renders it on their servers — this
// submits the render then polls for completion (capped so the Cloudflare
// Function itself doesn't run forever; a longer render just needs the
// owner to check back, which the UI already explains).
type ClipSpec = { url: string; startSec: number; endSec: number };
type CaptionSpec = { text: string; startSec: number; endSec: number };

const POLL_INTERVAL_MS = 3000;
const MAX_POLLS = 25; // ~75s ceiling — Cloudflare Pages Functions have their own execution time limit

export const onRequestPost = async (context: { request: Request }) => {
  try {
    const body = await context.request.json() as {
      apiKey?: string;
      clips?: ClipSpec[];
      captions?: CaptionSpec[];
    };
    const { apiKey, clips, captions } = body;
    if (!apiKey) return err("Missing apiKey — add your Shotstack API key in Settings first", 400);
    if (!clips || clips.length === 0) return err("No clips provided", 400);

    // Shotstack's edit format: one video track with the clips back to
    // back (each clip's own `start`/`length` on the timeline is computed
    // cumulatively), plus one title track per caption positioned by time.
    let cursor = 0;
    const videoClips = clips.map(c => {
      const length = Math.max(0.1, c.endSec - c.startSec);
      const clip = {
        asset: { type: "video", src: c.url, trim: c.startSec },
        start: cursor,
        length,
      };
      cursor += length;
      return clip;
    });
    const titleClips = (captions || []).map(cap => ({
      asset: { type: "title", text: cap.text, style: "minimal" },
      start: cap.startSec,
      length: Math.max(0.1, cap.endSec - cap.startSec),
    }));

    const edit = {
      timeline: {
        tracks: [
          ...(titleClips.length > 0 ? [{ clips: titleClips }] : []),
          { clips: videoClips },
        ],
      },
      output: { format: "mp4", resolution: "hd" },
    };

    const submitRes = await fetch("https://api.shotstack.io/v1/render", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": apiKey },
      body: JSON.stringify(edit),
    });
    const submitData = await submitRes.json().catch(() => ({} as any));
    if (!submitRes.ok || !submitData?.response?.id) {
      return err(submitData?.response?.error || submitData?.message || `Shotstack rejected the render (HTTP ${submitRes.status})`, 502);
    }
    const renderId = submitData.response.id;

    for (let i = 0; i < MAX_POLLS; i++) {
      await new Promise(r => setTimeout(r, POLL_INTERVAL_MS));
      const statusRes = await fetch(`https://api.shotstack.io/v1/render/${renderId}`, { headers: { "x-api-key": apiKey } });
      const statusData = await statusRes.json().catch(() => ({} as any));
      const status = statusData?.response?.status;
      if (status === "done") {
        return new Response(JSON.stringify({ url: statusData.response.url }), { headers: { "Content-Type": "application/json" } });
      }
      if (status === "failed") {
        return err(statusData?.response?.error || "Shotstack render failed", 502);
      }
      // still queued/rendering — keep polling
    }
    // Didn't finish within our polling window — hand back the render id so
    // the caller can at least tell the owner it's still processing rather
    // than claiming failure.
    return new Response(JSON.stringify({ pending: true, renderId, message: "Still rendering on Shotstack's side — this can take a few minutes for longer videos. Check your Shotstack dashboard for the finished link." }), {
      status: 202, headers: { "Content-Type": "application/json" },
    });
  } catch (e: any) {
    return err(e?.message || "Auto-edit proxy error", 500);
  }
};

function err(message: string, status: number) {
  return new Response(JSON.stringify({ error: message }), { status, headers: { "Content-Type": "application/json" } });
}
