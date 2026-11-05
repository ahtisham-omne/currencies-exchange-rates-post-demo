import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { WifiOff } from "lucide-react";

/**
 * Offline is an app state, not a table state: one bar across the top of the
 * app while the browser has no connection. Whatever is already on screen
 * stays. A table whose request then fails shows "Couldn't load"; when the
 * connection comes back the bar goes and that table reloads by itself
 * (TableEmptyState listens for the browser's `online` event).
 *
 * The browser's own signal (`navigator.onLine` / the `offline` event) can be
 * wrong — after sleep, a VPN switch or a Wi-Fi blip Chrome can stay "offline"
 * while requests work fine. So the bar only shows once a real request to our
 * own origin fails, and while it is up it keeps checking and clears itself.
 *
 * Preview in the prototype with `?tableState=offline` on any page, or turn
 * the network off in the browser's dev tools.
 */

const RECHECK_MS = 5000;

/** Any HTTP response means we're online; only a network error means offline. */
async function canReachServer(): Promise<boolean> {
  try {
    await fetch(`/favicon.ico`, { method: "HEAD", cache: "no-store" });
    return true;
  } catch {
    return false;
  }
}

export function OfflineBar() {
  const [params] = useSearchParams();
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const check = async () => {
      // The browser's flag can be wrong both ways; the request decides.
      const reachable = await canReachServer();
      if (!cancelled) setOffline(!reachable);
    };
    const onVisible = () => {
      if (document.visibilityState === "visible") check();
    };

    check();
    window.addEventListener("online", check);
    window.addEventListener("offline", check);
    window.addEventListener("focus", check);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      cancelled = true;
      window.removeEventListener("online", check);
      window.removeEventListener("offline", check);
      window.removeEventListener("focus", check);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);

  // While the bar is up, keep checking so it clears without a reload.
  useEffect(() => {
    if (!offline) return;
    const id = window.setInterval(async () => {
      if (await canReachServer()) setOffline(false);
    }, RECHECK_MS);
    return () => window.clearInterval(id);
  }, [offline]);

  if (!offline && params.get("tableState") !== "offline") return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="shrink-0 flex items-center justify-center gap-2 px-4 h-8 bg-[#FFFBEB] border-b border-[#FDE68A] text-[#92400E]"
      style={{ fontSize: "13px" }}
    >
      <WifiOff className="w-3.5 h-3.5 shrink-0" />
      <span>
        <span style={{ fontWeight: 600 }}>You're offline.</span> What's on screen may be out of date.
      </span>
    </div>
  );
}
