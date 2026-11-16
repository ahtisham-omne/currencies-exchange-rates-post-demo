import { useEffect, useRef, useState } from "react";

/* A touchpoint's modal backdrop lives inside its iframe, so it dims the module
   but not the shell's sidebar beside it. This mirrors it: while the active
   frame shows a full-screen backdrop, the same colour, blur and opacity cover
   the sidebar, so a dialog reads the way it does on the shell's own pages
   (Currencies & Exchange Rates), where the backdrop spans the whole window.
   A click on the mirrored part goes to the frame's backdrop, so it dismisses
   whatever that backdrop would. */

interface Scrim {
  background: string;
  backdrop: string;
  opacity: number;
}

/** A computed colour's alpha: rgb()/rgba(), or the "/ a" form newer colour
 *  functions (oklab, color()) compute to. */
function alphaOf(color: string): number {
  if (!color || color === "transparent") return 0;
  const slash = color.match(/\/\s*([\d.]+)(%?)\s*\)$/);
  if (slash) return Number(slash[1]) / (slash[2] ? 100 : 1);
  const rgba = color.match(/^rgba\([^,]+,[^,]+,[^,]+,\s*([\d.]+)\s*\)$/);
  if (rgba) return Number(rgba[1]);
  return 1;
}

const rgbOf = (color: string): [number, number, number] | null => {
  const m = color.match(/^rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)/);
  return m ? [Number(m[1]), Number(m[2]), Number(m[3])] : null;
};

/** The shell's page background with the backdrops laid over it, bottom to top. */
function dimmedBackground(base: string, scrims: Scrim[]): string {
  let out = rgbOf(base) ?? [255, 255, 255];
  for (const s of scrims) {
    const c = rgbOf(s.background);
    if (!c) continue;
    const a = alphaOf(s.background) * s.opacity;
    out = out.map((v, i) => v * (1 - a) + c[i] * a) as [number, number, number];
  }
  return `rgb(${out.map((v) => Math.round(v)).join(", ")})`;
}

/** The frame's full-screen backdrops, bottom to top, and the topmost one.
 *
 *  A backdrop is a see-through layer over the whole frame, sitting in a fixed
 *  layer: either the fixed element itself ("fixed inset-0 bg-black/50") or a
 *  layer filling a fixed wrapper ("absolute inset-0" scrim in a "fixed inset-0"
 *  modal, as Chart of Accounts and some Vendor Invoicing dialogs draw it). An
 *  opaque full-screen view is a page, not a backdrop, and is left alone.
 *
 *  `tracked` holds the ones found last time: a backdrop that stops taking
 *  pointer events as it fades out drops out of the hit test, but should still
 *  fade on the sidebar until it is gone. */
function readScrims(win: Window, tracked: Set<Element>): { scrims: Scrim[]; top: Element | null; fading: boolean } {
  const doc = win.document;
  // The visible area, less any page scrollbar: a backdrop ends at the scrollbar.
  const w = Math.min(win.innerWidth, doc.documentElement.clientWidth || win.innerWidth);
  const h = Math.min(win.innerHeight, doc.documentElement.clientHeight || win.innerHeight);
  const scrims: Scrim[] = [];
  let top: Element | null = null;
  // A backdrop still invisible at the start of its fade-in: keep looking.
  let fading = false;
  // The frame's left edge is the one that meets the sidebar. Hit-test order is
  // top first; backdrops kept from last time go beneath.
  const hits = doc.elementsFromPoint(1, Math.round(h / 2));
  const kept = [...tracked].filter((el) => el.isConnected && !hits.includes(el));
  tracked.clear();
  for (const el of [...hits, ...kept]) {
    const style = win.getComputedStyle(el);
    const backdrop = style.backdropFilter || (style as unknown as { webkitBackdropFilter?: string }).webkitBackdropFilter || "none";
    const alpha = alphaOf(style.backgroundColor);
    const blurred = backdrop !== "none";
    if (alpha >= 1 || (alpha <= 0 && !blurred)) continue;
    const r = el.getBoundingClientRect();
    if (r.left > 0.5 || r.top > 0.5 || r.right < w - 0.5 || r.bottom < h - 0.5) continue;
    let opacity = 1;
    let fixed = false;
    let animating = false;
    for (let node: Element | null = el; node && node !== doc.documentElement; node = node.parentElement) {
      const s = win.getComputedStyle(node);
      opacity *= Number(s.opacity) || 0;
      if (s.position === "fixed") fixed = true;
      if (!animating && node.getAnimations?.().some((a) => a.playState !== "finished" && a.playState !== "idle")) animating = true;
    }
    if (!fixed) continue;
    if (opacity <= 0) {
      if (animating) fading = true;
      continue;
    }
    tracked.add(el);
    if (hits.includes(el)) top ??= el;
    scrims.unshift({ background: style.backgroundColor, backdrop, opacity });
  }
  return { scrims, top, fading };
}

