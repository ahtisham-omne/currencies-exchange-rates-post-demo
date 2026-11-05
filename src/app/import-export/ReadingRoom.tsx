/* The in-modal "How This Works" drawer (port of role-zen's ui/reading-room.tsx)
 * plus a parser that turns the shipped OMNE_Items_Import_Guide.txt into the
 * drawer's sections, so the drawer always shows the very guide the CSV ships
 * with. The provider renders position: absolute inside the modal panel, so
 * the panel must be `relative overflow-hidden`. */
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X } from "lucide-react";

export interface ReadingRoomSection {
  title: string;
  body: ReactNode;
}

interface ReadingRoomPayload {
  title: string;
  sections: ReadingRoomSection[];
}

interface ReadingRoomContextValue {
  open: (payload: ReadingRoomPayload) => void;
  close: () => void;
  isOpen: boolean;
}

const ReadingRoomContext = createContext<ReadingRoomContextValue | null>(null);

export function useReadingRoom(): ReadingRoomContextValue | null {
  return useContext(ReadingRoomContext);
}

const EASE = [0.16, 1, 0.3, 1] as const;
const DRAWER_SHADOW =
  "0 0 0 1px rgba(207,218,234,0.6), 0 1px 2px rgba(15,23,42,0.04), 0 2px 4px rgba(15,23,42,0.04), 0 4px 8px rgba(15,23,42,0.04), 0 8px 16px rgba(15,23,42,0.04), 0 16px 32px rgba(15,23,42,0.05), 0 24px 48px -12px rgba(15,23,42,0.12), inset 0 1px 0 rgba(255,255,255,0.9), inset 0 0 0 1px rgba(255,255,255,0.35)";

