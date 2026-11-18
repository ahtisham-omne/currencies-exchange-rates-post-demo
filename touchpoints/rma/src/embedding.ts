/* ── Running inside the Currency & Exchange Rates shell ──────────────
 * The shell (currencies-exchange-rates-post-demo) shows this app in an
 * iframe on the same origin, served under /touchpoint-apps/rma/ and mounted
 * at /supply-chain: the shell's /supply-chain/rma is this app's /rma, and
 * /supply-chain/rma/RMA-01007 its /rma/RMA-01007. The shell draws its own
 * sidebar.
 *
 * RMA is a TanStack Start app, and its vite.config.ts builds a server. The
 * shell serves every module as static files, so it runs and builds this one
 * as a single-page app instead (vite.touchpoint.config.ts, index.html,
 * src/touchpoint.tsx), and the rest of the source stays as the design repo
 * ships it. Everything the app needs to behave there lives in this file:
 *  - `embedded`: Layout hides the app's own sidebar.
 *  - The Supply Chain overview is the shell's page. Going to this app's
 *    "/supply-chain" (the "Supply Chain Management" crumb), or to "/", which
 *    redirects there, opens the shell's overview instead (`withShellPages`).
 *  - Root-relative URLs opened in a new tab ("/rma/RMA-01008") get the
 *    shell's page for them, so the new tab shows the whole shell. */

import type { RouterHistory } from "@tanstack/react-router";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

export const embedded = (() => {
  try {
    return window.self !== window.top && "__OMNE_SHELL__" in window.parent;
  } catch {
    return false;
  }
})();

interface ShellBridge {
  urlFor?: (url: string) => string | null;
  navigate?: (path: string) => void;
}

const shell = (): ShellBridge | undefined => {
  try {
    return (window.parent as unknown as { __OMNE_SHELL__?: ShellBridge }).__OMNE_SHELL__;
  } catch {
    return undefined;
  }
};

/** In-app pages the shell draws itself, and the shell page for each. */
const SHELL_PAGES: Record<string, string> = {
  "/": "/supply-chain",
  "/supply-chain": "/supply-chain",
};

/** The in-app path of a URL the router writes: no base path, search or hash. */
function inAppPath(url: string): string {
  const path = url.split(/[?#]/)[0] || "/";
  if (BASE && (path === BASE || path.startsWith(BASE + "/"))) return path.slice(BASE.length) || "/";
  return path;
}

/** The shell page an in-app URL stands for, when embedded and the shell draws it. */
function shellPageFor(url: string): string | null {
  if (!embedded) return null;
  return SHELL_PAGES[inAppPath(url).replace(/(.)\/$/, "$1")] ?? null;
}

/** The router's browser history, with going to a page the shell draws handed
 *  to the shell before this app's URL moves, so the shell never sees the app
 *  open its own copy of that page. */
export function withShellPages(history: RouterHistory): RouterHistory {
  if (!embedded) return history;
  const handOff =
    (go: RouterHistory["push"]): RouterHistory["push"] =>
    (path, state, navigateOpts) => {
      const page = shellPageFor(path);
      if (page) {
        shell()?.navigate?.(page);
        return;
      }
      go(path, state, navigateOpts);
    };
  history.push = handOff(history.push);
  history.replace = handOff(history.replace);
  return history;
}

/** An in-app path such as "/rma/RMA-01008" (not "//host" and not already based). */
function isAppPath(url: string): boolean {
  if (!url.startsWith("/") || url.startsWith("//")) return false;
  return !BASE || !(url === BASE || url.startsWith(BASE + "/"));
}

/** Where an in-app path lives for a new tab: the shell's page when embedded, else this app's. */
function appUrl(path: string): string {
  if (embedded) {
    const page = shellPageFor(path);
    if (page) return page;
    const url = shell()?.urlFor?.(BASE + path);
    if (url) return url;
  }
  return BASE + path;
}

if (BASE || embedded) {
  const open = window.open.bind(window);
  window.open = ((url?: string | URL, ...rest: [string?, string?]) =>
    open(typeof url === "string" && isAppPath(url) ? appUrl(url) : url, ...rest)) as typeof window.open;
}
