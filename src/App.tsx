import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AppLayout } from "./app/components/layout/AppLayout";
import { CurrencyProvider } from "./app/context/CurrencyContext";
import { ExchangeRateProvider } from "./app/context/ExchangeRateContext";
import { touchpointPrefixes } from "./app/touchpoints";
import { lazy, Suspense } from "react";

const AccountingHomePage = lazy(() => import("./app/pages/AccountingHomePage").then(m => ({ default: m.AccountingHomePage })));
const CurrencyExchangePage = lazy(() => import("./app/pages/CurrencyExchangePage").then(m => ({ default: m.CurrencyExchangePage })));
const CurrencyDetailPage = lazy(() => import("./app/pages/CurrencyDetailPage").then(m => ({ default: m.CurrencyDetailPage })));
const CurrencyPairDetailPage = lazy(() => import("./app/pages/CurrencyPairDetailPage").then(m => ({ default: m.CurrencyPairDetailPage })));
const CoaKitDemo = lazy(() => import("./app/coa/demo/CoaKitDemo").then(m => ({ default: m.CoaKitDemo })));

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
                  {/* Currency & Exchange Rates: one page, a tab per path. */}
                  <Route path="/accounting/currencies" element={<CurrencyExchangePage />} />
                  <Route path="/accounting/currencies/:code" element={<CurrencyDetailPage />} />
                  <Route path="/accounting/exchange-rates" element={<CurrencyExchangePage />} />
                  <Route path="/accounting/exchange-rates/:code" element={<CurrencyPairDetailPage />} />
                  <Route path="/accounting/coa-kit/*" element={<CoaKitDemo />} />
                  {/* Touchpoint modules render in AppLayout (TouchpointFrames), not here. */}
                  {touchpointPrefixes.map((prefix) => (
                    <Route key={prefix} path={`${prefix}/*`} element={null} />
                  ))}
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
