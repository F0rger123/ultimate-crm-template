import { useEffect, useState } from "react";

// Single source of truth for the mobile/desktop breakpoint used across the
// app (login layout, sidebar vs. bottom nav, full-screen modals). Listens for
// resize/orientation changes so rotating a device (or resizing a desktop
// window across the breakpoint) updates the layout live, not just on reload.
export function useIsMobile(breakpoint = 768): boolean {
  const [isMobile, setIsMobile] = useState(() => typeof window !== "undefined" && window.innerWidth < breakpoint);
  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth < breakpoint);
    window.addEventListener("resize", onResize);
    window.addEventListener("orientationchange", onResize);
    return () => {
      window.removeEventListener("resize", onResize);
      window.removeEventListener("orientationchange", onResize);
    };
  }, [breakpoint]);
  return isMobile;
}
