// PBar.tsx — auto-extracted from monolith
import React, { useState, useRef, useEffect, useCallback } from "react";

export const PBar = ({ value, max }) => {
  const p = Math.min(100, (value / max) * 100);
  return <div className="h-2 bg-black/40 rounded-full overflow-hidden border border-brand-900/30"><div className="h-full bg-brand-600 rounded-full transition-all text-brand-fg" style={{ width: p + "%" }} /></div>;
};

