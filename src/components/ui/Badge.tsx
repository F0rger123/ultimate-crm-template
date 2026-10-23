// Badge.tsx — auto-extracted from monolith
import React, { useState, useRef, useEffect, useCallback } from "react";
import { X, ChevronLeft, ChevronRight, Search, TrendingUp, DollarSign, Clock, CheckCircle, AlertTriangle, AlertCircle, Star, Target, BarChart3 } from "lucide-react";

export const Badge = ({ children, tone = "red" }) => {
  const t = {
    red: "bg-danger-900/40 text-danger-300 border-danger-800/50",
    green: "bg-green-900/40 text-green-300 border-green-800/50",
    yellow: "bg-yellow-900/40 text-yellow-300 border-yellow-800/50",
    blue: "bg-blue-900/40 text-blue-300 border-blue-800/50",
    gray: "bg-surface-2/5 text-ink-soft/60 border-surface-2/10",
    purple: "bg-purple-900/40 text-purple-300 border-purple-800/50",
    orange: "bg-orange-900/40 text-orange-300 border-orange-800/50"
  };
  return <span className={"text-[10px] px-2 py-1 rounded-full uppercase tracking-wider font-medium border whitespace-nowrap inline-flex items-center gap-1 " + (t[tone] || t.gray)}>{children}</span>;
};

