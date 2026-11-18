import { Outlet, useLocation } from "react-router-dom";
import { Sidebar } from "./Sidebar";
import { Header } from "./Header";
import { Toaster } from "sonner";
import { motion, AnimatePresence } from "motion/react";
import { embedded } from "@/embedding";

export function Layout() {
  const location = useLocation();

  return (
    <div className="flex h-screen overflow-hidden font-['Inter',sans-serif]" style={{ backgroundColor: "#F8FAFC" }}>
      {/* Inside the Currency & Exchange shell, the shell's sidebar replaces this one. */}
      {!embedded && <Sidebar />}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <Header />
        <main className="flex-1 overflow-hidden flex flex-col min-h-0">
          <AnimatePresence mode="wait">
            <motion.div
              key={location.pathname}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15, ease: "easeOut" }}
              className="flex-1 flex flex-col min-h-0 overflow-auto"
            >
              <Outlet />
            </motion.div>
          </AnimatePresence>
        </main>
      </div>
      <Toaster position="top-right" richColors closeButton />
    </div>
  );
}