import React, { useEffect, useRef, useState } from "react";
import { Moon, Sun, Satellite, Eye } from "lucide-react";
import { loadMapsScript } from "./AddressAutocomplete";

export interface LiveMapPin {
  id: string;
  label: string;
  lat: number;
  lng: number;
  updatedAt: number;
  // FEATURE — job-location pins (the property address, from the job's own
  // geocoded lat/lng) are plotted alongside employee GPS pins so "where is
  // this job" is visible even when the employee hasn't turned on live
  // location sharing. Blue distinguishes a job pin from the default red
  // employee-location pin at a glance.
  kind?: "employee" | "job";
  // FEATURE — "a map with pins for where their jobs are, with a line
  // connecting stop 1, stop 2, stop 3, stop 4." When set, the pin's marker
  // label is this stop number instead of the first letter of `label`, and
  // (when `routeLine` is also true on the map) a polyline is drawn through
  // every numbered pin in ascending stop order.
  stopNumber?: number;
  // FEATURE — "hovering over a pin should show the customer name, and
  // clicking should display a pop-up with customer information." Rich HTML
  // shown in a real InfoWindow on click (phone/email/tags/etc) — falls back
  // to just `label` when a caller doesn't supply this (Live Crew View's
  // employee/job pins keep their existing plain-name behavior unchanged).
  infoHtml?: string;
}

const DARK_STYLE = [
  { elementType: "geometry", stylers: [{ color: "#1a1a1a" }] },
  { elementType: "labels.text.stroke", stylers: [{ color: "#1a1a1a" }] },
  { elementType: "labels.text.fill", stylers: [{ color: "#8a8a8a" }] },
  { featureType: "road", elementType: "geometry", stylers: [{ color: "#2c2c2c" }] },
  { featureType: "water", elementType: "geometry", stylers: [{ color: "#0e1626" }] },
  { featureType: "poi", elementType: "geometry", stylers: [{ color: "#262626" }] },
];

