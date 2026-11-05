import { Outlet } from "react-router-dom";
import { AppSidebar } from "./AppSidebar";
import { Toaster } from "../ui/sonner";
import { ItemsProvider } from "../../context/ItemsContext";
import { PurchasingProvider } from "../../context/PurchasingContext";
import { OfflineProvider } from "../../context/OfflineContext";
import { NotificationsProvider } from "../../context/NotificationsContext";

export function AppLayout() {
  return (
    <ItemsProvider>
      <PurchasingProvider>
        <OfflineProvider>
          <NotificationsProvider>
            <div className="flex h-screen w-full overflow-hidden bg-background">
              <AppSidebar />
              <main className="flex-1 min-w-0 overflow-hidden flex flex-col relative z-0">
                <Outlet />
              </main>
              <Toaster position="top-right" />
            </div>
          </NotificationsProvider>
        </OfflineProvider>
      </PurchasingProvider>
    </ItemsProvider>
  );
}
