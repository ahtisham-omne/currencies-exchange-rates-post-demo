import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

/* A touchpoint frame that followed a plain link (e.g. <a href="/vendors">) has
   loaded this shell inside itself; open that URL in the real shell instead. */
const loadedInsideShell = (() => {
  try {
    return window.self !== window.top && "__OMNE_SHELL__" in window.parent;
  } catch {
    return false;
  }
})();

if (loadedInsideShell) {
  window.top!.location.href = window.location.href;
} else {
  createRoot(document.getElementById("root")!).render(<App />);
}