// Real Google Map for Crew View → Live Now — plots one pin per employee
// currently sharing their location, with dark/satellite/street-view toggles
// and a "last updated" readout per pin (via marker title + an inline list).
export function LiveMap({ apiKey, pins, heightClassName = "h-56", routeLine = false }: { apiKey: string; pins: LiveMapPin[]; heightClassName?: string; routeLine?: boolean }) {
  const mapRef = useRef<HTMLDivElement | null>(null);
  const mapObjRef = useRef<any>(null);
  const markersRef = useRef<any[]>([]);
  const routeLineRef = useRef<any>(null);
  const streetViewRef = useRef<any>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState("");
  const [dark, setDark] = useState(true);
  const [satellite, setSatellite] = useState(false);
  const [streetViewOn, setStreetViewOn] = useState(false);

  useEffect(() => {
    if (!apiKey || !mapRef.current) return;
    let cancelled = false;
    loadMapsScript(apiKey)
      .then(() => {
        if (cancelled || !mapRef.current || !(window as any).google) return;
        const g = (window as any).google;
        const center = pins[0] ? { lat: pins[0].lat, lng: pins[0].lng } : { lat: 39.9626, lng: -76.7277 };
        mapObjRef.current = new g.maps.Map(mapRef.current, {
          center, zoom: 11, disableDefaultUI: true, zoomControl: true,
          mapTypeId: satellite ? "satellite" : "roadmap",
          styles: dark && !satellite ? DARK_STYLE : [],
        });
        streetViewRef.current = mapObjRef.current.getStreetView();
        // BUG FIX — "click a pin, then click away, it should close." Google's
        // InfoWindow does NOT auto-close on an outside map click by default
        // (only via its own [x] or another explicit .close() call) — clicking
        // empty map space left every previously-opened pin popup stuck open.
        // Marker clicks don't bubble into this map-level listener (Maps JS
        // keeps marker and map click events separate), so this only fires for
        // genuine "clicked away" clicks.
        mapObjRef.current.addListener("click", () => {
          markersRef.current.forEach(m => m.__clickInfo?.close());
        });
        setReady(true);
      })
      .catch((e: Error) => setError(e.message));
    return () => { cancelled = true; };
  }, [apiKey]); // eslint-disable-line react-hooks/exhaustive-deps

  // Re-apply map type / style without re-creating the map instance
  useEffect(() => {
    if (!mapObjRef.current) return;
    mapObjRef.current.setMapTypeId(satellite ? "satellite" : "roadmap");
    mapObjRef.current.setOptions({ styles: dark && !satellite ? DARK_STYLE : [] });
  }, [dark, satellite]);

  useEffect(() => {
    if (!streetViewRef.current) return;
    streetViewRef.current.setVisible(streetViewOn);
    if (streetViewOn && pins[0]) streetViewRef.current.setPosition({ lat: pins[0].lat, lng: pins[0].lng });
  }, [streetViewOn]); // eslint-disable-line react-hooks/exhaustive-deps

  // Re-plot pins whenever they change (e.g. the 10s owner-side refresh)
  useEffect(() => {
    if (!ready || !mapObjRef.current) return;
    const g = (window as any).google;
    markersRef.current.forEach(m => {
      m.__hoverInfo?.close();
      m.__clickInfo?.close();
      m.setMap(null);
    });
    markersRef.current = pins.map(p => {
      const marker = new g.maps.Marker({
        position: { lat: p.lat, lng: p.lng },
        map: mapObjRef.current,
        label: { text: p.stopNumber != null ? String(p.stopNumber) : (p.label[0]?.toUpperCase() || "?"), color: "#fff", fontWeight: "700" },
        icon: p.kind === "job" ? { url: "https://maps.google.com/mapfiles/ms/icons/blue-dot.png" } : undefined,
      });
      // FEATURE — "hovering over a pin should show the customer name, and
      // clicking should display a pop-up with customer information." A
      // styled InfoWindow (not the unstyled native `title` tooltip) shows
      // just the name on hover; a click swaps in the richer `infoHtml`.
      // BUG FIX — text here had no explicit color, so it silently inherited
      // the app root's `text-white` (App.tsx) onto Google's white InfoWindow
      // background — invisible text, not a layout bug. See CustomerMapView's
      // buildInfoHtml comment for the full story; same fix here for callers
      // that don't supply their own infoHtml (Crew View's plain pins).
      const hoverName = `${p.stopNumber != null ? `Stop ${p.stopNumber} — ` : ""}${p.label}`;
      const hoverInfo = new g.maps.InfoWindow({
        content: `<div style="font:600 12px system-ui,sans-serif;padding:2px 4px;color:#111;">${hoverName}</div>`,
        disableAutoPan: true,
      });
      const clickInfo = new g.maps.InfoWindow({
        content: p.infoHtml || `<div style="font:600 13px system-ui,sans-serif;padding:2px 4px;color:#111;">${hoverName}<br/><span style="font-weight:400;color:#666;font-size:11px;">updated ${new Date(p.updatedAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}</span></div>`,
      });
      // FEATURE — a caller's infoHtml (CustomerMapView) can include a button
      // with id="cmv-view-<id>"; an inline onclick="" attribute on InfoWindow
      // content isn't reliably wired up by the Maps JS API, but `domready`
      // (fired each time this content is actually attached to the page DOM)
      // is Google's own documented hook for real interactivity — a no-op for
      // any pin whose content doesn't include that button.
      clickInfo.addListener("domready", () => {
        const btn = document.getElementById(`cmv-view-${p.id}`);
        if (btn) btn.onclick = () => (window as any).__cmvViewCustomer?.(p.id);
      });
      marker.__hoverInfo = hoverInfo;
      marker.__clickInfo = clickInfo;
      marker.addListener("mouseover", () => { if (!clickInfo.get("map")) hoverInfo.open(mapObjRef.current, marker); });
      marker.addListener("mouseout", () => hoverInfo.close());
      marker.addListener("click", () => {
        hoverInfo.close();
        markersRef.current.forEach(m => { if (m !== marker) m.__clickInfo?.close(); });
        clickInfo.open(mapObjRef.current, marker);
      });
      return marker;
    });
    // FEATURE — "a line connecting stop 1, stop 2, stop 3, stop 4." Draws
    // through every stopNumber-tagged pin in ascending order — a real
    // route line, not just floating pins with no sense of order.
    routeLineRef.current?.setMap(null);
    routeLineRef.current = null;
    if (routeLine) {
      const numbered = pins.filter(p => p.stopNumber != null).sort((a, b) => (a.stopNumber || 0) - (b.stopNumber || 0));
      if (numbered.length > 1) {
        routeLineRef.current = new g.maps.Polyline({
          path: numbered.map(p => ({ lat: p.lat, lng: p.lng })),
          geodesic: true,
          strokeColor: "#3b82f6",
          strokeOpacity: 0.85,
          strokeWeight: 3,
          map: mapObjRef.current,
        });
      }
    }
    if (pins.length > 1) {
      const bounds = new g.maps.LatLngBounds();
      pins.forEach(p => bounds.extend({ lat: p.lat, lng: p.lng }));
      mapObjRef.current.fitBounds(bounds);
    } else if (pins.length === 1) {
      mapObjRef.current.setCenter({ lat: pins[0].lat, lng: pins[0].lng });
    }
  }, [ready, pins, routeLine]);

  if (!apiKey) {
    return <div className="h-48 rounded-xl bg-black/30 border border-white/10 flex items-center justify-center text-xs text-white/30">Add a Google Maps API key in Settings to see live locations on a map</div>;
  }
  if (error) {
    return <div className="h-48 rounded-xl bg-black/30 border border-yellow-700/40 flex items-center justify-center text-xs text-yellow-200 p-3 text-center">{error}</div>;
  }

  return (
    <div className="space-y-1.5">
      <div className="relative">
        <div ref={mapRef} className={heightClassName + " rounded-xl overflow-hidden border border-white/10"} />
        <div className="absolute top-2 right-2 flex gap-1">
          <button onClick={() => setDark(d => !d)} title="Toggle dark mode" className={"w-7 h-7 rounded-lg flex items-center justify-center border " + (dark ? "bg-blue-600/80 border-blue-400/50 text-white" : "bg-black/60 border-white/20 text-white/70")}>
            {dark ? <Moon size={13} /> : <Sun size={13} />}
          </button>
          <button onClick={() => setSatellite(s => !s)} title="Toggle satellite view" className={"w-7 h-7 rounded-lg flex items-center justify-center border " + (satellite ? "bg-blue-600/80 border-blue-400/50 text-white" : "bg-black/60 border-white/20 text-white/70")}>
            <Satellite size={13} />
          </button>
          <button onClick={() => setStreetViewOn(s => !s)} title="Toggle Street View" disabled={pins.length === 0} className={"w-7 h-7 rounded-lg flex items-center justify-center border disabled:opacity-30 " + (streetViewOn ? "bg-blue-600/80 border-blue-400/50 text-white" : "bg-black/60 border-white/20 text-white/70")}>
            <Eye size={13} />
          </button>
        </div>
      </div>
      {pins.length > 0 && pins.length <= 30 && (
        <div className="flex flex-wrap gap-1.5">
          {pins.map(p => (
            <span key={p.id} className="text-[10px] px-2 py-0.5 rounded-full bg-black/40 border border-white/10 text-white/50">
              {p.label} · {new Date(p.updatedAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
