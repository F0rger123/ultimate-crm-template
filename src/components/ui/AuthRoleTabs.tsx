import React from "react";
import { BrandMark } from "./BrandMark";

// BUG FIX (user report) — the three sign-in screens (owner/manager at
// #/login, employee at #/portal, customer at #/client) each drew their own
// header and switcher: different logo sizes and titles, the business name
// saved on this device ("<business> — Client Portal") before anyone had
// signed in, and no way back from the customer screen to the owner or
// employee one. All three now use this header and these tabs, and switching
// is a plain hash change so it always lands on the right screen.
export type AuthRole = "owner" | "employee" | "customer";

const PRODUCT_NAME = "CRM Starter";

const ROLES: Array<{ id: AuthRole; label: string; hash: string }> = [
  { id: "owner", label: "Owner / Manager", hash: "/login" },
  { id: "employee", label: "Employee", hash: "/portal" },
  { id: "customer", label: "Customer", hash: "/client" },
];

export function AuthHeader({ subtitle }: { subtitle: React.ReactNode }) {
  return (
    <div className="text-center">
      <div className="w-16 h-16 rounded-2xl bg-brand-600 flex items-center justify-center mx-auto mb-4 shadow-lg text-brand-fg">
        <BrandMark className="w-10 h-10" />
      </div>
      <div className="text-2xl font-bold tracking-tight text-white">{PRODUCT_NAME}</div>
      <div className="text-sm text-white/50 mt-1">{subtitle}</div>
    </div>
  );
}

export function AuthRoleTabs({ active, onSelect }: { active: AuthRole; onSelect?: (role: AuthRole) => void }) {
  return (
    <div role="tablist" aria-label="Sign in as" className="w-full flex gap-1 p-1 rounded-xl bg-white/5 border border-white/10">
      {ROLES.map(r => (
        <button
          key={r.id}
          type="button"
          role="tab"
          aria-selected={r.id === active}
          onClick={() => {
            if (r.id === active) return;
            if (onSelect) onSelect(r.id);
            else window.location.hash = r.hash;
          }}
          className={
            "flex-1 py-2 rounded-lg text-xs font-medium transition " +
            (r.id === active ? "bg-brand-600/30 border border-brand-500/40 text-white" : "text-white/50 hover:text-white/80")
          }
        >
          {r.label}
        </button>
      ))}
    </div>
  );
}
