// Bundles every Cloudflare Pages Function with esbuild to catch syntax/import
// errors before deploy (Cloudflare builds functions separately from Vite).
// Usage: npm run check:functions
import { build } from "esbuild";
import { readdirSync } from "node:fs";
import { join } from "node:path";

const root = "functions/api";
const entries = readdirSync(root).filter(f => f.endsWith(".ts")).map(f => join(root, f));
let failed = 0;
for (const entry of entries) {
  try {
    await build({ entryPoints: [entry], bundle: true, write: false, format: "esm", platform: "neutral", logLevel: "silent" });
  } catch (e) {
    failed++;
    console.error(`✗ ${entry}\n${e.errors?.map(x => `  ${x.location?.file}:${x.location?.line} ${x.text}`).join("\n") || e.message}`);
  }
}
console.log(failed ? `${failed} function(s) failed` : `✓ ${entries.length} functions bundle cleanly`);
process.exit(failed ? 1 : 0);
