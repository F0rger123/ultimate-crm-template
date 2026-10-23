import React, { useEffect, useRef, useState } from "react";
import { MapPin } from "lucide-react";
import { LiveMap, LiveMapPin } from "./LiveMap";

// FEATURE — "add a view that shows a globe/map, zoom in and out, with a
// pin for each customer, similar to a satellite view." Reuses LiveMap
// (already built for Crew View's employee/job pins — same dark/satellite/
// street-view toggles, same real Google Map, not a stock illustration).
// Customers don't have stored lat/lng today (only jobs do, captured when
// an address is picked via AddressAutocomplete), so this geocodes each
// customer's address client-side via the Google Geocoder — cached in
// localStorage keyed by the exact address string, so a given address is
// only ever geocoded once across the account's whole lifetime, not once
// per page visit.
const GEOCODE_CACHE_KEY = "crm.geocodeCache";
const readCache = (): Record<string, { lat: number; lng: number }> => {
  try { return JSON.parse(localStorage.getItem(GEOCODE_CACHE_KEY) || "{}"); } catch { return {}; }
};
const writeCache = (cache: Record<string, { lat: number; lng: number }>) => {
  try { localStorage.setItem(GEOCODE_CACHE_KEY, JSON.stringify(cache)); } catch { /* storage full/unavailable — cache just won't persist */ }
};

// FEATURE — "add filters to view different customer tags or types." Small
// XSS-safe HTML escaper for building each pin's click-popup content, since
// customer name/phone/email/tags are free-text and get dropped straight
// into a Google Maps InfoWindow's innerHTML.
const escapeHtml = (s: string) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] as string));

// FEATURE — "the photo for the address/house is not loading in map view."
// Nothing ever rendered one here before — Google's Street View Static API
// 403s on this app's referrer-restricted browser key (see PropertyMapEmbed's
// comment for the full story), so this reuses that same fix: the plain
// maps.google.com embed URL needs no API key and no restrictions at all.
// InfoWindow content is raw HTML (not React), so a plain <iframe> tag —
// the same src PropertyMapEmbed renders — drops in directly.
const buildPropertyEmbedHtml = (address: string): string => {
  if (!address) return "";
  return `<iframe src="https://maps.google.com/maps?q=${encodeURIComponent(address)}&output=embed" style="width:100%;height:110px;border:0;border-radius:6px;margin-top:6px;display:block;" loading="lazy" referrerpolicy="no-referrer-when-downgrade"></iframe>`;
};

// BUG FIX — "dead white space above the name, name text is invisible."
// This InfoWindow content div sits inside the app's own DOM (Google inserts
// it via innerHTML, no iframe), and the app root wraps everything in
// `text-white` (App.tsx's `min-h-screen bg-black text-white`) — the name
// line here had no color of its own, so it inherited white text onto
// Google's white InfoWindow background. Invisible text read as "dead white
// space," not a layout bug. Every text node below now sets its own color
// explicitly instead of relying on inherited (and here, wrong) color.
//
// BUG FIX — "View Full Client button doesn't work." An inline onclick=""
// attribute on HTML handed to InfoWindow's `content` is not reliably wired
// up by the Maps JS API across versions — the button rendered but the
// handler never fired. InfoWindow's own `domready` event (fired each time
// its content is actually attached to the page DOM) is Google's documented
// way to add real interactivity — LiveMap binds a real addEventListener to
// this button (by its unique per-customer id) when that fires instead.
const buildInfoHtml = (c: any): string => {
  const name = `${c.firstName || ""} ${c.lastName || ""}`.trim() || "Unnamed customer";
  const rows: string[] = [];
  if (c.phone) rows.push(`📞 ${escapeHtml(c.phone)}`);
  if (c.email) rows.push(`✉️ ${escapeHtml(c.email)}`);
  if (c.address) rows.push(`📍 ${escapeHtml(c.address)}`);
  const tags: string[] = c.tags || [];
  const tagsHtml = tags.length
    ? `<div style="margin-top:4px;">${tags.map(t => `<span style="display:inline-block;background:#eef2ff;color:#3730a3;font-size:10px;font-weight:600;padding:1px 6px;border-radius:9999px;margin:2px 3px 0 0;">${escapeHtml(t)}</span>`).join("")}</div>`
    : "";
  return `<div style="font:600 13px system-ui,sans-serif;padding:2px 4px;max-width:220px;color:#111;">
    <div style="color:#111;">${escapeHtml(name)}</div>
    <div style="font-weight:400;color:#444;font-size:11.5px;line-height:1.5;margin-top:3px;">${rows.join("<br/>")}</div>
    ${tagsHtml}
    ${buildPropertyEmbedHtml(c.address || "")}
    <button id="cmv-view-${escapeHtml(String(c.id))}" style="margin-top:8px;width:100%;padding:6px 10px;border-radius:8px;border:none;background:#2563eb;color:#fff;font:600 11px system-ui,sans-serif;cursor:pointer;">View Full Client →</button>
  </div>`;
};

