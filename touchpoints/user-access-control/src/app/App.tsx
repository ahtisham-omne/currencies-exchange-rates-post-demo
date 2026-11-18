import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Layout } from "./components/Layout";
import { CompanySetupOverview } from "./components/CompanySetupOverview";
import { ItemsInventoryOverview } from "./components/ItemsInventoryOverview";
import { ItemsLibrary } from "./components/ItemsLibrary";
import { UserAccessControl } from "./components/UserAccessControl";
import { UserDetailPage } from "./components/user-detail/UserDetailPage";
import { RoleDetailPage } from "./components/role-detail/RoleDetailPage";
import { AccessMatrixPage } from "./components/AccessMatrixPage";
import { PlaceholderPage } from "./components/PlaceholderPage";
import { GeneralSettingsPage } from "./components/general-settings/GeneralSettingsPage";
import { SecurityMfaPolicyPage } from "./components/SecurityMfaPolicyPage";
import { DataImportsPage } from "./components/data-imports/DataImportsPage";
import { DataImportDetailPage } from "./components/data-imports/DataImportDetailPage";
import { ImportRecordDetailPage } from "./components/data-imports/ImportRecordDetailPage";
import { RolesImportRecordDetailPage } from "./components/data-imports/RolesImportRecordDetailPage";
import { QuotesImportRecordDetailPage } from "./components/data-imports/quotes/QuotesImportSurface";
import { SalesOrdersImportRecordDetailPage } from "./components/data-imports/sales-orders/SalesOrdersImportSurface";
import { ModuleImportRecordPage } from "./components/data-imports/modules/ModuleImportRecordPage";
import { isModuleImportSlug } from "./components/data-imports/modules/moduleImportDefs";
import { UserQuickViewProvider } from "./components/shared/UserQuickViewPanel";
import { ResetMfaReturn } from "./components/shared/ResetMfaReturn";
import { AssignPermissionsWizard } from "./components/assign-permissions/AssignPermissionsWizard";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useParams } from "react-router-dom";
import { EmbeddingBridge } from "@/EmbeddingBridge";

/* The import-record drill-down is module-specific: the Roles module renders
 * roles-shaped records, everything else keeps the Users-shaped page. Kept as
 * a tiny dispatcher so the route table stays a single line per path. */
function ImportRecordDetailRoute() {
  const { moduleSlug = "" } = useParams<{ moduleSlug: string }>();
  if (moduleSlug === "roles") return <RolesImportRecordDetailPage />;
  if (moduleSlug === "quotes") return <QuotesImportRecordDetailPage />;
  if (moduleSlug === "sales-orders") return <SalesOrdersImportRecordDetailPage />;
  if (isModuleImportSlug(moduleSlug)) return <ModuleImportRecordPage />;
  return <ImportRecordDetailPage />;
}

export default function App() {
  return (
    /* basename: the shell serves this app under /touchpoint-apps/user-access-control/ (see src/embedding.ts). */
    <BrowserRouter basename={import.meta.env.BASE_URL}>
      <EmbeddingBridge />
      <TooltipProvider delayDuration={200}>
      <UserQuickViewProvider>
        <Routes>
          <Route element={<Layout />}>
            {/* Default route → Company Setup Overview */}
            <Route index element={<CompanySetupOverview />} />

            {/* Company Setup */}
            <Route path="company-settings" element={<CompanySetupOverview />} />
            <Route path="company-settings/alerts" element={<PlaceholderPage />} />
            <Route path="company-settings/module-defaults" element={<PlaceholderPage />} />
            <Route path="company-settings/general" element={<GeneralSettingsPage />} />
            <Route path="company-settings/security" element={<PlaceholderPage />} />
            <Route path="company-settings/security/mfa-policy" element={<SecurityMfaPolicyPage />} />
            <Route path="company-settings/units-of-measure" element={<PlaceholderPage />} />
            <Route path="company-settings/user-access-control" element={<UserAccessControl />} />
            <Route path="company-settings/user-access-control/user/:userId" element={<UserDetailPage />} />
            <Route path="company-settings/user-access-control/role/:roleId" element={<RoleDetailPage />} />
            {/* Self-documentation for the access-persona model, reached from the
             *  header avatar menu. */}
            <Route path="company-settings/user-access-control/access-matrix" element={<AccessMatrixPage />} />
            <Route path="company-settings/data-imports" element={<DataImportsPage />} />
            <Route path="company-settings/data-imports/:moduleSlug" element={<DataImportDetailPage />} />
            <Route path="company-settings/data-imports/:moduleSlug/:importId" element={<ImportRecordDetailRoute />} />

            {/* Other modules (placeholder) */}
            <Route path="items-inventory" element={<ItemsInventoryOverview />} />
            <Route path="items-inventory/items-library" element={<ItemsLibrary />} />
            <Route path="items-inventory/*" element={<PlaceholderPage />} />
            <Route path="partners" element={<PlaceholderPage />} />
            <Route path="partners/*" element={<PlaceholderPage />} />
            <Route path="vendors" element={<PlaceholderPage />} />
            <Route path="vendors/*" element={<PlaceholderPage />} />
            <Route path="supply-chain" element={<PlaceholderPage />} />
            <Route path="supply-chain/*" element={<PlaceholderPage />} />
            <Route path="production" element={<PlaceholderPage />} />
            <Route path="production/*" element={<PlaceholderPage />} />
            <Route path="sales" element={<PlaceholderPage />} />
            <Route path="sales/*" element={<PlaceholderPage />} />
            <Route path="accounting" element={<PlaceholderPage />} />
            <Route path="accounting/*" element={<PlaceholderPage />} />
            <Route path="people" element={<PlaceholderPage />} />
            <Route path="people/*" element={<PlaceholderPage />} />

            {/* Catch-all */}
            <Route path="*" element={<PlaceholderPage />} />
          </Route>
        </Routes>
        {/* Back from the sign-in page after Reset User MFA (ERP-5179). */}
        <ResetMfaReturn />
        {/* Global "set up permissions" flow, opened from the import completion
         *  hand-off, the roles listing nudge / bulk action, and role detail. */}
        <AssignPermissionsWizard />
      </UserQuickViewProvider>
      </TooltipProvider>
    </BrowserRouter>
  );
}
