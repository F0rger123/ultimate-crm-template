import { useEffect, useState } from "react";

// FEATURE — "make the employee portal work offline and automatically sync
// when back online." navigator.onLine is the one reliable, zero-dependency
// signal for this (a real network-reachability check would need its own
// endpoint and polling — onLine plus the online/offline events is what
// every browser already gives us for free, and is accurate enough for
// "should I attempt a Supabase write right now").
export function useOnlineStatus(): boolean {
  const [online, setOnline] = useState(() => typeof navigator !== "undefined" ? navigator.onLine : true);
  useEffect(() => {
    const goOnline = () => setOnline(true);
    const goOffline = () => setOnline(false);
    window.addEventListener("online", goOnline);
    window.addEventListener("offline", goOffline);
    return () => {
      window.removeEventListener("online", goOnline);
      window.removeEventListener("offline", goOffline);
    };
  }, []);
  return online;
}
