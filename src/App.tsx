/* NOTE: This file is not the active app entry. `main.tsx` imports
   `./app/App.tsx`, which routes through `app/components/so/AppLayout`.
   Kept here only as a scaffold template — if anyone resurrects it, the
   Toaster mount should match Partner's: a single sonner `<Toaster
   position="top-right" richColors />`, not the shadcn `<Toaster />` +
   `<Sonner />` dual mount the Lovable template ships with. */
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster } from "sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import Index from "./pages/Index.tsx";
import NotFound from "./pages/NotFound.tsx";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Index />} />
          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
      <Toaster position="top-right" richColors />
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
