import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AppLayout } from "./app/components/layout/AppLayout";
import { CurrencyProvider } from "./app/context/CurrencyContext";
import { ExchangeRateProvider } from "./app/context/ExchangeRateContext";
import { lazy, Suspense } from "react";

const PartnersHomePage = lazy(() => import("./app/pages/PartnersHomePage").then(m => ({ default: m.PartnersHomePage })));
const VendorsListPage = lazy(() => import("./app/pages/VendorsListPage").then(m => ({ default: m.VendorsListPage })));
const VendorCreatePage = lazy(() => import("./app/pages/VendorCreatePage").then(m => ({ default: m.VendorCreatePage })));
const VendorDetailsPage = lazy(() => import("./app/pages/VendorDetailsPage").then(m => ({ default: m.VendorDetailsPage })));
const VendorEditPage = lazy(() => import("./app/pages/VendorEditPage").then(m => ({ default: m.VendorEditPage })));
const PartnerGroupsPage = lazy(() => import("./app/pages/PartnerGroupsPage").then(m => ({ default: m.PartnerGroupsPage })));
const ContactsDirectoryPage = lazy(() => import("./app/pages/ContactsDirectoryPage").then(m => ({ default: m.ContactsDirectoryPage })));
const ContactDetailPage = lazy(() => import("./app/pages/ContactDetailPage").then(m => ({ default: m.ContactDetailPage })));
const CreditManagementPage = lazy(() => import("./app/pages/CreditManagementPage").then(m => ({ default: m.CreditManagementPage })));
const CarrierManagementPage = lazy(() => import("./app/pages/CarrierManagementPage").then(m => ({ default: m.CarrierManagementPage })));
const PartnerLocationsPage = lazy(() => import("./app/pages/PartnerLocationsPage").then(m => ({ default: m.PartnerLocationsPage })));
const QualifiedVendorsPage = lazy(() => import("./app/pages/QualifiedVendorsPage").then(m => ({ default: m.QualifiedVendorsPage })));
const ReportsAnalyticsPage = lazy(() => import("./app/pages/ReportsAnalyticsPage").then(m => ({ default: m.ReportsAnalyticsPage })));
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
                  <Route path="/" element={<Navigate to="/partners" replace />} />
                  <Route path="/partners" element={<PartnersHomePage />} />
                  <Route path="/partners/groups" element={<PartnerGroupsPage />} />
                  <Route path="/partners/contacts" element={<ContactsDirectoryPage />} />
                  <Route path="/partners/contacts/:contactId" element={<ContactDetailPage />} />
                  <Route path="/partners/credit" element={<CreditManagementPage />} />
                  <Route path="/partners/carriers" element={<CarrierManagementPage />} />
                  <Route path="/partners/locations" element={<PartnerLocationsPage />} />
                  <Route path="/partners/qualified-vendors" element={<QualifiedVendorsPage />} />
                  <Route path="/partners/reports" element={<ReportsAnalyticsPage />} />
                  <Route path="/vendors" element={<VendorsListPage />} />
                  <Route path="/vendors/create" element={<VendorCreatePage />} />
                  <Route path="/vendors/:id" element={<VendorDetailsPage />} />
                  <Route path="/vendors/:id/edit" element={<VendorEditPage />} />
                  <Route path="/accounting" element={<AccountingHomePage />} />
                  <Route path="/accounting/currencies" element={<CurrencyListPage />} />
                  <Route path="/accounting/currencies/:code" element={<CurrencyDetailPage />} />
                  <Route path="/accounting/exchange-rates" element={<ExchangeRateLibraryPage />} />
                  <Route path="/accounting/exchange-rates/:code" element={<CurrencyPairDetailPage />} />
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
