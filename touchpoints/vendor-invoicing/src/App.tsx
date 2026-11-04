import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { TooltipProvider } from "@/components/ui/tooltip";
import Index from "./pages/Index.tsx";
import NotFound from "./pages/NotFound.tsx";
import { embedded } from "./embedding";
import { EmbeddingBridge } from "./EmbeddingBridge";

// Sonner Toaster is mounted by the inner app/App at position="top-right";
// we don't mount one here too or every toast fires in both positions.

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      {/* basename: the shell serves this app under /touchpoint-apps/vendor-invoicing/ (see src/embedding.ts). */}
      <BrowserRouter basename={import.meta.env.BASE_URL}>
        <EmbeddingBridge />
        <Routes>
          <Route path="/" element={<Index />} />
          {/* The shell's frame always loads index.html, then moves to the page
              it wants: render nothing there (a redirect could land after the
              shell's move and undo it). Opened on its own, it goes home. */}
          <Route path="/index.html" element={embedded ? null : <Navigate to="/" replace />} />
          {/* Section routes — all render the inner App; the inner
              App's currentScreen syncs to the URL pathname so the
              browser back/forward + reload + deep-link all work. */}
          <Route path="/overview" element={<Index />} />
          <Route path="/dashboard" element={<Index />} />
          <Route path="/invoices" element={<Index />} />
          <Route path="/invoices/:invoiceNumber" element={<Index />} />
          {/* Credit memos are real records with a real page (9/22/26). */}
          <Route path="/credit-memos/:creditMemoNumber" element={<Index />} />
          <Route path="/prepayments" element={<Index />} />
          <Route path="/payments-v2" element={<Index />} />
          {/* Payment runs — declared above :paymentNumber so the static
              "runs" segment wins the match. */}
          <Route path="/payments-v2/runs" element={<Index />} />
          <Route path="/payments-v2/runs/:runId" element={<Index />} />
          <Route path="/payments-v2/:paymentNumber" element={<Index />} />
          {/* AR mirrors of the AP modules (7/17/26) — same screens, same
              data, customer/sales-order terminology. */}
          <Route path="/customer-invoices" element={<Index />} />
          <Route path="/customer-invoices/:invoiceNumber" element={<Index />} />
          <Route path="/customer-payments" element={<Index />} />
          <Route path="/customer-payments/:paymentNumber" element={<Index />} />
          <Route path="/receiving" element={<Index />} />
          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
