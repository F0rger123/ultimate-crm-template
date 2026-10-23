// GBtn.tsx — auto-extracted from monolith
import React, { useState, useRef, useEffect, useCallback } from "react";

export const GBtn = ({ children, onClick, variant = "primary", className = "", disabled, ...r }: { children?: any; onClick?: any; variant?: string; className?: string; disabled?: any; [key: string]: any }) => {
  const v = {
    primary: "bg-brand-600 hover:from-brand-500 hover:to-brand-700 text-brand-fg border-brand-500/50",
    ghost: "bg-surface-2/5 hover:bg-surface-2/10 text-ink border-surface-2/10",
    danger: "bg-danger-950/50 hover:bg-danger-900/60 text-danger-200 border-danger-800/50"
  };
  return <button type="button" disabled={disabled} onClick={onClick} className={v[variant] + " btn-hover backdrop-blur-md border rounded-xl px-4 py-2 text-sm font-medium transition-all disabled:opacity-40 disabled:cursor-not-allowed " + className} {...r}>{children}</button>;
};

