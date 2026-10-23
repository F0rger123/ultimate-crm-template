// Lightweight consistency check for the project-memory docs in docs/client/.
// Usage: npm run docs:check   (exit 1 on errors; warnings don't fail)
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join } from "node:path";

const DIR = "docs/client";
const TEMPLATES = "docs/templates";
const errors = [], warnings = [];

const FILE_PREFIX = {
  "MASTER_REQUIREMENTS.md": "REQ", "BUGS.md": "BUG", "IDEAS.md": "IDEA", "DECISIONS.md": "DEC",
  "QUESTIONS.md": "Q", "INTEGRATIONS.md": "INT", "WORKFLOWS.md": "WF",
};
const STATUSES = {
  REQ: ["Needs Clarification", "Proposed", "Approved", "Planned", "In Progress", "Partially Implemented", "Implemented", "Needs Testing", "Blocked", "Resolved", "Verified", "Rejected", "Deferred", "Superseded"],
  BUG: ["Reported", "Reproduced", "Investigating", "Fix Attempted", "Partially Fixed", "Needs Retest", "Resolved", "Verified", "Cannot Reproduce", "Reopened"],
};
const ONBOARDING = ["not_started", "in_progress", "complete"];

if (!existsSync(DIR)) { console.error(`✗ ${DIR}/ is missing — copy it from ${TEMPLATES}/`); process.exit(1); }

const stripComments = s => s.replace(/<!--[\s\S]*?-->/g, "");

// project-state.json
let state = null;
try {
  state = JSON.parse(readFileSync(join(DIR, "project-state.json"), "utf8"));
  if (!ONBOARDING.includes(state?.onboarding?.status)) errors.push(`project-state.json: onboarding.status must be one of ${ONBOARDING.join(", ")}`);
} catch (e) { errors.push(`project-state.json: ${e.message}`); }

// IDs per file
const seenGlobal = new Map();
for (const file of readdirSync(DIR).filter(f => f.endsWith(".md"))) {
  const text = stripComments(readFileSync(join(DIR, file), "utf8"));
  const headingIds = [...text.matchAll(/^#{2,4}\s+([A-Z]+-\d{3,})\b/gm)].map(m => m[1]);
  const rowIds = [...text.matchAll(/^\|\s*([A-Z]+-\d{3,})\s*\|/gm)].map(m => m[1]);
  const dup = arr => arr.filter((x, i) => arr.indexOf(x) !== i);
  for (const id of new Set(dup(headingIds))) errors.push(`${file}: ${id} has more than one detail section`);
  // A file may have several tables (e.g. Questions open + answered), so only warn on row dupes.
  for (const id of new Set(dup(rowIds))) warnings.push(`${file}: ${id} appears in more than one table row`);

  const prefix = FILE_PREFIX[file];
  if (prefix) {
    for (const id of new Set([...headingIds, ...rowIds])) {
      if (!id.startsWith(prefix + "-")) { warnings.push(`${file}: ${id} is defined here but ${prefix}-### items belong in this file — move it or reference it in a Related column`); continue; }
      const owner = seenGlobal.get(id);
      if (owner && owner !== file) errors.push(`${id} is defined in both ${owner} and ${file}`);
      seenGlobal.set(id, file);
    }
    if (prefix === "REQ" || prefix === "BUG") {
      for (const id of headingIds.filter(i => i.startsWith(prefix))) {
        if (!rowIds.includes(id)) warnings.push(`${file}: ${id} has a detail section but no summary-table row`);
      }
      // Validate the Status column of the summary table.
      const lines = text.split("\n");
      const header = lines.find(l => /^\|\s*ID\s*\|/.test(l));
      if (header) {
        const cols = header.split("|").map(c => c.trim());
        const si = cols.indexOf("Status");
        for (const l of lines.filter(l => new RegExp(`^\\|\\s*${prefix}-\\d`).test(l))) {
          const status = l.split("|").map(c => c.trim())[si];
          if (si > 0 && status && !STATUSES[prefix].includes(status)) warnings.push(`${file}: unknown status "${status}" in row ${l.split("|")[1].trim()}`);
        }
      }
    }
  }
}

// Template hygiene: an un-onboarded project should still have pristine client docs.
if (state?.onboarding?.status === "not_started" && existsSync(TEMPLATES)) {
  for (const file of readdirSync(TEMPLATES)) {
    const a = existsSync(join(DIR, file)) ? readFileSync(join(DIR, file), "utf8") : null;
    if (a === null) errors.push(`docs/client/${file} missing (copy from ${TEMPLATES}/)`);
    else if (a !== readFileSync(join(TEMPLATES, file), "utf8")) warnings.push(`docs/client/${file} differs from template but onboarding.status is "not_started"`);
  }
}

for (const w of warnings) console.warn("⚠ " + w);
for (const e of errors) console.error("✗ " + e);
console.log(errors.length ? `${errors.length} error(s)` : `✓ docs/client consistent (${seenGlobal.size} IDs, ${warnings.length} warning(s))`);
process.exit(errors.length ? 1 : 0);
