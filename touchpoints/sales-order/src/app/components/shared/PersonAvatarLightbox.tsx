import React, { createContext, useContext, useState, useCallback } from "react";
import { X } from "lucide-react";

/* ─── Context ─── */
interface LightboxData {
  src: string;
  name: string;
  subtitle?: string;
}

interface LightboxContextValue {
  /** Open the lightbox with a person's photo. Call from any avatar click handler. */
  openLightbox: (data: LightboxData) => void;
}

const LightboxContext = createContext<LightboxContextValue>({
  openLightbox: () => {},
});

/** Hook consumed by any component that renders a person avatar. */
export function usePersonLightbox() {
  return useContext(LightboxContext);
}

/* ─── Provider + Overlay ─── */
export function PersonAvatarLightboxProvider({ children }: { children: React.ReactNode }) {
  const [data, setData] = useState<LightboxData | null>(null);

  const openLightbox = useCallback((d: LightboxData) => setData(d), []);
  const close = useCallback(() => setData(null), []);

  return (
    <LightboxContext.Provider value={{ openLightbox }}>
      {children}

      {/* Overlay — rendered at the provider level, so it sits above all page content */}
      {data && (
        <div
          className="fixed inset-0 z-[500] flex items-center justify-center bg-black/80 backdrop-blur-sm"
          onClick={close}
        >
          {/* Close button */}
          <button
            type="button"
            onClick={close}
            className="absolute top-5 right-5 w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors cursor-pointer z-10"
          >
            <X className="w-5 h-5" />
          </button>
          {/* Image — 60vh tall */}
          <div className="flex flex-col items-center gap-4" onClick={(e) => e.stopPropagation()}>
            <img
              src={data.src}
              alt={data.name}
              className="rounded-2xl shadow-2xl object-cover border-4 border-white/10"
              style={{ height: "60vh", maxWidth: "90vw" }}
            />
            {/* Name caption */}
            <div className="px-5 py-2.5 rounded-xl bg-black/50 backdrop-blur-md text-white text-center">
              <p className="text-[15px]" style={{ fontWeight: 600 }}>{data.name}</p>
              {data.subtitle && <p className="text-[12px] text-white/70">{data.subtitle}</p>}
            </div>
          </div>
        </div>
      )}
    </LightboxContext.Provider>
  );
}
