import { RouterProvider } from "react-router-dom";
import { router } from "./routes";
import { Toaster } from "./components/ui/sonner";
import { TooltipProvider } from "./components/ui/tooltip";
import { PersonAvatarLightboxProvider } from "./components/PersonAvatarLightbox";

function App() {
  return (
    <TooltipProvider>
      {/* `PersonAvatarLightboxProvider` is hoisted to the app root so the
          zoom-icon inside QuickViewPanel + pocQuickViewPanel works no
          matter where those panels are mounted (listing, cart, PO detail,
          catalogue, etc.). Previously it lived only inside
          `PurchaseOrdersListing.tsx`, which left the zoom icon as a no-op
          on every other surface. */}
      <PersonAvatarLightboxProvider>
        <RouterProvider router={router} />
        <Toaster position="bottom-right" richColors />
      </PersonAvatarLightboxProvider>
    </TooltipProvider>
  );
}

export default App;
