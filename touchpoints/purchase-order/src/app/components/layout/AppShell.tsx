import React from "react";
import AppSidebar from "./AppSidebar";

/* Inside the Currency & Exchange shell, the shell's sidebar replaces this one. */
const embedded = (() => {
  try {
    return window.self !== window.top && "__OMNE_SHELL__" in window.parent;
  } catch {
    return false;
  }
})();

/**
 * AppShell — Pattern C2 layout wrapper.
 * Collapsible sidebar on the left, content fills the rest.
 * The sidebar manages its own width; content auto-fills via flex.
 */
export default function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="flex h-screen overflow-hidden"
      style={{ backgroundColor: "var(--background)" }}
    >
      {/* Sidebar — manages its own width */}
      {!embedded && <AppSidebar />}

      {/* Main content area — fills remaining space */}
      <div className="flex flex-col flex-1 min-w-0">
        {children}
      </div>
    </div>
  );
}
