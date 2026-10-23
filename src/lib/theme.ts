// Read a theme token (defined in src/index.css → THEME TOKENS) as a plain
// color string, for places Tailwind classes can't reach: chart libraries,
// canvas, SVG attributes. Accepts a hex token (--chart-1) or an RGB-triplet
// token (--brand-600, --danger-600).
export const themeColor = (token: string, alpha = 1): string => {
  const raw = typeof document !== "undefined" ? getComputedStyle(document.documentElement).getPropertyValue(token).trim() : "";
  if (!raw) return alpha < 1 ? `rgba(255,255,255,${alpha})` : "#ffffff";
  if (raw.startsWith("#") || raw.startsWith("rgb")) return raw;
  return alpha < 1 ? `rgb(${raw} / ${alpha})` : `rgb(${raw})`;
};
