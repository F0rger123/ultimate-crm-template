import React from "react";

// Street View Static API kept failing with 403 "this API key is not
// authorized" regardless of which Cloud Console restriction was changed.
// This sidesteps the problem completely: maps.google.com's plain embed URL
// renders a real map (with Street View available via the pegman control
// inside the embed itself) and needs NO API key and NO restrictions at all.
//
// output=svembed (the dedicated Street View embed) needs a lat/lng (cbll=),
// not a free-text address — and getting lat/lng back for an address means a
// geocoding call, which is exactly the API-key-restricted call that kept
// 403'ing. No customer/job record stores coordinates today, so forcing
// svembed would either break (no imagery at the query point) or require
// reintroducing the same broken dependency. Keeping the satellite/map embed.
export function PropertyMapEmbed({ address, className = "", height = 192 }: { address: string; className?: string; height?: number }) {
  if (!address) return null;
  return (
    <iframe
      title={"Map — " + address}
      src={`https://maps.google.com/maps?q=${encodeURIComponent(address)}&output=embed`}
      className={"w-full rounded-xl border border-white/10 " + className}
      style={{ height, border: 0 }}
      loading="lazy"
      referrerPolicy="no-referrer-when-downgrade"
    />
  );
}
