// Alfred content-script generation — reuses the app's existing authenticated
// LLM call path (callModel/MODELS from lib/api.ts), same as SocialPage's
// caption generator. Never call a provider API directly with fetch here.
import { callModel } from "./api";
import type { AppSettings, Job } from "../types";

export interface ScriptCategoryMeta {
  key: string;
  label: string;
  emoji: string;
  desc: string;
}

export const SCRIPT_CATEGORIES: ScriptCategoryMeta[] = [
  { key: "commercial", label: "Commercial Style", emoji: "🎬", desc: "Polished, brand-forward — like a paid TV/YouTube ad" },
  { key: "funny_short", label: "Funny Short-Form", emoji: "😂", desc: "15–30s comedic hook for TikTok/Reels/Shorts" },
  { key: "long_form", label: "Long-Form", emoji: "🎥", desc: "2–5 min YouTube-style story or process video" },
  { key: "informational", label: "Informational", emoji: "💡", desc: "Educational tip / how-it-works content" },
  { key: "viral_idea", label: "Viral Idea", emoji: "🔥", desc: "A high-concept idea/hook, not a full script" },
];

export const categoryMeta = (key: string): ScriptCategoryMeta =>
  SCRIPT_CATEGORIES.find(c => c.key === key) || SCRIPT_CATEGORIES[3];

export interface GeneratedScript {
  title: string;
  script: string;
  category: string;
}

// Pulls light job context (recent completed jobs) so the script references
// this specific business's actual services/area instead of reading generic.
const buildBusinessContext = (settings: AppSettings, jobs: Job[]): string => {
  const companyName = (settings as any)?.companyName || "our service business";
  const serviceNames = ((settings as any)?.services || [])
    .map((s: any) => (typeof s === "string" ? s : s?.name))
    .filter(Boolean)
    .slice(0, 6)
    .join(", ") || "our core services";
  const city = (settings as any)?.companyCity || (settings as any)?.serviceArea || "";
  const recentCompleted = (jobs || [])
    .filter((j: any) => j.status === "completed")
    .slice(-8);
  const withPhotos = recentCompleted.find((j: any) => (j.photos || []).some((p: any) => p.type === "before" || p.type === "after"));
  const jobLine = withPhotos
    ? `A recent completed job had before/after photos available — tags: ${((withPhotos as any).tags || []).join(", ") || "service"}.`
    : "";
  return `Business: ${companyName}${city ? " (serving " + city + ")" : ""}. Services offered: ${serviceNames}. ${jobLine}`.trim();
};

export const generateVideoScript = async (opts: {
  category: string;
  settings: AppSettings;
  jobs?: Job[];
}): Promise<GeneratedScript> => {
  const { category, settings, jobs = [] } = opts;
  const modelId = (settings as any)?.activeModel || "claude";
  const apiKey = ((settings as any)?.modelKeys || {})[modelId] || (modelId === "claude" ? (settings as any)?.anthropicKey : undefined);
  const meta = categoryMeta(category);
  const businessContext = buildBusinessContext(settings, jobs);

  const prompt = `You are a viral short-form video scriptwriter for a service / exterior cleaning business.
${businessContext}

Write ONE ${meta.label} video concept (${meta.desc}) meant to actually get views on social media (TikTok/Reels/YouTube Shorts, unless it's the long-form category).
Make it specific to a service business — not generic content advice. Include a strong hook in the first line.

Respond in EXACTLY this format and nothing else, no preamble:
TITLE: <short punchy title, under 8 words>
SCRIPT:
<the actual script / shot list — hook, body beats, on-screen text callouts in [brackets], and a clear CTA at the end. Use line breaks.>`;

  const res = await callModel({
    modelId,
    apiKey,
    messages: [{ role: "user", content: prompt }],
    maxTokens: 800,
  });

  const text = (res.text || "").trim();
  const titleMatch = text.match(/TITLE:\s*(.+)/i);
  const scriptMatch = text.match(/SCRIPT:\s*([\s\S]*)/i);

  return {
    title: titleMatch?.[1]?.trim() || `${meta.emoji} ${meta.label} idea`,
    script: scriptMatch?.[1]?.trim() || text || "(Alfred didn't return a script — try again.)",
    category,
  };
};
