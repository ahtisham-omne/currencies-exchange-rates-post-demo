/* Reading Room, carried over from User Access Control's `ui/reading-room`
 * so the importer's "How this works" guide is that module's drawer rather
 * than a new one. Unmodified apart from the shared-util import path. */
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "motion/react";
import { X, Info } from "lucide-react";
import { cn } from "@/app/components/ui/utils";

// ─── Types ─────────────────────────────────────────────────────────────────

export interface ReadingRoomSection {
  /** Optional outline icon. Defaults to a generic info icon. */
  icon?: ReactNode;
  /** Section title (rendered uppercase). */
  title?: ReactNode;
  /** Section body content. */
  body?: ReactNode;
}

export interface ReadingRoomConfig {
  /** Drawer title (Fraunces serif). */
  title?: ReactNode;
  /** Ordered list of sections rendered in the drawer body. */
  sections?: ReadingRoomSection[];
}

interface ReadingRoomContextValue {
  open: (config: ReadingRoomConfig) => void;
  close: () => void;
  isOpen: boolean;
}

const ReadingRoomContext = createContext<ReadingRoomContextValue | null>(null);

export function useReadingRoom() {
  return useContext(ReadingRoomContext);
}

// ─── Trigger Button ────────────────────────────────────────────────────────

const triggerGradient =
  "linear-gradient(178deg, #FBFCFF 0%, #F1F5FB 38%, #E7EDF6 100%)";

const triggerShadow = [
  "inset 0 1px 0 rgba(255, 255, 255, 0.95)",
  "inset 0 2px 6px -2px rgba(255, 255, 255, 0.85)",
  "inset 1px 0 0 rgba(255, 255, 255, 0.6)",
  "inset -1px 0 0 rgba(10, 119, 255, 0.04)",
  "inset 0 -1px 0 rgba(10, 119, 255, 0.06)",
  "0 1px 3px rgba(10, 119, 255, 0.10)",
].join(", ");

const triggerShadowPressed = [
  "inset 0 1px 0 rgba(255, 255, 255, 0.4)",
  "inset 0 2px 6px -2px rgba(255, 255, 255, 0.3)",
  "inset 1px 0 0 rgba(255, 255, 255, 0.6)",
  "inset -1px 0 0 rgba(10, 119, 255, 0.04)",
  "inset 0 -1px 0 rgba(10, 119, 255, 0.06)",
  "0 1px 2px rgba(10, 119, 255, 0.10)",
].join(", ");

export function ReadingRoomButton({ config }: { config?: ReadingRoomConfig }) {
  const ctx = useReadingRoom();
  const [hover, setHover] = useState(false);
  const [pressed, setPressed] = useState(false);

  if (!ctx) return null;
  if (!config || (!config.title && !(config.sections && config.sections.length))) return null;

  return (
    <button
      type="button"
      onClick={() => ctx.open(config ?? {})}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => {
        setHover(false);
        setPressed(false);
      }}
      onMouseDown={() => setPressed(true)}
      onMouseUp={() => setPressed(false)}
      className="inline-flex items-center cursor-pointer outline-none"
      style={{
        gap: 8,
        padding: "8px 14px",
        borderRadius: 8,
        border: "1px solid #CFDAEA",
        background: hover ? "#EEF4FC" : "#F6FAFE",
        boxShadow: pressed ? triggerShadowPressed : triggerShadow,
        transform: pressed ? "translateY(1px)" : "translateY(0)",
        transition: "background 150ms ease, box-shadow 150ms ease, transform 100ms ease",
      }}
    >
      <Info
        style={{ width: 14, height: 14, color: "#0A77FF" }}
      />
      <span
        style={{
          fontSize: 13,
          fontWeight: 500,
          color: "#0A77FF",
          lineHeight: 1,
        }}
      >
        How This Works
      </span>
    </button>
  );
}

// ─── Drawer + Provider ─────────────────────────────────────────────────────

const drawerGradient = triggerGradient;

const drawerShadow = [
  "inset 0 1px 0 rgba(255, 255, 255, 0.95)",
  "inset 0 2px 6px -2px rgba(255, 255, 255, 0.85)",
  "inset 1px 0 0 rgba(255, 255, 255, 0.6)",
  "inset -1px 0 0 rgba(10, 119, 255, 0.04)",
  "inset 0 -1px 0 rgba(10, 119, 255, 0.06)",
  "inset 0 -24px 36px -20px rgba(10, 119, 255, 0.06)",
  "0 24px 50px rgba(15, 23, 42, 0.18)",
  "0 12px 28px rgba(10, 119, 255, 0.07)",
  "0 2px 4px rgba(15, 23, 42, 0.08)",
].join(", ");

interface ReadingRoomProviderProps {
  /** Modal corner radius so the scrim matches it. Default 12px. */
  modalBorderRadius?: number;
  children: ReactNode;
}

/**
 * Wraps a modal's content. Renders the slide-in drawer + scrim absolutely
 * inside its own bounds, so place it inside a `position: relative` container
 * that matches the modal root. Children panels can call useReadingRoom().open(config).
 */
