import { Outlet } from "react-router-dom";
import { AppSidebar } from "./AppSidebar";
import { OfflineBar } from "./OfflineBar";
import { Toaster } from "../ui/sonner";
import { VendorProvider } from "../../context/VendorContext";
import { PartnerGroupsProvider } from "../../context/PartnerGroupsContext";
import { PaymentTermStatusProvider } from "../../context/PaymentTermStatusContext";
import { PricingRuleStatusProvider } from "../../context/PricingRuleStatusContext";
import { OfflineProvider } from "../../context/OfflineContext";
import { embedded } from "@/embedding";

export function AppLayout() {
  return (
    <VendorProvider>
      <PartnerGroupsProvider>
        <PaymentTermStatusProvider>
          <PricingRuleStatusProvider>
            <OfflineProvider>
              <div className="flex flex-col h-screen w-full overflow-hidden bg-background">
                <OfflineBar />
                <div className="flex flex-1 min-h-0 w-full overflow-hidden">
                  {/* Inside the Currency & Exchange shell, the shell's sidebar replaces this one. */}
                  {!embedded && <AppSidebar />}
                  <main className="flex-1 min-w-0 overflow-hidden flex flex-col relative z-0">
                    <Outlet />
                  </main>
                </div>
                <Toaster position="top-right" />
              </div>
            </OfflineProvider>
          </PricingRuleStatusProvider>
        </PaymentTermStatusProvider>
      </PartnerGroupsProvider>
    </VendorProvider>
  );
}