export function ReadingRoomProvider({ children, modalBorderRadius = 16 }: { children: ReactNode; modalBorderRadius?: number }) {
  const [payload, setPayload] = useState<ReadingRoomPayload | null>(null);
  const open = useCallback((p: ReadingRoomPayload) => setPayload(p), []);
  const close = useCallback(() => setPayload(null), []);
  const value = useMemo(() => ({ open, close, isOpen: !!payload }), [open, close, payload]);

  // Escape closes the drawer first and stops the wizard from also closing.
  useEffect(() => {
    if (!payload) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        e.preventDefault();
        close();
      }
    };
    document.addEventListener("keydown", onKey, true);
    return () => document.removeEventListener("keydown", onKey, true);
  }, [payload, close]);

  return (
    <ReadingRoomContext.Provider value={value}>
      {children}
      <AnimatePresence>
        {payload && (
          <>
            <motion.div
              key="rr-scrim"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.4, ease: EASE }}
              onClick={close}
              style={{
                position: "absolute",
                inset: 0,
                background: "rgba(255,255,255,0.55)",
                backdropFilter: "blur(2px)",
                borderRadius: modalBorderRadius,
                zIndex: 40,
              }}
            />
            <motion.aside
              key="rr-drawer"
              role="dialog"
              aria-label={payload.title}
              initial={{ x: "calc(100% + 24px)" }}
              animate={{ x: 0 }}
              exit={{ x: "calc(100% + 24px)" }}
              transition={{ duration: 0.45, ease: EASE }}
              className="flex flex-col"
              style={{
                position: "absolute",
                top: 6,
                right: 6,
                bottom: 6,
                width: "min(500px, calc(100% - 12px))",
                zIndex: 50,
                background: "linear-gradient(178deg, #FBFCFF 0%, #F1F5FB 38%, #E7EDF6 100%)",
                border: "1px solid #CFDAEA",
                borderRadius: modalBorderRadius,
                boxShadow: DRAWER_SHADOW,
                overflow: "hidden",
              }}
            >
              <div className="shrink-0 flex items-start justify-between gap-3" style={{ padding: "20px 24px 16px", borderBottom: "1px solid rgba(10,119,255,0.10)" }}>
                <div className="min-w-0">
                  <div style={{ fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em", color: "#0A77FF" }}>How This Works</div>
                  <h3 className="truncate" style={{ fontSize: 20, fontWeight: 600, color: "rgb(15,23,42)", letterSpacing: "-0.01em", marginTop: 2 }}>
                    {payload.title}
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={close}
                  className="shrink-0 flex items-center justify-center hover:bg-slate-100 transition-colors cursor-pointer"
                  style={{ width: 30, height: 30, borderRadius: 8, color: "rgb(100,116,139)" }}
                  aria-label="Close Reading Room"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="flex-1 min-h-0 overflow-y-auto" style={{ padding: 24, scrollbarWidth: "thin", scrollbarColor: "#CBD5E1 transparent" }}>
                {payload.sections.map((s, i) => (
                  <section
                    key={`${s.title}-${i}`}
                    style={{
                      background: "rgba(255,255,255,0.45)",
                      border: "1px solid rgba(255,255,255,0.45)",
                      borderRadius: 12,
                      padding: "16px 18px",
                      marginBottom: i === payload.sections.length - 1 ? 0 : 12,
                      boxShadow: "inset 0 1px 0 rgba(255,255,255,0.75), 0 1px 2px rgba(15,23,42,0.025), 0 2px 6px rgba(15,23,42,0.025)",
                    }}
                  >
                    <h4 style={{ fontSize: 13, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", color: "rgb(100,116,139)", marginBottom: 10 }}>
                      {s.title}
                    </h4>
                    <div style={{ fontSize: 13.5, color: "rgb(51,65,85)", lineHeight: 1.65 }}>{s.body}</div>
                  </section>
                ))}
              </div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </ReadingRoomContext.Provider>
  );
}

/* ─── Guide blocks (port of importGuideContent.tsx GuideBlocks) ─── */

export type GuideBlock =
  | { kind: "subheader"; text: string }
  | { kind: "labeled"; label: string; body: string }
  | { kind: "paragraph"; text: string };

export function GuideBlocks({ blocks }: { blocks: GuideBlock[] }) {
  return (
    <>
      {blocks.map((b, i) => {
        const prev = blocks[i - 1];
        const marginTop = i === 0 ? 0 : b.kind === "subheader" ? 18 : b.kind === "labeled" && prev?.kind === "labeled" ? 6 : 10;
        if (b.kind === "subheader") {
          return (
            <h4 key={i} style={{ margin: `${marginTop}px 0 8px 0`, fontSize: 13.5, fontWeight: 600, color: "rgb(15, 23, 42)" }}>
              {b.text}
            </h4>
          );
        }
        if (b.kind === "labeled") {
          return (
            <p key={i} style={{ margin: `${marginTop}px 0 0 0` }}>
              <strong style={{ fontWeight: 600, color: "rgb(15, 23, 42)" }}>{b.label}:</strong> {b.body}
            </p>
          );
        }
        return (
          <p key={i} style={{ margin: `${marginTop}px 0 0 0` }}>
            {b.text}
          </p>
        );
      })}
    </>
  );
}

/* ─── Parser for the shipped Guide txt ───
 * Layout produced by templateLayout.mjs buildGuideText: a "=" banner, then
 * sections framed as "-----" / HEADING / "-----", sub-headers as a line
 * followed by a shorter dash rule, "Label  body" lines with indented
 * continuations, and plain wrapped paragraphs. */

const isRule = (line: string, min = 3) => /^-{3,}\s*$/.test(line) && line.trim().length >= min;
const isBanner = (line: string) => /^={5,}\s*$/.test(line);
const SECTION_RULE = 60;

/** Guide section titles in sentence case ("How to fill in this file"), as every import guide shows them. */
function titleCase(s: string): string {
  const lower = s.toLowerCase();
  return lower.charAt(0).toUpperCase() + lower.slice(1);
}

function parseBody(lines: string[]): GuideBlock[] {
  const blocks: GuideBlock[] = [];
  let para: string[] = [];
  const flushPara = () => {
    if (para.length) {
      blocks.push({ kind: "paragraph", text: para.join(" ").replace(/\s+/g, " ").trim() });
      para = [];
    }
  };
  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i];
    const line = raw.replace(/\s+$/, "");
    if (!line.trim()) {
      flushPara();
      continue;
    }
    // Sub-header: a line followed by a dash rule shorter than a section rule.
    const next = lines[i + 1] ?? "";
    if (!/^\s/.test(line) && isRule(next) && next.trim().length < SECTION_RULE) {
      flushPara();
      blocks.push({ kind: "subheader", text: line.trim() });
      i++;
      continue;
    }
    // Labeled: "Label   body" (2+ spaces), possibly indented; continuation lines are indented deeper.
    const m = line.match(/^(\s*)(\S[^\s].*?|\S)\s{2,}(\S.*)$/);
    if (m && !/^\s{4,}/.test(line)) {
      flushPara();
      const label = m[2].trim();
      let body = m[3].trim();
      const indent = line.length - line.replace(/^\s+/, "").length + label.length;
      while (i + 1 < lines.length) {
        const cont = lines[i + 1];
        if (!cont.trim()) break;
        const contIndent = cont.length - cont.replace(/^\s+/, "").length;
        if (contIndent <= indent) break;
        body += " " + cont.trim();
        i++;
      }
      blocks.push({ kind: "labeled", label, body });
      continue;
    }
    if (/^\s+/.test(line) && blocks.length && blocks[blocks.length - 1].kind === "labeled" && !para.length) {
      const last = blocks[blocks.length - 1] as { kind: "labeled"; label: string; body: string };
      last.body += " " + line.trim();
      continue;
    }
    para.push(line.trim());
  }
  flushPara();
  return blocks;
}

/** The guide as structured sections (Overview, then every guide section),
 *  for the How This Works panel. */
export function guideSectionBlocks(text: string): { title: string; blocks: GuideBlock[] }[] {
  return parseGuideText(text, true) as unknown as { title: string; blocks: GuideBlock[] }[];
}

export function parseGuideText(text: string, asBlocks = false): ReadingRoomSection[] {
  const lines = text.replace(/\r\n?/g, "\n").split("\n");
  const sections: { title: string; lines: string[] }[] = [];
  const intro: string[] = [];
  let current: { title: string; lines: string[] } | null = null;
  let i = 0;
  // Skip the "=" banner block.
  if (isBanner(lines[0] ?? "")) {
    i = 1;
    while (i < lines.length && !isBanner(lines[i])) i++;
    i++;
  }
  for (; i < lines.length; i++) {
    const line = lines[i];
    if (isRule(line, SECTION_RULE) && lines[i + 1] && isRule(lines[i + 2] ?? "", SECTION_RULE)) {
      current = { title: titleCase(lines[i + 1].trim()), lines: [] };
      sections.push(current);
      i += 2;
      continue;
    }
    if (current) current.lines.push(line);
    else intro.push(line);
  }
  const raw: { title: string; blocks: GuideBlock[] }[] = [];
  const introBlocks = parseBody(intro);
  if (introBlocks.length) raw.push({ title: "Overview", blocks: introBlocks });
  for (const s of sections) {
    const blocks = parseBody(s.lines);
    if (blocks.length) raw.push({ title: s.title, blocks });
  }
  if (asBlocks) return raw as unknown as ReadingRoomSection[];
  return raw.map((s) => ({ title: s.title, body: <GuideBlocks blocks={s.blocks} /> }));
}

/** Fetch + parse the shipped guide; falls back to the given text builder when the fetch fails. */
export async function loadGuideSections(url: string, fallbackText?: () => string): Promise<ReadingRoomSection[]> {
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const text = await res.text();
    const parsed = parseGuideText(text);
    if (parsed.length) return parsed;
  } catch {
    /* fall through */
  }
  if (fallbackText) return parseGuideText(fallbackText());
  return [];
}
