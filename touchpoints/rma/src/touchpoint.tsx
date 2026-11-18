/* The shell's entry for this app (see src/embedding.ts): the same routes,
 * rendered as a single-page app under the shell's base path. src/router.tsx
 * and the root route stay as TanStack Start uses them. */
import "./styles.css";
import { createRoot } from "react-dom/client";
import { QueryClient } from "@tanstack/react-query";
import { RouterProvider, createBrowserHistory, createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";
import { withShellPages } from "./embedding";

// The root route's shell component draws <html>, <head> and <body> for a
// server-rendered page. Here the page is index.html, so the routes render
// into #root, and the stylesheet the shell's <head> linked is imported above.
delete (routeTree.options as { shellComponent?: unknown }).shellComponent;

// As src/router.tsx creates it, plus the base path and the shell's pages.
const router = createRouter({
  routeTree,
  context: { queryClient: new QueryClient() },
  scrollRestoration: true,
  defaultPreloadStaleTime: 0,
  basepath: import.meta.env.BASE_URL,
  history: withShellPages(createBrowserHistory()),
});

createRoot(document.getElementById("root")!).render(<RouterProvider router={router} />);