/** Watches a document for backdrops and reports them on each change: on
 *  mutations, on animations and transitions, and every frame while one is open
 *  or fading in (a fade changes nothing a MutationObserver sees). */
function watchScrims(win: Window, onRead: (read: { scrims: Scrim[]; top: Element | null } | null) => void): () => void {
  let raf = 0;
  const tracked = new Set<Element>();
  const tick = () => {
    raf = 0;
    let open = false;
    try {
      const read = readScrims(win, tracked);
      onRead(read);
      open = read.scrims.length > 0 || read.fading;
    } catch {
      onRead(null);
    }
    if (open) raf = win.requestAnimationFrame(tick);
  };
  const schedule = () => {
    if (!raf) raf = win.requestAnimationFrame(tick);
  };
  const Observer = (win as unknown as { MutationObserver: typeof MutationObserver }).MutationObserver;
  const observer = new Observer(schedule);
  observer.observe(win.document.body, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ["class", "style", "data-state", "open"],
  });
  win.addEventListener("resize", schedule);
  const motion = ["animationstart", "animationend", "transitionrun", "transitionend"] as const;
  for (const type of motion) win.document.addEventListener(type, schedule, true);
  schedule();
  return () => {
    observer.disconnect();
    win.removeEventListener("resize", schedule);
    for (const type of motion) win.document.removeEventListener(type, schedule, true);
    if (raf) win.cancelAnimationFrame(raf);
  };
}

/* Whatever the browser paints outside the page takes the page's root
   background: the in-app browser pane's border, an overscroll at the window's
   edge. While a backdrop is open (the shell's own, or a module's mirrored over
   the sidebar), the root background takes the colour that backdrop makes over
   the page, so that edge dims with everything else instead of showing an
   undimmed strip. Inside the page the app covers the root, so it shows nowhere
   else. */
const tintSources: Record<"shell" | "frame", Scrim[]> = { shell: [], frame: [] };
/** What the tint replaces, kept from before the first backdrop opened. */
let untinted: { html: string; body: string; meta: HTMLMetaElement | null; metaContent: string | null; base: string } | null = null;
function setTint(source: "shell" | "frame", scrims: Scrim[]) {
  tintSources[source] = scrims;
  const all = [...tintSources.shell, ...tintSources.frame];
  const html = document.documentElement;
  const body = document.body;
  if (!all.length) {
    if (!untinted) return;
    html.style.backgroundColor = untinted.html;
    body.style.backgroundColor = untinted.body;
    if (untinted.metaContent === null) untinted.meta?.remove();
    else untinted.meta?.setAttribute("content", untinted.metaContent);
    untinted = null;
    return;
  }
  if (!untinted) {
    const existing = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
    untinted = {
      html: html.style.backgroundColor,
      body: body.style.backgroundColor,
      meta: existing,
      metaContent: existing?.getAttribute("content") ?? null,
      base: window.getComputedStyle(body).backgroundColor,
    };
    if (!existing) {
      untinted.meta = document.createElement("meta");
      untinted.meta.name = "theme-color";
      document.head.appendChild(untinted.meta);
    }
  }
  // The page's root and body backgrounds, and its theme colour: the surfaces a
  // browser or the in-app pane may paint around the page.
  const tint = dimmedBackground(untinted.base, all);
  html.style.backgroundColor = tint;
  body.style.backgroundColor = tint;
  untinted.meta?.setAttribute("content", tint);
}

