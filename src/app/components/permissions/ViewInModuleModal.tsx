import { useEffect, useState } from "react";
import { X, Check, ImageIcon, ZoomIn } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { ModalShell } from "../shared/ModalShell";
import { ComingSoonEmptyState } from "../shared/ComingSoonEmptyState";
import { cn } from "../ui/utils";
import type { PermissionModule } from "../../data/permissions-data";
import { VIEW_IN_MODULE_DATA } from "../../data/view-in-module-data";
import { isImageReady, prefetchImages } from "../../lib/image-prefetch";
import { SHOW_VIEW_IN_MODULE_CONTENT } from "../../lib/feature-flags";

interface ViewInModuleModalProps {
  open: boolean;
  onClose: () => void;
  permissionId: string;
  module: PermissionModule;
}

// Preview frame is authored at 1000×600 (5:3). Matching the upstream design.
const PREVIEW_W = 1000;
const PREVIEW_ASPECT = "1000 / 600";

export function ViewInModuleModal({
  open,
  onClose,
  permissionId,
  module,
}: ViewInModuleModalProps) {
  const [isOn, setIsOn] = useState(true);
  const [expanded, setExpanded] = useState(false);
  const permission = module.permissions.find((p) => p.id === permissionId);
  const data = VIEW_IN_MODULE_DATA[permissionId];

  // Reset toggle every time the modal opens.
  useEffect(() => {
    if (open) {
      setIsOn(true);
      setExpanded(false);
    }
  }, [open]);

  // Close the full-view overlay on Escape (without closing the whole modal).
  useEffect(() => {
    if (!expanded) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        setExpanded(false);
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [expanded]);

  const settingName = permission?.name ?? permissionId;
  const captionOn = data?.infoNoteOn ?? permission?.whatItGrants ?? "";
  const captionOff =
    data?.infoNoteOff ??
    permission?.whenToRestrict ??
    "This setting is currently disabled for the selected role.";
  const currentCaption = isOn ? captionOn : captionOff;
  const currentImage = isOn ? data?.imageOn : data?.imageOff;
  const currentHotspot = isOn ? data?.hotspotOn : data?.hotspotOff;

  /* Warm BOTH states on open. Normally the shots are already in the shared
     prefetch cache — PermissionDetailModal warms them the moment the
     permission is selected — so this is the fallback for any entry path that
     skipped that dwell time. */
  useEffect(() => {
    if (open && SHOW_VIEW_IN_MODULE_CONTENT) prefetchImages(data?.imageOn, data?.imageOff);
  }, [open, data?.imageOn, data?.imageOff]);

  /* Sources whose bytes have arrived, so the skeleton is only ever shown for
     genuinely cold loads. Prefetched images skip it via isImageReady, and a
     source keeps its entry after loading once, so re-opens never flash. */
  const [loadedSrcs, setLoadedSrcs] = useState<Set<string>>(() => new Set());
  const markLoaded = (src: string) =>
    setLoadedSrcs((prev) => (prev.has(src) ? prev : new Set(prev).add(src)));
  const currentReady =
    !!currentImage && (loadedSrcs.has(currentImage) || isImageReady(currentImage));

  return (
    <ModalShell open={open} onClose={onClose} z={110}>
      <div
        className="bg-white rounded-xl shadow-[0_24px_80px_rgba(0,0,0,0.25)] flex flex-col overflow-hidden"
        style={{
          width: "min(calc(100vw - 32px), 1044px)",
          maxHeight: "calc(100vh - 64px)",
        }}
      >
        {/* Header: Setting name + module chip + close button */}
        <div className="h-[56px] shrink-0 border-b border-gray-200 bg-white flex items-center justify-between px-6">
          <div className="flex items-center gap-2 min-w-0">
            <span
              className="text-gray-900 truncate"
              style={{ fontSize: "15px", fontWeight: 700 }}
            >
              {settingName}
            </span>
            <span
              className="inline-flex items-center rounded-md border border-[#C6D2FF] bg-[#F1F5FF] text-[#4339CA] px-2 py-0.5 shrink-0"
              style={{ fontSize: "12px", fontWeight: 600, lineHeight: "1.4" }}
            >
              {module.name}
            </span>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors cursor-pointer"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Preview content is stashed behind SHOW_VIEW_IN_MODULE_CONTENT (see
            lib/feature-flags.ts): while it is off the body renders the same
            coming-soon empty state as the Partners GL Accounts tab (chip,
            title, subtext), and everything below stays intact for the flag
            flip. */}
        {!SHOW_VIEW_IN_MODULE_CONTENT ? (
          <div
            className="min-h-0 overflow-y-auto bg-[#F8F9FB] flex items-center justify-center"
            /* Same footprint as the preview body it replaces: toggle + caption
               + the 1000x600 frame + p-5 come to ~738px, capped by the modal's
               own viewport allowance (64 margin + 56 header + 56 footer). */
            style={{ height: "clamp(320px, calc(100vh - 176px), 738px)" }}
          >
            <ComingSoonEmptyState
              icon={ImageIcon}
              title="View in Module"
              description="In-module previews for this permission are currently being designed. Once they're made, this view will show annotated screenshots of the module with the permission turned on and off, so you can see exactly what it grants before assigning it."
            />
          </div>
        ) : (
        <>
        {/* Body: toggle + caption + preview. Scrolls rather than clips: with the
            caption above the frame nothing below it can absorb the overflow. */}
        <div className="min-h-0 overflow-y-auto bg-[#F8F9FB] flex flex-col p-5 gap-3">
          {/* Permission On / Off toggle */}
          <div
            className="shrink-0 flex items-center gap-1 bg-[#E8EDF4] rounded-lg p-[3px]"
            style={{ width: 280 }}
          >
            <button
              onClick={() => setIsOn(true)}
              className={cn(
                "flex-1 px-3 py-1.5 rounded-md transition-all duration-150 flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap",
                isOn
                  ? "bg-white border border-[#059669] shadow-[0_1px_4px_rgba(5,150,105,0.15)] text-[#059669]"
                  : "border border-transparent text-gray-500 hover:text-gray-700"
              )}
              style={{ fontSize: "12.5px", fontWeight: isOn ? 600 : 500 }}
            >
              <Check className="w-3.5 h-3.5" />
              Permission On
            </button>
            <button
              onClick={() => setIsOn(false)}
              className={cn(
                "flex-1 px-3 py-1.5 rounded-md transition-all duration-150 flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap",
                !isOn
                  ? "bg-white border border-[#DC2626] shadow-[0_1px_4px_rgba(220,38,38,0.15)] text-[#DC2626]"
                  : "border border-transparent text-gray-500 hover:text-gray-700"
              )}
              style={{ fontSize: "12.5px", fontWeight: !isOn ? 600 : 500 }}
            >
              <X className="w-3.5 h-3.5" />
              Permission Off
            </button>
          </div>

          {/* Caption banner: sits above the preview so the explanation is read
              before the screenshot it describes. */}
          {currentCaption && (
            <div className="shrink-0">
              <div className="flex items-start gap-2 px-3 py-2 bg-white border border-gray-200 rounded-lg">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="w-4 h-4 text-gray-400 shrink-0 mt-0.5"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <circle cx="12" cy="12" r="10" />
                  <path d="M12 16v-4M12 8h.01" />
                </svg>
                <p
                  className="text-gray-500 flex-1"
                  style={{ fontSize: "13px", fontWeight: 400, lineHeight: "1.5" }}
                >
                  {currentCaption}
                </p>
              </div>
            </div>
          )}

          {/* Preview frame: fixed 5:3 aspect; shows empty image placeholder */}
          <div className="shrink-0 w-full flex justify-center">
            <div
              className="rounded-xl border border-gray-200 bg-white shadow-[0_1px_4px_rgba(0,0,0,0.04)] overflow-hidden relative"
              style={{
                width: "100%",
                maxWidth: PREVIEW_W,
                aspectRatio: PREVIEW_ASPECT,
              }}
            >
              <AnimatePresence mode="wait">
                <motion.div
                  key={isOn ? "on" : "off"}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="absolute inset-0"
                  style={{ backgroundColor: "#F8F9FB" }}
                >
                  {currentImage ? (
                    <button
                      type="button"
                      onClick={() => setExpanded(true)}
                      className="group absolute inset-0 w-full h-full cursor-zoom-in block"
                      aria-label="Expand preview to full view"
                    >
                      {/* Cold-load skeleton: a quiet pulse in place of a blank
                          frame. Prefetched (warm) opens never show it. */}
                      {!currentReady && (
                        <span className="absolute inset-0 animate-pulse bg-[#EDF1F6]" aria-hidden />
                      )}
                      <img
                        src={currentImage}
                        alt={`${settingName}: permission ${isOn ? "on" : "off"}`}
                        className={`w-full h-full object-cover object-top transition-opacity duration-200 ${
                          currentReady ? "opacity-100" : "opacity-0"
                        }`}
                        draggable={false}
                        width={2000}
                        height={1200}
                        decoding="async"
                        fetchPriority="high"
                        onLoad={() => markLoaded(currentImage)}
                      />
                      {/* Ring waits for the shot: pulsing over the skeleton
                          would highlight nothing. */}
                      {currentHotspot && currentReady && (
                        <span
                          className={cn("vim-hotspot", !isOn && "vim-hotspot--off")}
                          style={{
                            left: `${currentHotspot.left}%`,
                            top: `${currentHotspot.top}%`,
                            width: `${currentHotspot.width}%`,
                            height: `${currentHotspot.height}%`,
                          }}
                          aria-hidden
                        />
                      )}
                      {/* Hover chip: bottom-right, prompts full-view */}
                      <span className="absolute bottom-2.5 right-2.5 flex items-center gap-1.5 rounded-md bg-slate-100 border border-slate-200 text-slate-600 px-2.5 py-1.5 shadow-sm opacity-0 translate-y-1 transition-all duration-150 group-hover:opacity-100 group-hover:translate-y-0 pointer-events-none">
                        <ZoomIn className="w-3.5 h-3.5" />
                        <span style={{ fontSize: "12px", fontWeight: 600 }}>
                          Click to expand in full
                        </span>
                      </span>
                    </button>
                  ) : (
                    <div className="absolute inset-0 flex flex-col items-center justify-center gap-2.5">
                      <div
                        className="w-14 h-14 rounded-2xl flex items-center justify-center"
                        style={{ backgroundColor: "#E8EDF4", color: "#94A3B8" }}
                      >
                        <ImageIcon className="w-7 h-7" strokeWidth={1.5} />
                      </div>
                      <p
                        className="text-gray-400"
                        style={{ fontSize: "13px", fontWeight: 500 }}
                      >
                        Image coming soon...
                      </p>
                    </div>
                  )}
                </motion.div>
              </AnimatePresence>
            </div>
          </div>
        </div>
        </>
        )}

        {/* Footer */}
        <div className="h-[56px] shrink-0 border-t border-gray-200 bg-white flex items-center justify-end px-6">
          <button
            onClick={onClose}
            className="px-5 py-2 bg-[#0E69E2] text-white rounded-lg hover:bg-[#0A4FB0] transition-colors shadow-sm cursor-pointer"
            style={{ fontSize: "14px", fontWeight: 500 }}
          >
            Got It
          </button>
        </div>
      </div>

      {/* Full-view overlay: click image to expand */}
      <AnimatePresence>
        {expanded && currentImage && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="fixed inset-0 z-[200] flex items-center justify-center bg-black/80 backdrop-blur-sm p-6 cursor-zoom-out"
            onClick={() => setExpanded(false)}
          >
            <button
              onClick={(e) => {
                e.stopPropagation();
                setExpanded(false);
              }}
              className="absolute top-4 right-4 p-2 text-white/80 hover:text-white hover:bg-white/10 rounded-lg transition-colors cursor-pointer"
              aria-label="Close full view"
            >
              <X className="w-6 h-6" />
            </button>
            <motion.div
              initial={{ scale: 0.96 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.96 }}
              transition={{ duration: 0.15 }}
              className="relative w-full max-w-[1400px] rounded-lg overflow-hidden shadow-2xl cursor-default"
              style={{ aspectRatio: PREVIEW_ASPECT }}
              onClick={(e) => e.stopPropagation()}
            >
              <img
                src={currentImage}
                alt={`${settingName}: permission ${isOn ? "on" : "off"} (full view)`}
                className="w-full h-full object-cover object-top"
                draggable={false}
                width={2000}
                height={1200}
                decoding="async"
              />
              {currentHotspot && (
                <span
                  className={cn("vim-hotspot", !isOn && "vim-hotspot--off")}
                  style={{
                    left: `${currentHotspot.left}%`,
                    top: `${currentHotspot.top}%`,
                    width: `${currentHotspot.width}%`,
                    height: `${currentHotspot.height}%`,
                  }}
                  aria-hidden
                />
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </ModalShell>
  );
}
