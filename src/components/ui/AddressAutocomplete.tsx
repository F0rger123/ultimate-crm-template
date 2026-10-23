import React, { useState, useRef, useEffect } from "react";
import { MapPin, ExternalLink } from "lucide-react";
import { GInput } from "./GInput";

// Singleton Google Maps JS loader — loads once per page, queues callbacks.
// Rejects (rather than always resolving) on failure so callers can tell a
// real load error apart from success, retries once automatically. Also used
// by AddressAutocomplete below (Places library) and by LiveMap (employee
// location pins) and the ETA/distance-matrix features.
let _ready = false;
let _loading = false;
let _failed: Error | null = null;
// BUG FIX — "I re-added my key / made a new one, still gave me an error."
// _ready was a bare boolean with no memory of WHICH key it was loaded
// with. Google's JS loader script itself always "succeeds" even with a
// bad/restricted key (only the actual API calls — Geocoder, Places —
// fail at runtime with REQUEST_DENIED), so once _ready flipped true for
// an old/bad key, every later call in the same browser tab short-
// circuited straight to "already loaded" and kept silently using that
// stale key — updating the key in Settings had no effect until a hard
// page refresh, which nothing ever told the owner they needed. Now
// tracks which key is actually loaded and self-heals with one automatic
// reload the moment a different key shows up, since the Maps JS API has
// no supported way to hot-swap keys on an already-loaded page.
let _readyKey: string | null = null;
const MAPS_KEY_RELOAD_FLAG = "crm.mapsKeyReloadedOnce";
const _queue: Array<{ resolve: () => void; reject: (e: Error) => void }> = [];
const GMAPS_CALLBACK = "__crmGMapsLoaded";