/** The shell's own dialogs (Currencies & Exchange Rates and the other shell
 *  pages) already cover the sidebar; this only carries them to the window edge. */
export function ShellBackdropTint() {
  useEffect(() => {
    let last = "";
    const stop = watchScrims(window, (read) => {
      const scrims = read?.scrims ?? [];
      const key = JSON.stringify(scrims);
      if (key === last) return;
      last = key;
      setTint("shell", scrims);
    });
    return () => {
      stop();
      setTint("shell", []);
    };
  }, []);
  return null;
}

export function FrameScrims({ frame }: { frame: HTMLIFrameElement | null }) {
  const [state, setState] = useState<{ scrims: Scrim[]; width: number }>({ scrims: [], width: 0 });
  const topRef = useRef<Element | null>(null);
  // A frame that reloads (a dev server's full reload) gets a new document.
  const [loads, setLoads] = useState(0);
  useEffect(() => {
    if (!frame) return;
    const onLoad = () => setLoads((n) => n + 1);
    frame.addEventListener("load", onLoad);
    return () => frame.removeEventListener("load", onLoad);
  }, [frame]);

  useEffect(() => {
    setTint("frame", state.scrims);
  }, [state.scrims]);
  useEffect(() => () => setTint("frame", []), []);

  useEffect(() => {
    const win = frame?.contentWindow;
    if (!frame || !win?.document?.body) {
      setState({ scrims: [], width: 0 });
      return;
    }
    let last = "";
    const stop = watchScrims(win, (read) => {
      topRef.current = read?.top ?? null;
      const next = read
        ? { scrims: read.scrims, width: Math.max(0, Math.round(frame.getBoundingClientRect().left)) }
        : { scrims: [], width: 0 };
      const key = JSON.stringify(next);
      if (key === last) return;
      last = key;
      setState(next);
    });
    return () => {
      stop();
      topRef.current = null;
    };
  }, [frame, loads]);

  if (!state.scrims.length || !state.width) return null;

  // Hand the click to the frame's backdrop, the way a click there would land.
  const forward = (e: React.MouseEvent) => {
    const target = topRef.current;
    const win = frame?.contentWindow as (Window & typeof globalThis) | null | undefined;
    if (!target || !win) return;
    e.preventDefault();
    const init = { bubbles: true, cancelable: true, composed: true, clientX: 1, clientY: e.clientY, button: 0, view: win };
    target.dispatchEvent(new win.PointerEvent("pointerdown", { ...init, pointerType: "mouse", isPrimary: true }));
    target.dispatchEvent(new win.MouseEvent("mousedown", init));
    target.dispatchEvent(new win.PointerEvent("pointerup", { ...init, pointerType: "mouse", isPrimary: true }));
    target.dispatchEvent(new win.MouseEvent("mouseup", init));
    target.dispatchEvent(new win.MouseEvent("click", init));
  };

  return (
    <div
      aria-hidden
      onMouseDown={forward}
      className="fixed left-0 top-0 bottom-0 z-[1000]"
      style={{ width: state.width }}
    >
      {state.scrims.map((s, i) => (
        <div
          key={i}
          className="absolute inset-0"
          style={{ background: s.background, backdropFilter: s.backdrop, WebkitBackdropFilter: s.backdrop, opacity: s.opacity }}
        />
      ))}
    </div>
  );
}
