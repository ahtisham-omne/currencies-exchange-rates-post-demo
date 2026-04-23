import { Outlet } from "react-router-dom";
import { AppSidebar } from "./AppSidebar";
import { Toaster } from "sonner";
import { VendorProvider } from "../../context/VendorContext";
import { RateProvider } from "../../context/RateContext";

export function AppLayout() {
  return (
    <RateProvider>
      <VendorProvider>
        <div className="flex h-screen w-full overflow-hidden bg-background">
          <AppSidebar />
          <main className="flex-1 min-w-0 overflow-hidden flex flex-col relative z-0">
            <Outlet />
          </main>
          <Toaster position="top-right" richColors />
        </div>
      </VendorProvider>
    </RateProvider>
  );
}