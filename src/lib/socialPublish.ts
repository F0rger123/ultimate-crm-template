// Shared social-publish logic — originally lived only inside SocialPage.tsx,
// extracted so CalendarPage.tsx's drag-a-finished-video-onto-a-day flow can
// fire the exact same platform-send logic (Buffer → Meta → app-bridge →
// share-sheet fallback) instead of re-implementing it.
import { postToBuffer } from "./messaging";
import { postToFacebookPage } from "./socialOAuth";

export const PLATFORM_META: Record<string, { color: string; icon: string; limit: number; label: string }> = {
  instagram: { color: "from-brand-600 to-purple-700", icon: "📸", limit: 2200, label: "Instagram" },
  facebook: { color: "from-blue-600 to-blue-800", icon: "👥", limit: 63206, label: "Facebook" },
  tiktok: { color: "from-black to-neutral-900", icon: "🎵", limit: 2200, label: "TikTok" },
};

// Fires the actual send for one platform: Buffer first (also handles real
// scheduling via dueAt when scheduledAt is passed), then a direct platform
// token (Facebook), then Instagram/TikTok app bridges, then a generic Web
// Share/clipboard fallback so every platform gets a real action instead of a
// no-op "Published" toast.
export async function publishOnePlatform(
  settings: any,
  toast: any,
  platform: string,
  caption: string,
  scheduledAt?: Date,
  mediaUrl?: string | null,
  mediaType?: "image" | "video"
): Promise<{ bufferPostId?: string; method: string }> {
  if (settings.bufferApiKey && settings.bufferChannelIds?.[platform]) {
    const bufferPostId = await postToBuffer(settings, platform, caption, scheduledAt, mediaUrl || undefined, mediaType);
    toast?.(`${scheduledAt ? "Scheduled" : "Posted"} to ${PLATFORM_META[platform]?.label || platform} via Buffer ✓`, "green");
    return { bufferPostId: bufferPostId || undefined, method: "buffer" };
  }
  if (scheduledAt) {
    toast?.(`No Buffer channel connected for ${PLATFORM_META[platform]?.label || platform} — saved as a reminder, publish it manually when it's time`, "yellow");
    return { method: "local-reminder" };
  }
  if (platform === "facebook" && (settings as any).metaAccessToken && (settings as any).metaPageId) {
    await postToFacebookPage((settings as any).metaAccessToken, (settings as any).metaPageId, caption);
    toast?.("Posted to Facebook ✓", "green");
    return { method: "meta" };
  }
  if (platform === "instagram" && settings.instaBridge) {
    navigator.clipboard?.writeText(caption).catch(() => {});
    window.location.href = "instagram://library?AssetPath=";
    setTimeout(() => window.open("https://www.instagram.com/", "_blank"), 1500);
    toast?.("Caption copied! Instagram opening — paste and post 📸");
    return { method: "manual" };
  }
  if (platform === "tiktok") {
    navigator.clipboard?.writeText(caption).catch(() => {});
    window.open("tiktok://", "_blank");
    setTimeout(() => window.open("https://www.tiktok.com/upload", "_blank"), 1500);
    toast?.("Caption copied! TikTok opening — paste and upload 🎵");
    return { method: "manual" };
  }
  if (navigator.share) {
    try {
      await navigator.share({ title: settings.companyName || "CRM Starter", text: caption, url: "https://crm.com" });
      toast?.(`Share sheet opened for ${PLATFORM_META[platform]?.label || platform} ✓`);
      return { method: "manual" };
    } catch { /* cancelled — still copy below so the owner has the caption */ }
  }
  navigator.clipboard?.writeText(caption).catch(() => {});
  toast?.(`Caption copied! Open ${PLATFORM_META[platform]?.label || platform} and paste 📋`);
  return { method: "manual" };
}
