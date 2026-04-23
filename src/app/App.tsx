import { lazy, Suspense } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { AppLayout } from "./components/layout/AppLayout";
import { TooltipProvider } from "@/components/ui/tooltip";

/* ─── Lazy-loaded page wrappers ─── */
const DashboardPage = lazy(() => import("./pages/DashboardPage"));
const ItemsLibraryPage = lazy(() => import("./pages/ItemsLibraryPage"));
const ItemCreationPage = lazy(() => import("./pages/ItemCreationPage"));
const ItemDetailPage = lazy(() => import("./pages/ItemDetailPage"));
const QualifiedVendorsPage = lazy(() => import("./pages/QualifiedVendorsPage"));
const SalesOverviewPage = lazy(() => import("./pages/SalesOverviewPageRoute"));
const ItemsV3DemoPage = lazy(() => import("./pages/ItemsV3DemoPage"));

function PageFallback() {
  return <div className="flex-1" />;
}

export default function App() {
  return (
    <TooltipProvider>
      <Routes>
        <Route element={<AppLayout />}>
          <Route index element={<Navigate to="/items" replace />} />
          <Route
            path="/dashboard"
            element={
              <Suspense fallback={<PageFallback />}>
                <DashboardPage />
              </Suspense>
            }
          />
          <Route
            path="/items"
            element={
              <Suspense fallback={<PageFallback />}>
                <ItemsLibraryPage />
              </Suspense>
            }
          />
          <Route
            path="/items/new"
            element={
              <Suspense fallback={<PageFallback />}>
                <ItemCreationPage />
              </Suspense>
            }
          />
          <Route
            path="/items/:id"
            element={
              <Suspense fallback={<PageFallback />}>
                <ItemDetailPage />
              </Suspense>
            }
          />
          <Route
            path="/vendors"
            element={
              <Suspense fallback={<PageFallback />}>
                <QualifiedVendorsPage />
              </Suspense>
            }
          />
          <Route
            path="/sales"
            element={
              <Suspense fallback={<PageFallback />}>
                <SalesOverviewPage />
              </Suspense>
            }
          />
          <Route
            path="/items-v3-demo"
            element={
              <Suspense fallback={<PageFallback />}>
                <ItemsV3DemoPage />
              </Suspense>
            }
          />
        </Route>
      </Routes>
    </TooltipProvider>
  );
}