export function ReadingRoomProvider({
  modalBorderRadius = 12,
  children,
}: ReadingRoomProviderProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [config, setConfig] = useState<ReadingRoomConfig>({});

  const open = useCallback((c: ReadingRoomConfig) => {
    setConfig(c);
    setIsOpen(true);
  }, []);
  const close = useCallback(() => setIsOpen(false), []);

  // Esc to close (only when open)
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        close();
      }
    };
    document.addEventListener("keydown", onKey, true);
    return () => document.removeEventListener("keydown", onKey, true);
  }, [isOpen, close]);

  return (
    <ReadingRoomContext.Provider value={{ open, close, isOpen }}>
      {children}

      {createPortal(
        <>
      <AnimatePresence>
        {isOpen && (
          <motion.div
            key="rr-scrim"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
            onClick={close}
            style={{
              position: "fixed",
              inset: 0,
              background: "rgba(255, 255, 255, 0.55)",
              backdropFilter: "blur(2px)",
              WebkitBackdropFilter: "blur(2px)",
              borderRadius: modalBorderRadius,
              zIndex: 12600,
            }}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            key="rr-drawer"
            initial={{ x: "calc(100% + 24px)" }}
            animate={{ x: 0 }}
            exit={{ x: "calc(100% + 24px)" }}
            transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
            style={{
              position: "fixed",
              top: 6,
              right: 6,
              bottom: 6,
              /* Wider than UAC's 500: this guide carries longer prose about
                 non-linear rows and dependency matching. */
              width: "min(620px, calc(100vw - 24px))",
              zIndex: 12601,
              background: drawerGradient,
              border: "1px solid #CFDAEA",
              borderRadius: 16,
              boxShadow: drawerShadow,
              display: "flex",
              flexDirection: "column",
              overflow: "hidden",
            }}
          >
            <ReadingRoomDrawerContent config={config} onClose={close} />
          </motion.div>
        )}
      </AnimatePresence>
        </>,
        document.body,
      )}
    </ReadingRoomContext.Provider>
  );
}

function ReadingRoomDrawerContent({
  config,
  onClose,
}: {
  config: ReadingRoomConfig;
  onClose: () => void;
}) {
  const sections =
    config.sections && config.sections.length > 0
      ? config.sections
      : ([
          { title: "[Section Title]", body: "[Section body copy goes here]" },
          { title: "[Section Title]", body: "[Section body copy goes here]" },
        ] as ReadingRoomSection[]);

  return (
    <>
      {/* Header */}
      <div
        style={{
          padding: "20px 24px 16px",
          borderBottom: "1px solid rgba(10, 119, 255, 0.10)",
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          gap: 12,
          flexShrink: 0,
        }}
      >
        <div style={{ minWidth: 0, flex: 1 }}>
          <div
            style={{
              fontSize: 11,
              fontWeight: 600,
              textTransform: "uppercase",
              letterSpacing: "0.08em",
              color: "#0A77FF",
              marginBottom: 4,
            }}
          >
            How This Works
          </div>
          <h2
            style={{
              fontFamily: "'Inter', system-ui, sans-serif",
              fontSize: 20,
              fontWeight: 600,
              color: "rgb(15, 23, 42)",
              lineHeight: 1.2,
              letterSpacing: "-0.01em",
              margin: 0,
            }}
          >
            {config.title ?? "[Drawer title]"}
          </h2>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="hover:bg-slate-100 transition-colors"
          style={{
            width: 30,
            height: 30,
            borderRadius: 8,
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            color: "rgb(100, 116, 139)",
            flexShrink: 0,
          }}
          aria-label="Close Reading Room"
        >
          <X style={{ width: 16, height: 16 }} />
        </button>
      </div>

      {/* Body */}
      <div style={{ padding: 24, overflowY: "auto", flex: 1 }}>
        {sections.map((section, idx) => {
          const isLast = idx === sections.length - 1;
          return (
            <div
              key={idx}
              style={{
                background: "rgba(255, 255, 255, 0.45)",
                border: "1px solid rgba(255, 255, 255, 0.45)",
                borderRadius: 12,
                padding: "16px 18px",
                marginBottom: isLast ? 0 : 12,
                boxShadow:
                  "inset 0 1px 0 rgba(255, 255, 255, 0.75), 0 1px 2px rgba(15, 23, 42, 0.025), 0 2px 6px rgba(15, 23, 42, 0.025)",
              }}
            >
              <ReadingRoomSectionView section={section} />
            </div>
          );
        })}
      </div>
    </>
  );
}

function ReadingRoomSectionView({ section }: { section: ReadingRoomSection }) {
  return (
    <div>
      <div style={{ marginBottom: 10 }}>
        <span
          style={{
            fontSize: 13,
            fontWeight: 600,
            textTransform: "uppercase",
            letterSpacing: "0.06em",
            color: "rgb(100, 116, 139)",
          }}
        >
          {section.title ?? "[Section title]"}
        </span>
      </div>
      <div
        className={cn("rr-body")}
        style={{
          fontSize: 13.5,
          color: "rgb(51, 65, 85)",
          lineHeight: 1.65,
        }}
      >
        {typeof section.body === "string" || section.body == null ? (
          <p style={{ margin: 0 }}>{section.body ?? "[Section body copy goes here]"}</p>
        ) : (
          section.body
        )}
      </div>
    </div>
  );
}
