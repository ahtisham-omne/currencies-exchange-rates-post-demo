import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  frameBase,
  matchTouchpoint,
  toShellPath,
  touchpoints,
  type Touchpoint,
  type TouchpointMatch,
} from "../../touchpoints";

/* Touchpoint apps check for this flag to hide their own sidebar. */
(window as unknown as { __OMNE_SHELL__: boolean }).__OMNE_SHELL__ = true;

const appLocation = (touchpoint: Touchpoint, win: Window) => ({
  path: win.location.pathname.slice(frameBase(touchpoint).length) || "/",
  search: win.location.search,
});

/**
 * Renders each visited touchpoint in an iframe and keeps it alive (laid out but
 * invisible) after you leave, so switching modules is instant. The shell URL and
 * the frame URL are kept in sync in both directions.
 */
export function TouchpointFrames({ match }: { match: TouchpointMatch | null }) {
  const location = useLocation();
  const navigate = useNavigate();
  const [opened, setOpened] = useState<Record<string, string>>({});
  const [loaded, setLoaded] = useState<Record<string, boolean>>({});
  const frames = useRef<Record<string, HTMLIFrameElement | null>>({});

  const activeSlug = match?.touchpoint.slug;
  const target = match ? match.appPath + location.search : null;

  // The frames' history hooks outlive renders, so they read these through a ref.
  const latest = useRef({ activeSlug, shellUrl: "", navigate });
  latest.current = { activeSlug, shellUrl: location.pathname + location.search, navigate };

  // Open a frame the first time its touchpoint is visited.
  if (activeSlug && target && !(activeSlug in opened)) {
    setOpened({ ...opened, [activeSlug]: target });
  }

  // Shell → frame: sidebar clicks and back/forward move an already-open frame.
  useEffect(() => {
    if (!match || !target || !loaded[match.touchpoint.slug]) return;
    const win = frames.current[match.touchpoint.slug]?.contentWindow;
    if (!win) return;
    const current = appLocation(match.touchpoint, win);
    if (current.path + current.search === target) return;
    win.history.replaceState(win.history.state, "", frameBase(match.touchpoint) + target);
    win.dispatchEvent(new PopStateEvent("popstate", { state: win.history.state }));
  }, [match, target, loaded]);

  // Frame → shell: mirror the frame's in-app navigation into the shell URL.
  const report = (touchpoint: Touchpoint, win: Window) => {
    const { activeSlug, shellUrl, navigate } = latest.current;
    if (activeSlug !== touchpoint.slug) return;
    const { path, search } = appLocation(touchpoint, win);
    const shellPath = toShellPath(touchpoint, path);
    // Skip transient paths no touchpoint owns (e.g. "/" right before an in-app redirect).
    if (shellPath + search !== shellUrl && matchTouchpoint(shellPath)) {
      navigate(shellPath + search, { replace: true });
    }
  };

  const handleLoad = (touchpoint: Touchpoint) => {
    const win = frames.current[touchpoint.slug]?.contentWindow;
    if (!win) return;
    for (const method of ["pushState", "replaceState"] as const) {
      const original = win.history[method];
      win.history[method] = (...args: Parameters<History["pushState"]>) => {
        original.apply(win.history, args);
        report(touchpoint, win);
      };
    }
    win.addEventListener("popstate", () => report(touchpoint, win));
    report(touchpoint, win);
    setLoaded((prev) => ({ ...prev, [touchpoint.slug]: true }));
  };

  return (
    <>
      {activeSlug && !loaded[activeSlug] && (
        <div className="absolute inset-0 flex items-center justify-center">Loading…</div>
      )}
      {touchpoints
        .filter((touchpoint) => touchpoint.slug in opened)
        .map((touchpoint) => (
          <iframe
            key={touchpoint.slug}
            ref={(el) => (frames.current[touchpoint.slug] = el)}
            src={frameBase(touchpoint) + opened[touchpoint.slug]}
            title={touchpoint.label}
            onLoad={() => handleLoad(touchpoint)}
            className="absolute inset-0 h-full w-full border-0"
            style={{ visibility: touchpoint.slug === activeSlug && loaded[touchpoint.slug] ? "visible" : "hidden" }}
          />
        ))}
    </>
  );
}
