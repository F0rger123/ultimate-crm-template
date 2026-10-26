// Reads an import file into rows of cells, whatever format the owner has:
// CSV / TSV / TXT, Excel (.xlsx), phone or Google contacts (.vcf), or JSON.
//
// BUG FIX — "it doesn't detect any of the correct forms": the importer only
// read plain text, so an Excel workbook came through as zip bytes and a
// phone's contact export (.vcf) as one long garbled column. Excel is read
// here without a library (an .xlsx is a zip of XML files; the browser's
// DecompressionStream inflates it), contacts are turned into a table with
// the same headers a CSV would have.
import { parseDelimited } from "./customerImport";

export const IMPORT_FILE_ACCEPT = ".csv,.tsv,.txt,.xlsx,.xlsm,.vcf,.vcard,.json,text/csv,text/vcard,application/json,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

export async function readImportFile(file: File): Promise<string[][]> {
  const name = file.name.toLowerCase();
  const head = new Uint8Array(await file.slice(0, 4).arrayBuffer());
  const isZip = head[0] === 0x50 && head[1] === 0x4b; // "PK"
  if (name.endsWith(".xls") && !isZip) throw new Error("Old .xls files can't be read — open it in Excel or Google Sheets and save as .xlsx or .csv");
  if (isZip || /\.xls[xm]$/.test(name)) return readXlsx(await file.arrayBuffer());
  const text = await file.text();
  if (/\.(vcf|vcard)$/.test(name) || /^\s*BEGIN:VCARD/i.test(text)) return parseVcf(text);
  if (name.endsWith(".json") || /^\s*[\[{]/.test(text)) {
    const rows = parseJsonRows(text);
    if (rows) return rows;
  }
  return parseDelimited(text);
}

// ── JSON: an array of objects (or { customers: [...] }) → header + rows ────
function parseJsonRows(text: string): string[][] | null {
  let v: any;
  try { v = JSON.parse(text); } catch { return null; }
  const arr = Array.isArray(v) ? v : Object.values(v || {}).find(x => Array.isArray(x)) as any[] | undefined;
  if (!arr || !arr.length || typeof arr[0] !== "object") return null;
  const headers: string[] = [];
  for (const o of arr) for (const k of Object.keys(o || {})) if (!headers.includes(k)) headers.push(k);
  const cell = (x: any) => x == null ? "" : typeof x === "object" ? (Array.isArray(x) ? x.join(", ") : Object.values(x).filter(Boolean).join(", ")) : String(x);
  return [headers, ...arr.map(o => headers.map(h => cell(o?.[h]).trim()))];
}

// ── vCard (iPhone / Android / Google / Outlook contact export) ─────────────
const VCF_HEADERS = ["First Name", "Last Name", "Full Name", "Email", "Phone", "Street Address", "City", "State", "Zip", "Company", "Notes", "Birthday"];
export function parseVcf(text: string): string[][] {
  // Folded lines continue with a leading space or tab (RFC 6350 §3.2).
  const lines = text.replace(/\r\n/g, "\n").replace(/\n[ \t]/g, "").split("\n");
  const rows: string[][] = [VCF_HEADERS];
  let card: Record<string, string> | null = null;
  const unesc = (s: string) => s.replace(/\\n/gi, "\n").replace(/\\([,;\\])/g, "$1").trim();
  for (const raw of lines) {
    const line = raw.trim();
    if (/^BEGIN:VCARD/i.test(line)) { card = {}; continue; }
    if (/^END:VCARD/i.test(line)) {
      if (card) rows.push(VCF_HEADERS.map(h => card![h] || ""));
      card = null; continue;
    }
    if (!card) continue;
    const i = line.indexOf(":"); if (i < 0) continue;
    const key = line.slice(0, i).split(";")[0].replace(/^item\d+\./i, "").toUpperCase();
    const val = line.slice(i + 1);
    const parts = val.split(/(?<!\\);/).map(unesc);
    if (key === "N") { card["Last Name"] ||= parts[0] || ""; card["First Name"] ||= parts[1] || ""; }
    else if (key === "FN") card["Full Name"] ||= unesc(val);
    else if (key === "EMAIL") card["Email"] ||= unesc(val);
    else if (key === "TEL") card["Phone"] ||= unesc(val);
    else if (key === "ORG") card["Company"] ||= parts.filter(Boolean).join(" ");
    else if (key === "NOTE") card["Notes"] ||= unesc(val);
    else if (key === "BDAY") card["Birthday"] ||= unesc(val);
    else if (key === "ADR" && !card["Street Address"]) {
      // ADR: PO box ; extended ; street ; city ; region ; postal code ; country
      card["Street Address"] = [parts[2], parts[1]].filter(Boolean).join(" ");
      card["City"] = parts[3] || ""; card["State"] = parts[4] || ""; card["Zip"] = parts[5] || "";
    }
  }
  return rows;
}

// ── Excel .xlsx (first worksheet) ──────────────────────────────────────────
async function unzip(buf: ArrayBuffer): Promise<Map<string, Uint8Array>> {
  const dv = new DataView(buf), bytes = new Uint8Array(buf);
  let eocd = -1;
  for (let i = bytes.length - 22; i >= Math.max(0, bytes.length - 65557); i--) if (dv.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
  if (eocd < 0) throw new Error("That file isn't a readable Excel workbook");
  const count = dv.getUint16(eocd + 10, true);
  let p = dv.getUint32(eocd + 16, true);
  const out = new Map<string, Uint8Array>();
  const dec = new TextDecoder();
  for (let n = 0; n < count; n++) {
    if (dv.getUint32(p, true) !== 0x02014b50) break;
    const method = dv.getUint16(p + 10, true);
    const csize = dv.getUint32(p + 20, true);
    const nameLen = dv.getUint16(p + 28, true), extraLen = dv.getUint16(p + 30, true), commentLen = dv.getUint16(p + 32, true);
    const local = dv.getUint32(p + 42, true);
    const name = dec.decode(bytes.subarray(p + 46, p + 46 + nameLen));
    p += 46 + nameLen + extraLen + commentLen;
    if (!/^(xl\/(workbook\.xml|sharedStrings\.xml|worksheets\/sheet\d+\.xml|_rels\/workbook\.xml\.rels))$/i.test(name)) continue;
    const start = local + 30 + dv.getUint16(local + 26, true) + dv.getUint16(local + 28, true);
    const data = bytes.subarray(start, start + csize);
    if (method === 0) out.set(name, data);
    else if (method === 8) {
      if (typeof (window as any).DecompressionStream !== "function") throw new Error("This browser can't open Excel files — save the sheet as .csv and import that");
      const stream = new Blob([data]).stream().pipeThrough(new (window as any).DecompressionStream("deflate-raw"));
      out.set(name, new Uint8Array(await new Response(stream).arrayBuffer()));
    }
  }
  return out;
}

const colIndex = (ref: string) => {
  const letters = (ref.match(/^[A-Z]+/i)?.[0] || "A").toUpperCase();
  let n = 0; for (const ch of letters) n = n * 26 + (ch.charCodeAt(0) - 64);
  return n - 1;
};

async function readXlsx(buf: ArrayBuffer): Promise<string[][]> {
  const files = await unzip(buf);
  const dec = new TextDecoder();
  const xml = (name: string) => { const b = files.get(name); return b ? new DOMParser().parseFromString(dec.decode(b), "application/xml") : null; };
  const all = (doc: Document | Element, tag: string) => Array.from(doc.getElementsByTagNameNS("*", tag));

  const shared = (() => { const d = xml("xl/sharedStrings.xml"); return d ? all(d, "si").map(si => all(si, "t").map(t => t.textContent || "").join("")) : []; })();

  // First sheet in workbook order (sheet1.xml isn't always the first tab).
  let sheetPath = "xl/worksheets/sheet1.xml";
  const wb = xml("xl/workbook.xml"), rels = xml("xl/_rels/workbook.xml.rels");
  const first = wb ? all(wb, "sheet")[0] : null;
  const rid = first?.getAttribute("r:id") || first?.getAttributeNS("http://schemas.openxmlformats.org/officeDocument/2006/relationships", "id");
  const target = rid && rels ? all(rels, "Relationship").find(r => r.getAttribute("Id") === rid)?.getAttribute("Target") : null;
  if (target) { const t = target.replace(/^\/?xl\//, "").replace(/^\//, ""); if (files.has("xl/" + t)) sheetPath = "xl/" + t; }
  if (!files.has(sheetPath)) sheetPath = Array.from(files.keys()).find(k => /worksheets\/sheet\d+\.xml$/i.test(k)) || sheetPath;
  const sheet = xml(sheetPath);
  if (!sheet) throw new Error("Couldn't find a worksheet in that Excel file");

  const rows: string[][] = [];
  for (const r of all(sheet, "row")) {
    const cells: string[] = [];
    let next = 0;
    for (const c of all(r, "c")) {
      const ref = c.getAttribute("r");
      const i = ref ? colIndex(ref) : next;
      next = i + 1;
      const t = c.getAttribute("t");
      const v = all(c, "v")[0]?.textContent ?? "";
      let val = "";
      if (t === "s") val = shared[Number(v)] ?? "";
      else if (t === "inlineStr") val = all(c, "t").map(x => x.textContent || "").join("");
      else if (t === "b") val = v === "1" ? "TRUE" : "FALSE";
      else val = v;
      while (cells.length < i) cells.push("");
      cells[i] = val.trim();
    }
    if (cells.some(x => x !== "")) rows.push(cells);
  }
  const width = Math.max(0, ...rows.map(r => r.length));
  return rows.map(r => r.concat(Array(width - r.length).fill("")));
}
