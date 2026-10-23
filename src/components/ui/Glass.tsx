// Glass.tsx — auto-extracted from monolith
import React, { useState, useRef, useEffect, useCallback } from "react";

// THEME FOUNDATION — surface/edge are CSS-variable-backed Tailwind tokens
// (tailwind.config.js) that swap value under [data-theme="light"] on <html>;
// bg-black/40 + border-brand-900/30 were the literal always-dark equivalent.
export const Glass = ({ children, className = "", ...r }) => <div className={"glass-hover bg-surface/40 backdrop-blur-xl border border-edge/30 rounded-2xl shadow-lg " + className} {...r}>{children}</div>;

// NOTE — a duplicate, unexported (dead) local GBtn used to be defined here
// too; the real one every page imports is GBtn.tsx. Removed to avoid two
// diverging copies.

