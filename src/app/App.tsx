import React, { useState, useCallback } from 'react';
import { Layout } from '@/app/components/Layout';
import { InvoiceListScreen } from '@/app/components/InvoiceListScreen';
import { InvoiceCreationFlow } from '@/app/components/InvoiceCreationFlow';
import { InvoiceDetailScreen } from '@/app/components/InvoiceDetailScreen';
import { PrepaymentsScreen } from '@/app/components/PrepaymentsScreen';
import { PaymentsScreen } from '@/app/components/PaymentsScreen';
import { ReceivingDocumentsScreen } from '@/app/components/ReceivingDocumentsScreen';
import { Toaster } from '@/app/components/ui/sonner';
import { SafeMuiThemeProvider } from '@/app/components/MuiThemeContext';
import { mockInvoices, Invoice } from '@/app/data/mockInvoices';
import { RateProvider } from '@/app/context/RateContext';

type Screen = 'invoices' | 'prepayments' | 'payments' | 'receiving';

export default function App() {
  const [currentScreen, setCurrentScreen] = useState<Screen>('invoices');
  const [showCreateInvoice, setShowCreateInvoice] = useState(false);
  const [selectedInvoiceId, setSelectedInvoiceId] = useState<string | null>(null);
  const [invoices, setInvoices] = useState<Invoice[]>(mockInvoices);

  const handleInvoicesCreated = useCallback((newInvoices: Invoice[]) => {
    setInvoices(prev => [...newInvoices, ...prev]);
  }, []);

  return (
    <SafeMuiThemeProvider>
      <RateProvider>
      <Layout
        activeView={currentScreen}
        onViewChange={(view: any) => setCurrentScreen(view as Screen)}
      >
        {currentScreen === 'invoices' && (
          <InvoiceListScreen
            invoices={invoices}
            onCreateInvoice={() => setShowCreateInvoice(true)}
            onViewInvoice={(id) => setSelectedInvoiceId(id)}
          />
        )}
        {currentScreen === 'prepayments' && <PrepaymentsScreen />}
        {currentScreen === 'payments' && <PaymentsScreen />}
        {currentScreen === 'receiving' && <ReceivingDocumentsScreen />}
        
        {showCreateInvoice && (
          <InvoiceCreationFlow 
            onClose={() => setShowCreateInvoice(false)} 
            onInvoicesCreated={handleInvoicesCreated}
          />
        )}
        
        {selectedInvoiceId && (
          <InvoiceDetailScreen
            invoiceId={selectedInvoiceId}
            onClose={() => setSelectedInvoiceId(null)}
            invoices={invoices}
          />
        )}
      </Layout>
      <Toaster position="top-right" />
      </RateProvider>
    </SafeMuiThemeProvider>
  );
}
