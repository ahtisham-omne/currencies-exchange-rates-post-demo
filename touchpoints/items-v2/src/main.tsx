import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./app/App.tsx";
import { EmbeddingBridge } from "./EmbeddingBridge";
import "./index.css";

createRoot(document.getElementById("root")!).render(
  /* basename: the shell serves this app under /touchpoint-apps/items-v2/ (see src/embedding.ts). */
  <BrowserRouter basename={import.meta.env.BASE_URL}>
    <EmbeddingBridge />
    <App />
  </BrowserRouter>
);
