import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AppLayout } from "./app/components/layout/AppLayout";
import { CurrencyProvider } from "./app/context/CurrencyContext";
import { ExchangeRateProvider } from "./app/context/ExchangeRateContext";
import { lazy, Suspense } from "react";

const AccountingHomePage = lazy(() => import("./app/pages/AccountingHomePage").then(m => ({ default: m.AccountingHomePage })));
const CurrencyListPage = lazy(() => import("./app/pages/CurrencyListPage").then(m => ({ default: m.CurrencyListPage })));
const CurrencyDetailPage = lazy(() => import("./app/pages/CurrencyDetailPage").then(m => ({ default: m.CurrencyDetailPage })));
const ExchangeRateLibraryPage = lazy(() => import("./app/pages/ExchangeRateLibraryPage").then(m => ({ default: m.ExchangeRateLibraryPage })));
const CurrencyPairDetailPage = lazy(() => import("./app/pages/CurrencyPairDetailPage").then(m => ({ default: m.CurrencyPairDetailPage })));

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <CurrencyProvider>
        <ExchangeRateProvider>
          <BrowserRouter>
            <Suspense fallback={<div className="flex min-h-screen items-center justify-center">Loading…</div>}>
              <Routes>
                <Route element={<AppLayout />}>
                  <Route path="/" element={<Navigate to="/accounting" replace />} />
                  <Route path="/accounting" element={<AccountingHomePage />} />
                  <Route path="/accounting/currencies" element={<CurrencyListPage />} />
                  <Route path="/accounting/currencies/:code" element={<CurrencyDetailPage />} />
                  <Route path="/accounting/exchange-rates" element={<ExchangeRateLibraryPage />} />
                  <Route path="/accounting/exchange-rates/:code" element={<CurrencyPairDetailPage />} />
                  {/* Partners module is restricted in this build — any direct
                     URL navigation falls back to the Accounting overview. */}
                  <Route path="/partners/*" element={<Navigate to="/accounting" replace />} />
                  <Route path="/vendors/*" element={<Navigate to="/accounting" replace />} />
                  <Route path="*" element={<Navigate to="/accounting" replace />} />
                </Route>
              </Routes>
            </Suspense>
          </BrowserRouter>
        </ExchangeRateProvider>
      </CurrencyProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
