import { Outlet, useLocation } from "react-router-dom";
import { AppSidebar } from "./AppSidebar";
import { TouchpointFrames } from "./TouchpointFrames";
import { Toaster } from "sonner";
import { VendorProvider } from "../../context/VendorContext";
import { matchTouchpoint } from "../../touchpoints";
import { ToastViewport } from "../../coa/components/ToastViewport";

export function AppLayout() {
  const touchpoint = matchTouchpoint(useLocation().pathname);

  return (
    <VendorProvider>
      <div className="flex h-screen w-full overflow-hidden bg-background">
        <AppSidebar />
        <main className="flex-1 min-w-0 overflow-hidden flex flex-col relative z-0">
          {!touchpoint && <Outlet />}
          <TouchpointFrames match={touchpoint} />
        </main>
        <Toaster position="top-right" richColors />
        <ToastViewport />
      </div>
    </VendorProvider>
  );
}