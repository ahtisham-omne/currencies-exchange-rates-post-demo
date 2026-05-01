import { useState } from 'react';
import { InvoiceTypeSelectionModal } from '@/app/components/InvoiceTypeSelectionModal';
import { VendorSelectionModalNested as VendorSelectionModal, SelectedPOData } from '@/app/components/VendorSelectionModalNested';
import { StandaloneVendorSelectionModal, StandaloneVendorData } from '@/app/components/StandaloneVendorSelectionModal';
import { CreateInvoiceScreen } from '@/app/components/CreateInvoiceScreen';
import { Invoice } from '@/app/data/mockInvoices';

interface InvoiceCreationFlowProps {
  onClose: () => void;
  onInvoicesCreated: (invoices: Invoice[]) => void;
}

type FlowStep = 'type-selection' | 'inventory-selection' | 'standalone-vendor-selection' | 'create-invoice';
type InvoiceType = 'draft' | 'receiving' | 'po' | 'standalone';

export function InvoiceCreationFlow({ onClose, onInvoicesCreated }: InvoiceCreationFlowProps) {
  const [currentStep, setCurrentStep] = useState<FlowStep>('type-selection');
  const [invoiceType, setInvoiceType] = useState<InvoiceType | null>(null);
  const [selectedPOs, setSelectedPOs] = useState<SelectedPOData[]>([]);
  const [standaloneVendor, setStandaloneVendor] = useState<StandaloneVendorData | null>(null);

  const handleTypeSelection = (type: InvoiceType) => {
    setInvoiceType(type);
    
    if (type === 'receiving' || type === 'po') {
      setCurrentStep('inventory-selection');
    } else if (type === 'standalone') {
      setCurrentStep('standalone-vendor-selection');
    } else {
      setCurrentStep('create-invoice');
    }
  };

  const handleInventorySelection = (selectedData: SelectedPOData[]) => {
    setSelectedPOs(selectedData);
    setCurrentStep('create-invoice');
  };

  const handleStandaloneVendorSelection = (vendor: StandaloneVendorData) => {
    setStandaloneVendor(vendor);
    setCurrentStep('create-invoice');
  };

  const handleGoBack = () => {
    if (currentStep === 'inventory-selection' || currentStep === 'standalone-vendor-selection') {
      setCurrentStep('type-selection');
      setInvoiceType(null);
      setStandaloneVendor(null);
    } else if (currentStep === 'create-invoice') {
      if (invoiceType === 'receiving' || invoiceType === 'po') {
        setCurrentStep('inventory-selection');
      } else if (invoiceType === 'standalone') {
        setCurrentStep('standalone-vendor-selection');
      } else {
        setCurrentStep('type-selection');
      }
    }
  };

  const handleCloseAll = () => {
    setCurrentStep('type-selection');
    setInvoiceType(null);
    setSelectedPOs([]);
    setStandaloneVendor(null);
    onClose();
  };

  return (
    <>
      {/* Step 1: Invoice Type Selection */}
      {currentStep === 'type-selection' && (
        <InvoiceTypeSelectionModal
          onClose={handleCloseAll}
          onSelectType={handleTypeSelection}
        />
      )}

      {/* Step 2a: Inventory Selection (Vendor-First Nesting) */}
      {currentStep === 'inventory-selection' && (
        <VendorSelectionModal
          isOpen={true}
          onClose={handleGoBack}
          onContinue={handleInventorySelection}
        />
      )}

      {/* Step 2b: Standalone Vendor Selection */}
      {currentStep === 'standalone-vendor-selection' && (
        <StandaloneVendorSelectionModal
          isOpen={true}
          onClose={handleGoBack}
          onSelectVendor={handleStandaloneVendorSelection}
        />
      )}

      {/* Step 3: Create Invoice Screen */}
      {currentStep === 'create-invoice' && (
        <CreateInvoiceScreen 
          onClose={handleCloseAll}
          invoiceType={invoiceType}
          selectedPOsData={selectedPOs}
          standaloneVendor={standaloneVendor}
          onInvoicesCreated={onInvoicesCreated}
        />
      )}
    </>
  );
}