export function CustomerMapView({ customers = [], apiKey, geocodingKey, onViewCustomer }: { customers?: any[]; apiKey: string; geocodingKey?: string; onViewCustomer?: (id: string) => void }) {
  const [pins, setPins] = useState<LiveMapPin[]>([]);
  const [geocoding, setGeocoding] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [tagFilter, setTagFilter] = useState<string>("");
  const allTags = Array.from(new Set(customers.flatMap((c: any) => c.tags || []))).sort();
  const visibleCustomers = tagFilter ? customers.filter((c: any) => (c.tags || []).includes(tagFilter)) : customers;
  const visibleIds = new Set(visibleCustomers.map((c: any) => c.id));
  const visiblePins = tagFilter ? pins.filter(p => visibleIds.has(p.id)) : pins;
  const [lastErrorStatus, setLastErrorStatus] = useState<string | null>(null);
  // BUG FIX (root cause, confirmed by Google's own response) — "I already
  // had geocoding set up correctly." Google flatly refuses ANY referrer-
  // restricted key for the Geocoding API — "API keys with referer
  // restrictions cannot be used with this API" — regardless of whether
  // Geocoding is enabled in Cloud Console. The old code used the JS
  // google.maps.Geocoder class, which is permanently bound to whatever key
  // loaded the Maps JS <script> tag — the SAME key that needs a referrer
  // restriction for safe browser use everywhere else in this app (Places
  // autocomplete, map rendering), so it could never work. Calling the REST
  // endpoint directly via fetch (Google allows CORS on it) lets this use a
  // genuinely separate, unrestricted geocodingKey — decoupled from
  // whatever loaded the map script — and also gets Google's real
  // error_message on every call for free, no separate diagnostic fetch.
  const [detailedError, setDetailedError] = useState<string | null>(null);
  const cacheRef = useRef<Record<string, { lat: number; lng: number }>>(readCache());
  const geoKey = geocodingKey || apiKey;

  // Ref-mirror so the window-level bridge (registered once) always calls the
  // LATEST onViewCustomer, not one captured at mount — same stale-closure
  // guard used for Alfred's send() elsewhere in this app.
  const onViewCustomerRef = useRef(onViewCustomer);
  useEffect(() => { onViewCustomerRef.current = onViewCustomer; });
  useEffect(() => {
    (window as any).__cmvViewCustomer = (id: string) => onViewCustomerRef.current?.(id);
    return () => { delete (window as any).__cmvViewCustomer; };
  }, []);

  useEffect(() => {
    if (!geoKey) return;
    let cancelled = false;
    const withAddress = customers.filter((c: any) => c.address && c.address.trim());
    (async () => {
      const cache = cacheRef.current;

      // Anything already cached (by address) shows instantly.
      const initialPins: LiveMapPin[] = [];
      const toGeocode: any[] = [];
      for (const c of withAddress) {
        const hit = cache[c.address];
        if (hit) initialPins.push({ id: c.id, label: `${c.firstName} ${c.lastName}`.trim() || c.address, lat: hit.lat, lng: hit.lng, updatedAt: Date.now(), infoHtml: buildInfoHtml(c) });
        else toGeocode.push(c);
      }
      setPins(initialPins);

      if (toGeocode.length === 0) return;
      setGeocoding(true);
      setProgress({ done: 0, total: toGeocode.length });

      // Sequential with a small delay — the Geocoding REST API has an
      // unpublished per-second rate limit; a tight Promise.all loop over
      // hundreds of addresses reliably starts returning OVER_QUERY_LIMIT
      // partway through. A cap keeps a first-ever map view (every address
      // a cache miss) from taking minutes on a large customer list.
      const CAP = 300;
      let done = 0;
      let consecutiveFailures = 0;
      for (const c of toGeocode.slice(0, CAP)) {
        if (cancelled) return;
        try {
          const res = await fetch(`https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(c.address)}&key=${encodeURIComponent(geoKey)}`);
          const body = await res.json();
          if (body.status !== "OK" || !body.results?.[0]) {
            const err: any = new Error(body.status || "UNKNOWN_ERROR");
            err.status = body.status || "UNKNOWN_ERROR";
            err.errorMessage = body.error_message;
            throw err;
          }
          const loc = body.results[0].geometry.location;
          const lat = loc.lat, lng = loc.lng;
          cache[c.address] = { lat, lng };
          setPins(prev => [...prev, { id: c.id, label: `${c.firstName} ${c.lastName}`.trim() || c.address, lat, lng, updatedAt: Date.now(), infoHtml: buildInfoHtml(c) }]);
          consecutiveFailures = 0;
        } catch (e: any) {
          // Bad/unresolvable address is normal and expected sometimes — skip
          // it, don't block the rest. But the SAME failure reason on every
          // single address in a row (especially REQUEST_DENIED/
          // OVER_QUERY_LIMIT) means the key/API itself is the problem, not
          // any individual address — worth surfacing once that's clearly
          // what's happening rather than staying silent.
          consecutiveFailures++;
          const status = e?.status || e?.message || "UNKNOWN_ERROR";
          setLastErrorStatus(status);
          if (e?.errorMessage) setDetailedError(e.errorMessage);
          if (consecutiveFailures >= 5 && (status === "REQUEST_DENIED" || status === "OVER_QUERY_LIMIT")) break;
        }
        done++;
        setProgress({ done, total: toGeocode.length });
        await new Promise(r => setTimeout(r, 120));
      }
      writeCache(cache);
      if (!cancelled) setGeocoding(false);
    })();
    return () => { cancelled = true; };
  }, [geoKey, customers.length]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!apiKey) {
    return <div className="h-64 rounded-xl bg-black/30 border border-white/10 flex flex-col items-center justify-center gap-2 text-xs text-white/40 p-4 text-center"><MapPin size={20} className="opacity-40" />Add a Google Maps API key in Settings → Integrations to see customers on a map</div>;
  }

  return (
    <div className="space-y-2">
      {allTags.length > 0 && (
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[11px] text-white/40">Filter by tag:</span>
          <button onClick={() => setTagFilter("")} className={"text-[11px] px-2.5 py-1 rounded-full border transition " + (!tagFilter ? "bg-blue-600/80 border-blue-400/50 text-white" : "bg-black/30 border-white/10 text-white/50 hover:text-white/80")}>
            All ({customers.length})
          </button>
          {allTags.map(tag => (
            <button key={tag} onClick={() => setTagFilter(t => t === tag ? "" : tag)} className={"text-[11px] px-2.5 py-1 rounded-full border transition " + (tagFilter === tag ? "bg-blue-600/80 border-blue-400/50 text-white" : "bg-black/30 border-white/10 text-white/50 hover:text-white/80")}>
              {tag}
            </button>
          ))}
        </div>
      )}
      {geocoding && (
        <div className="text-[11px] text-white/40 flex items-center gap-2">
          <div className="w-3 h-3 border-2 border-white/30 border-t-white/70 rounded-full animate-spin" />
          Locating customers on the map… {progress.done}/{progress.total}
        </div>
      )}
      {!geocoding && pins.length === 0 && (lastErrorStatus === "REQUEST_DENIED" || lastErrorStatus === "OVER_QUERY_LIMIT") && (
        <div className="text-xs text-yellow-200 bg-yellow-950/20 border border-yellow-700/40 rounded-xl p-3 space-y-1.5">
          <div>
            {detailedError?.includes("referer")
              ? `No pins loaded — your Google Maps key has a website/referrer restriction, which Google does not allow for the Geocoding API ("${detailedError}"). Add a separate Geocoding Key with no referrer restriction in Settings → Integrations → Google Maps.`
              : /not authorized/i.test(detailedError || "")
              ? `No pins loaded — this key doesn't have the Geocoding API enabled ("${detailedError}"). Fix: in Google Cloud Console → APIs & Services → Library, search "Geocoding API" and click Enable for this project, then reopen this page. This is separate from the Maps JavaScript/Places APIs the rest of the app uses — each Google Maps API has to be enabled individually per project.`
              : detailedError
              ? `No pins loaded — Google's exact reason: "${detailedError}"`
              : lastErrorStatus === "REQUEST_DENIED"
              ? "No pins loaded because Google rejected every geocode request (REQUEST_DENIED) — the Maps API key in Settings → Integrations most likely doesn't have the Geocoding API enabled, or has a referrer restriction (Geocoding doesn't allow those — add a separate Geocoding Key). Check Settings → Integrations → Google Maps."
              : "No pins loaded — Google's geocoding rate limit was hit immediately (OVER_QUERY_LIMIT). Check the API key's quota/billing in the Google Cloud Console."}
          </div>
          {/* BUG FIX (user report) — "I already enabled that API, I don't
              know why it's still having a problem." Enabling the API on the
              WRONG project/key (e.g. the main referrer-restricted Maps key's
              project, when a separate unrestricted Geocoding Key is set and
              actually being used, or vice versa) looks identical to the
              owner as "I enabled it and it still fails." Showing exactly
              which key is actually making this request — safely, just its
              last 4 characters — lets them confirm in Cloud Console they
              enabled Geocoding API + billing on the RIGHT one instead of
              guessing. */}
          <div className="text-yellow-200/50 font-mono text-[10px]">
            Key in use for this request: ...{geoKey.length > 4 ? geoKey.slice(-4) : geoKey} ({geocodingKey ? "your separate Geocoding Key" : "your main Maps key — no separate Geocoding Key is set"}). Confirm in Google Cloud Console that THIS key's project has Geocoding API enabled with billing active, and that this exact key has no website/referrer restriction.
          </div>
        </div>
      )}
      <LiveMap apiKey={apiKey} pins={visiblePins} heightClassName="h-[70vh] min-h-[420px]" />
      <div className="text-[11px] text-white/40">{visiblePins.length} of {visibleCustomers.filter((c: any) => c.address).length} customers with an address plotted{tagFilter ? ` (filtered: ${tagFilter})` : ""}.</div>
    </div>
  );
}
