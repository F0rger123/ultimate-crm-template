import { useEffect } from "react";

const CSS = `
  * { box-sizing: border-box; }

  /* Colors come from the THEME TOKENS in src/index.css — don't hardcode them here. */

  body {
    background: #050505;
    color: white;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    -webkit-tap-highlight-color: transparent;
    overscroll-behavior: none;
  }

  /* Custom scrollbar */
  ::-webkit-scrollbar { width: 4px; height: 4px; }
  ::-webkit-scrollbar-track { background: transparent; }
  ::-webkit-scrollbar-thumb { background: rgb(var(--glow) / 0.15); border-radius: 99px; }
  ::-webkit-scrollbar-thumb:hover { background: rgb(var(--glow) / 0.3); }

  /* Glass morphism base */
  .glass {
    background: rgba(255,255,255,0.03);
    border: 1px solid rgb(var(--edge-rgb) / 0.6);
    backdrop-filter: blur(12px);
    border-radius: 16px;
  }

  /* Animations */
  @keyframes fade-in {
    from { opacity: 0; transform: translateY(8px); }
    to   { opacity: 1; transform: translateY(0); }
  }
  @keyframes slide-in-right {
    from { opacity: 0; transform: translateX(16px); }
    to   { opacity: 1; transform: translateX(0); }
  }
  @keyframes pulse-ring {
    0%   { box-shadow: 0 0 0 0 rgb(var(--glow) / 0.4); }
    70%  { box-shadow: 0 0 0 10px rgb(var(--glow) / 0); }
    100% { box-shadow: 0 0 0 0 rgb(var(--glow) / 0); }
  }
  @keyframes shimmer {
    0%   { background-position: -200% 0; }
    100% { background-position: 200% 0; }
  }
  @keyframes spin {
    to { transform: rotate(360deg); }
  }

  .animate-fade-in       { animation: fade-in 0.3s ease both; }
  .animate-slide-right   { animation: slide-in-right 0.25s ease both; }
  .animate-pulse-ring    { animation: pulse-ring 2s ease infinite; }
  .animate-spin          { animation: spin 1s linear infinite; }

  /* Gradient text */
  .gradient-text {
    background: linear-gradient(135deg, rgb(var(--brand-600)), rgb(var(--brand-900)));
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
  }

  /* Touch targets */
  @media (max-width: 640px) {
    button, a { min-height: 36px; }
  }

  /* No outline on mobile tap */
  button:focus, input:focus, textarea:focus, select:focus {
    outline: none;
  }
  button:focus-visible {
    outline: 2px solid rgb(var(--brand-600));
    outline-offset: 2px;
  }

  /* Line clamp utilities */
  .line-clamp-2 {
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }
  .line-clamp-3 {
    display: -webkit-box;
    -webkit-line-clamp: 3;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }
`;

let injected = false;

export function useGlobalStyles(): void {
  useEffect(() => {
    if (injected) return;
    const style = document.createElement("style");
    style.id = "crm-global";
    style.textContent = CSS;
    document.head.appendChild(style);
    injected = true;
  }, []);
}
