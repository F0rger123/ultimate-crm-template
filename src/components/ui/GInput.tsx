// GInput.tsx — auto-extracted from monolith
import React, { useState, useRef, useEffect, useCallback } from "react";

export const GInput = ({ className = "", ...r }) => <input className={"w-full bg-surface/40 backdrop-blur-md border border-edge/30 rounded-xl px-4 py-2.5 text-ink placeholder-ink-soft/40 focus:outline-none focus:border-brand-500/60 focus:ring-1 focus:ring-brand-500/20 transition-all duration-200 " + className} {...r} />;
// NOTE — GDate/GSel here are dead unexported dupes of GDate.tsx/GSel.tsx (the
// real, imported versions) — left as-is, not touched, to avoid two
// diverging copies; see those files for the theme-token conversion.
