import { Routes, Route, Navigate } from 'react-router-dom'
import { AppShell } from './components/AppShell'
import ChartOfAccountsPage from './pages/ChartOfAccounts'
import GeneralLedgerPage from './pages/GeneralLedger'
import JournalEntryDetailPage from './pages/JournalEntryDetail'
import AccountingOverviewPage from './pages/AccountingOverview'
import AccountDetailPage from './pages/AccountDetail'
import SetupPage from './pages/Setup'
import NumberingPage from './pages/Numbering'
import MergePage from './pages/Merge'
import FiscalYearSettingsPage from './pages/FiscalYearSettings'
import DimensionsPage from './pages/Dimensions'
import { useStoreHydrated } from './store'

// The eight PRD screens of the Chart of Accounts module. Screens 3 (Create)
// and 4 (Edit/Deactivate/Delete) are slide-overs surfaced from the main
// screen, so they have no standalone route.
export default function App() {
  // Hold the first paint until the saved chart is back, so the reader never sees
  // the seeded demo figures replaced by their own.
  if (!useStoreHydrated()) return null

  return (
    <AppShell>
      <Routes>
        <Route path="/accounting" element={<AccountingOverviewPage />} />
        <Route path="/chart-of-accounts" element={<ChartOfAccountsPage />} />
        <Route path="/general-ledger" element={<GeneralLedgerPage />} />
        <Route path="/general-ledger/entry/:jeId" element={<JournalEntryDetailPage />} />
        <Route path="/chart-of-accounts/setup" element={<SetupPage />} />
        <Route path="/chart-of-accounts/:id" element={<AccountDetailPage />} />
        <Route path="/numbering" element={<NumberingPage />} />
        <Route path="/merge" element={<MergePage />} />
        <Route path="/fiscal-year" element={<FiscalYearSettingsPage />} />
        <Route path="/dimensions" element={<DimensionsPage />} />
        <Route path="*" element={<Navigate to="/chart-of-accounts" replace />} />
      </Routes>
    </AppShell>
  )
}