function injectScript(key: string, onDone: (err: Error | null) => void) {
  const cbName = GMAPS_CALLBACK + Date.now();
  (window as any)[cbName] = () => { delete (window as any)[cbName]; onDone(null); };
  const s = document.createElement("script");
  s.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(key)}&libraries=places&loading=async&callback=${cbName}`;
  s.async = true;
  s.onerror = (ev) => {
    console.error("Google Maps script failed to load — check the key's API restrictions include \"Maps JavaScript API\" and its HTTP referrer restrictions include this origin:", window.location.origin, ev);
    s.remove();
    onDone(new Error(`Google Maps script failed to load from ${s.src.split("?")[0]} (origin: ${window.location.origin})`));
  };
  document.head.appendChild(s);
}

export function loadMapsScript(key: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if (_ready && _readyKey === key) { resolve(); return; }
    if ((_ready || (window as any).google?.maps?.importLibrary) && _readyKey !== null && _readyKey !== key) {
      // The key changed since this tab loaded Maps — self-heal with ONE
      // automatic reload (guarded so it can only ever fire once per bad
      // load, never loops) instead of leaving a stale key silently active.
      if (!sessionStorage.getItem(MAPS_KEY_RELOAD_FLAG)) {
        sessionStorage.setItem(MAPS_KEY_RELOAD_FLAG, "1");
        console.warn("[Maps] API key changed since this page loaded — reloading once to pick up the new key.");
        window.location.reload();
        return; // page is reloading — this promise never needs to settle
      }
      reject(new Error("Google Maps API key changed but a fresh page load didn't pick it up — try a hard refresh."));
      return;
    }
    if ((window as any).google?.maps?.importLibrary) { _ready = true; _readyKey = key; try { sessionStorage.removeItem(MAPS_KEY_RELOAD_FLAG); } catch { /* ignore */ } resolve(); return; }
    _queue.push({ resolve, reject });
    if (_loading) return;
    _loading = true;
    _failed = null;
    const settle = (err: Error | null) => {
      _loading = false;
      if (err) { _ready = false; _readyKey = null; _failed = err; }
      else { _ready = true; _readyKey = key; _failed = null; try { sessionStorage.removeItem(MAPS_KEY_RELOAD_FLAG); } catch { /* ignore */ } }
      const q = _queue.splice(0, _queue.length);
      q.forEach(p => err ? p.reject(err) : p.resolve());
    };
    injectScript(key, (err) => {
      if (!err) { settle(null); return; }
      console.warn("Google Maps script load failed — retrying once in 800ms:", err.message);
      setTimeout(() => injectScript(key, (err2) => {
        if (err2) console.error("Google Maps script load failed again on retry:", err2.message);
        settle(err2);
      }), 800);
    });
  });
}

export interface PlaceResult {
  street: string;
  city: string;
  state: string;
  zip: string;
  lat?: number;
  lng?: number;
}

// Local fallback — string-match against addresses already in the CRM.
// Substring OR per-word prefix match, so "2780" matches "2780 Prospect Ave"
// and "prospect" matches it too. Case-insensitive, de-duped, capped at 6.
function matchKnownAddresses(q: string, knownAddresses: string[]): string[] {
  const needle = q.trim().toLowerCase();
  if (!needle) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const addr of knownAddresses) {
    if (!addr) continue;
    const lower = addr.toLowerCase();
    const words = lower.split(/[\s,]+/);
    const matches = lower.includes(needle) || words.some(w => w.startsWith(needle));
    if (matches && !seen.has(addr)) {
      seen.add(addr);
      out.push(addr);
      if (out.length >= 6) break;
    }
  }
  return out;
}

// FIX 9 — Google Places is back as the PRIMARY suggestion source (real,
// worldwide addresses as the owner types), via the new Promise-based
// `AutocompleteSuggestion.fetchAutocompleteSuggestions` API — NOT the
// deprecated callback-based `AutocompleteService`, which Google blocks for
// any Cloud project created after March 2025 ("AutocompleteService is not
// available to new customers. Please use AutocompleteSuggestion"). Local CRM
// matches (instant, no network, never blocked by a key restriction) are now
// the FALLBACK: shown whenever there's no key configured, the Places call is
// still loading/hasn't returned yet, or it errors — the input is never left
// with zero suggestions just because Google is unavailable. A restricted key
// (Cloud Console 403) surfaces as a specific, actionable banner instead of a
// silent console warning.
export function AddressAutocomplete({
  value: rawValue = "",
  onChange,
  onPlaceSelect,
  placeholder = "Start typing an address...",
  mapsKey = "",
  className = "",
  knownAddresses = [],
}: {
  value?: string | null;
  onChange: (v: string) => void;
  onPlaceSelect?: (place: PlaceResult) => void;
  placeholder?: string;
  mapsKey?: string;
  className?: string;
  knownAddresses?: string[];
}) {
  // BUG FIX — "Cannot read properties of null (reading 'trim')" crashed the
  // whole customer-edit modal. A default parameter (`value = ""`) only
  // kicks in for `undefined`, NOT `null` — and `f.address` coming straight
  // off a Supabase row can genuinely be null (e.g. a customer saved before
  // an address was ever entered), so `value` here was null despite the
  // default, and every direct value.trim() below threw. Coercing here
  // protects every call site at once, not just the one that crashed.
  const value = rawValue || "";
  const [open, setOpen] = useState(false);
  // Local CRM matches — instant, synchronous, always available fallback.
  const localMatches = value.trim().length >= 2 ? matchKnownAddresses(value, knownAddresses) : [];

  const [placePreds, setPlacePreds] = useState<string[]>([]);
  const [placesLoading, setPlacesLoading] = useState(false);
  // A restricted/blocked API key (Google's error: "Requests to this API ...
  // are blocked") previously only ever showed up in the browser console —
  // surface it as a visible, specific banner instead so the owner can fix it
  // without opening devtools.
  const [placesError, setPlacesError] = useState<"blocked" | "other" | null>(null);
  const placesLibRef = useRef<any>(null);
  const debounceRef = useRef<any>(null);
  // Raw Places predictions (kept alongside the plain-text placePreds array)
  // so a selection can resolve real lat/lng via .toPlace().fetchFields() —
  // see FIX below. Not put in React state since nothing needs to re-render
  // off it, only read at selection time.
  const predictionsRef = useRef<any[]>([]);
  useEffect(() => {
    if (!mapsKey) {
      setPlacePreds([]);
      setPlacesError(null);
      return;
    }
    if (value.trim().length < 3) { setPlacePreds([]); setPlacesLoading(false); return; }
    clearTimeout(debounceRef.current);
    setPlacesLoading(true);
    debounceRef.current = setTimeout(async () => {
      try {
        if (!placesLibRef.current) {
          await loadMapsScript(mapsKey);
          const g = (window as any).google;
          if (!g?.maps?.importLibrary) throw new Error("Maps JS API unavailable");
          placesLibRef.current = await g.maps.importLibrary("places");
        }
        const { AutocompleteSuggestion } = placesLibRef.current;
        if (!AutocompleteSuggestion?.fetchAutocompleteSuggestions) throw new Error("AutocompleteSuggestion unavailable — this key/project may still be on the old, deprecated Places API");
        const { suggestions } = await AutocompleteSuggestion.fetchAutocompleteSuggestions({
          input: value, includedRegionCodes: ["us"], includedPrimaryTypes: ["street_address", "route", "premise"],
        });
        const preds = (suggestions || [])
          .filter((s: any) => s.placePrediction?.text)
          .slice(0, 6);
        console.log("[Autocomplete] Google Places returned", preds.length, "suggestions");
        predictionsRef.current = preds;
        setPlacePreds(preds.map((s: any) => s.placePrediction.text.toString()));
        setPlacesError(null);
      } catch (e: any) {
        const msg = String(e?.message || e || "");
        const blocked = /blocked|forbidden|403|not authorized|REQUEST_DENIED/i.test(msg);
        console.warn("[Autocomplete] Google Places lookup failed — falling back to local CRM matches:", msg);
        setPlacesError(blocked ? "blocked" : "other");
        setPlacePreds([]);
      } finally {
        setPlacesLoading(false);
      }
    }, 250);
    return () => clearTimeout(debounceRef.current);
  }, [value, mapsKey]);

  // Google Places is the primary source; local CRM matches fill in whenever
  // Places has nothing yet (no key, still loading, errored, or genuinely no
  // results) — deduped against whatever Google already returned.
  const suggestions = placePreds.length > 0
    ? [...placePreds, ...localMatches.filter(m => !placePreds.includes(m))].slice(0, 6)
    : localMatches.slice(0, 6);
  const usingLocalFallback = mapsKey && placePreds.length === 0 && !placesLoading;

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = e.target.value;
    onChange(v);
    setOpen(true);
  };

  // FIX — onPlaceSelect was accepted as a prop but never actually called
  // (destructured as `_onPlaceSelect` and dropped), so every job/customer
  // address ever saved through this component carried no coordinates.
  // That silently made lat/lng-dependent features (route optimization,
  // GPS arrival prompts) permanently inert — they'd fall back to
  // placeholder/random coordinates or just never fire, with no visible
  // error anywhere, since a missing optional field doesn't throw. Now
  // resolves real coordinates via the same Places library already loaded
  // for suggestions (`.toPlace().fetchFields()`) when the selection came
  // from Google (skipped for a local-CRM-match pick, which has no
  // corresponding Places prediction to resolve).
  const handleSelect = (s: string) => {
    onChange(s);
    setOpen(false);
    if (!onPlaceSelect) return;
    const pred = predictionsRef.current.find((p: any) => p.placePrediction?.text?.toString() === s);
    if (!pred?.placePrediction?.toPlace) return;
    (async () => {
      try {
        const place = pred.placePrediction.toPlace();
        await place.fetchFields({ fields: ["location", "addressComponents", "formattedAddress"] });
        const loc = place.location;
        const lat = typeof loc?.lat === "function" ? loc.lat() : loc?.lat;
        const lng = typeof loc?.lng === "function" ? loc.lng() : loc?.lng;
        const comp = (type: string) => place.addressComponents?.find((c: any) => c.types?.includes(type))?.longText || place.addressComponents?.find((c: any) => c.types?.includes(type))?.shortText || "";
        onPlaceSelect({
          street: [comp("street_number"), comp("route")].filter(Boolean).join(" "),
          city: comp("locality") || comp("sublocality"),
          state: comp("administrative_area_level_1"),
          zip: comp("postal_code"),
          ...(typeof lat === "number" && typeof lng === "number" ? { lat, lng } : {}),
        });
      } catch (e: any) {
        console.warn("[Autocomplete] fetchFields for coordinates failed:", e?.message);
      }
    })();
  };

  const verifyOnMaps = () => {
    if (!value.trim()) return;
    window.open(`https://www.google.com/maps?q=${encodeURIComponent(value.trim())}`, "_blank", "noopener,noreferrer");
  };

  return (
    <div className="relative">
      <div className="relative flex gap-1.5">
        <div className="relative flex-1">
          <GInput
            value={value}
            onChange={handleChange}
            onFocus={() => value.length > 2 && setOpen(true)}
            onBlur={() => setTimeout(() => setOpen(false), 200)}
            placeholder={placeholder}
            className={className}
            name="address"
            autoComplete="street-address"
          />
        </div>
        <button
          type="button"
          onClick={verifyOnMaps}
          disabled={!value.trim()}
          title="Open this address in Google Maps to verify it"
          className="flex-shrink-0 px-3 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 text-white/60 hover:text-white disabled:opacity-30 transition flex items-center gap-1.5 text-xs"
        >
          <ExternalLink size={13} />
          Verify
        </button>
      </div>
      {!mapsKey && !open && !value && (
        <div className="text-[9px] text-white/30 mt-1 pl-1">
          Add a Google Maps API key in Settings → Integrations for real address suggestions · showing saved CRM matches only for now
        </div>
      )}
      {/* BUG FIX — the "blocked" banner used to print the full Google Cloud
          Console fix checklist every time this fired. For an owner who's
          already worked through that checklist and still hits the same
          error, repeating it on every keystroke is just noise, not help —
          the address field already works fine via the local CRM-match
          fallback below, so there's nothing actionable left to show here.
          Errors still land in the console (see the catch block above) for
          anyone actually debugging it. */}
      {open && suggestions.length === 0 && value.trim().length >= 3 && !placesLoading && (
        <div className="absolute z-50 left-0 right-0 top-full mt-1 bg-black/95 border border-white/10 rounded-xl px-3 py-2 text-[10px] text-white/40">
          No matches yet — keep typing, or just finish the address manually.
        </div>
      )}
      {open && suggestions.length > 0 && (
        <div className="absolute z-50 left-0 right-0 top-full mt-1 bg-black/95 border border-brand-900/40 rounded-xl shadow-2xl overflow-hidden">
          {placePreds.length > 0 && (
            <div className="px-3 py-1.5 text-[9px] text-white/40 bg-white/5 border-b border-white/10">
              Google Maps
            </div>
          )}
          {placePreds.length > 0 && placePreds.slice(0, 6).map((s, i) => (
            <button
              key={"g" + i}
              onMouseDown={() => handleSelect(s)}
              className="w-full text-left px-3 py-2.5 text-xs text-white/80 hover:bg-brand-900/30 hover:text-white transition flex items-center gap-2 border-b border-brand-900/10 last:border-0"
            >
              <MapPin size={11} className="text-blue-400 flex-shrink-0" />
              {s}
            </button>
          ))}
          {usingLocalFallback && localMatches.length > 0 && (
            <div className="px-3 py-1.5 text-[9px] text-white/40 bg-white/5 border-b border-white/10">
              From your customers
            </div>
          )}
          {usingLocalFallback && localMatches.slice(0, 6).map((s, i) => (
            <button
              key={"l" + i}
              onMouseDown={() => handleSelect(s)}
              className="w-full text-left px-3 py-2.5 text-xs text-white/80 hover:bg-brand-900/30 hover:text-white transition flex items-center gap-2 border-b border-brand-900/10 last:border-0"
            >
              <MapPin size={11} className="text-brand-400 flex-shrink-0" />
              {s}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
