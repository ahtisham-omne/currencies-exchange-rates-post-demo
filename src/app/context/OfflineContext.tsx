import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { toast } from "sonner";
import { WifiOff } from "lucide-react";
import { IconCircle } from "../components/ui/sonner";

/**
 * Simulated "no internet" state for demos and design review.
 *
 * `goOffline()` dims the whole app behind the standard modal overlay and
 * raises an error toast (top-right, above the overlay). Closing the
 * toast brings the app back.
 */

interface OfflineContextType {
  isOffline: boolean;
  goOffline: () => void;
  goOnline: () => void;
}

const OfflineContext = createContext<OfflineContextType | undefined>(undefined);

const OFFLINE_TOAST_ID = "offline";

export function OfflineProvider({ children }: { children: React.ReactNode }) {
  const [isOffline, setIsOffline] = useState(false);
  const { pathname } = useLocation();

  const goOnline = useCallback(() => {
    setIsOffline(false);
    toast.dismiss(OFFLINE_TOAST_ID);
  }, []);

  const goOffline = useCallback(() => {
    setIsOffline(true);
    toast.error("Connection problem", {
      id: OFFLINE_TOAST_ID,
      description: "We're having trouble connecting. Refresh the page and try again.",
      // Same red circle as the toaster's error icon, with a wifi-off glyph.
      icon: (
        <IconCircle bg="hsl(var(--destructive))" halo="rgba(220, 40, 40, 0.13)">
          <WifiOff className="w-3 h-3" strokeWidth={3} />
        </IconCircle>
      ),
      duration: Infinity,
      // The toaster's close X (or a swipe) dismisses it and lifts the overlay.
      onDismiss: () => setIsOffline(false),
    });
  }, [goOnline]);

  // Leaving the screen ends the simulation so the next screen starts clean.
  useEffect(() => {
    goOnline();
  }, [pathname, goOnline]);

  return (
    <OfflineContext.Provider value={{ isOffline, goOffline, goOnline }}>
      {children}
      {isOffline && (
        <div
          aria-hidden="true"
          className="fixed inset-0 z-[1000] bg-black/50 animate-modal-overlay"
        />
      )}
    </OfflineContext.Provider>
  );
}

export function useOffline() {
  const ctx = useContext(OfflineContext);
  if (!ctx) throw new Error("useOffline must be used within an OfflineProvider");
  return ctx;
}
