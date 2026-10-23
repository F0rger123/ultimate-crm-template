// Stat.tsx — auto-extracted from monolith
import React, { useState, useRef, useEffect, useCallback } from "react";
import { X, ChevronLeft, ChevronRight, Search, TrendingUp, DollarSign, Clock, CheckCircle, AlertTriangle, AlertCircle, Star, Target, BarChart3 } from "lucide-react";

export const Stat = ({ icon: Icon, label, value, change }: { icon?: any; label?: any; value?: any; change?: any }) => (
  <div className="glass-hover bg-surface/40 backdrop-blur-xl border border-edge/30 rounded-2xl shadow-lg p-6 relative overflow-hidden group cursor-default">
    <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500" style={{ background: "radial-gradient(ellipse at top right, rgba(255,255,255,0.10), transparent 70%)" }} />
    <div className="absolute -right-6 -bottom-6 w-28 h-28 rounded-full bg-brand-600/6 group-hover:bg-brand-600/14 transition-all duration-700 group-hover:scale-150" />
    <div className="relative flex items-center justify-between mb-4">
      <div className="p-2.5 rounded-xl bg-brand-600 shadow-lg shadow-brand-900/40 transition-all duration-300 group-hover:shadow-brand-600/50 group-hover:scale-110 text-brand-fg">
        <Icon size={24} className="text-brand-fg" />
      </div>
      {change && <span className="text-xs text-green-400 font-semibold flex items-center gap-1 bg-green-400/10 px-2 py-0.5 rounded-full border border-green-400/20"><TrendingUp size={11} />{change}</span>}
    </div>
    <div className="relative text-4xl font-black text-ink tabular-nums tracking-tight">{value}</div>
    <div className="relative text-xs text-ink-soft/50 mt-1.5 font-medium uppercase tracking-wider">{label}</div>
  </div>
);


