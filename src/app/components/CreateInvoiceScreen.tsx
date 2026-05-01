import { useState, useMemo, useEffect } from 'react';
import { 
  X, 
  ShoppingCart, 
  Upload, 
  Maximize2, 
  Info, 
  Calendar,
  FileText,
  Paperclip,
  ArrowRight,
  Check,
  CheckCircle2,
  ArrowLeft,
  ChevronDown,
  ChevronUp,
  LayoutGrid,
  ReceiptText,
  Package,
  Wallet,
  Plus,
  AlertTriangle,
  Clock,
  ExternalLink,
  RotateCcw,
  Truck,
  DollarSign,
  Lock,
  Edit3,
  Trash2,
  Search,
  SendHorizontal,
  Users,
  Building2,
  Settings2
} from 'lucide-react';
import { Button } from '@/app/components/ui/button';
import { Input } from '@/app/components/ui/input';
import { Label } from '@/app/components/ui/label';
import { Textarea } from '@/app/components/ui/textarea';
import { Checkbox } from '@/app/components/ui/checkbox';
import { ScrollArea } from "@/app/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/app/components/ui/select';
import { Switch } from '@/app/components/ui/switch';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/app/components/ui/accordion";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/app/components/ui/hover-card";
import { SelectedPOData, VendorSelectionModalNested } from '@/app/components/VendorSelectionModalNested';
import { StandaloneVendorData } from '@/app/components/StandaloneVendorSelectionModal';
import { mockVendors, LineItem as MockLineItem, VendorPO } from '@/app/data/mockVendors';
import { toast } from 'sonner';
import { Invoice } from '@/app/data/mockInvoices';

import { ImageWithFallback } from './figma/ImageWithFallback';

interface CreateInvoiceScreenProps {
  onClose: () => void;
  invoiceType?: 'draft' | 'receiving' | 'po' | 'standalone' | null;
  selectedPOsData?: SelectedPOData[];
  standaloneVendor?: StandaloneVendorData | null;
  onInvoicesCreated?: (invoices: Invoice[]) => void;
}

interface LineItem {
  id: string;
  sku: string;
  description: string;
  orderedQty: number;
  receivedQty: number;
  invoiceQty: number;
  remainingQty: number;
  uom: string;
  unitPrice: number;
  lineTotal: number;
  poNumber: string;
  grnNumbers: string[];
  grnDate?: string;
  isPreInvoice: boolean;
  glAccount: string;
}

const GL_ACCOUNTS = [
  "1200 Inventory",
  "1205 Advance Payments",
  "1210 Inventory-WIP",
  "1220 Inventory-Finished Goods",
  "1230 Inventory-Raw Materials",
  "1240 Inventory-Consumables",
  "1250 Inventory-Packaging",
  "2000 Accounts Payable",
  "2100 Accrued Liabilities",
  "5000 Cost of Goods Sold",
  "5010 Raw Material Purchases",
  "5020 Freight Inbound",
  "5030 Duty & Customs",
  "5100 Direct Labor",
  "5200 Factory Overhead",
  "6000 General & Admin",
  "6100 Office Supplies",
  "6150 Printing & Postage",
  "6200 Utilities Expense",
  "6210 Electricity",
  "6220 Water & Sewage",
  "6230 Internet & Telecom",
  "6300 Rent Expense",
  "6400 Repair & Maintenance",
  "6500 Travel & Entertainment",
  "6600 Marketing & Advertising",
  "6700 Professional Fees",
  "6710 Legal Fees",
  "6720 Accounting Fees",
  "6730 Consulting Fees",
  "6800 Insurance Expense",
  "6900 Bank Charges",
  "7000 Interest Expense",
  "7100 Taxes & Licenses",
  "7200 Depreciation Expense",
  "7300 Amortization Expense",
  "8000 Other Income",
  "8100 Interest Income",
  "9000 Income Tax Expense",
  "9100 State Tax Expense",
  "9200 Local Tax Expense"
];

const AP_ACCOUNTS = [
  "2000 Accounts Payable",
  "2010 A/P – Trade Payables",
  "2020 A/P – Intercompany",
  "2030 A/P – Related Parties",
  "2050 A/P – Foreign Currency",
  "2100 Accrued Liabilities",
  "2110 Accrued Expenses",
  "2120 Accrued Wages & Salaries",
  "2130 Accrued Interest Payable",
  "2140 Accrued Taxes Payable",
  "2200 Notes Payable – Short Term",
  "2300 Unearned Revenue",
  "2400 Retention Payable",
  "2500 GST/VAT Payable",
  "2600 Withholding Tax Payable",
];

// Vendor-to-AP account auto-mapping by vendor category
const VENDOR_AP_MAPPING: Record<string, string> = {
  'Raw Materials': '2010 A/P – Trade Payables',
  'Packaging': '2010 A/P – Trade Payables',
  'Logistics': '2000 Accounts Payable',
  'Equipment': '2000 Accounts Payable',
  'Services': '2110 Accrued Expenses',
  'IT Services': '2110 Accrued Expenses',
  'Consulting': '2030 A/P – Related Parties',
  'default': '2000 Accounts Payable',
};

export function CreateInvoiceScreen({ onClose, invoiceType, selectedPOsData = [], standaloneVendor, onInvoicesCreated }: CreateInvoiceScreenProps) {
  const isStandalone = invoiceType === 'standalone';
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [additionalCharges, setAdditionalCharges] = useState<{id: number, type: string, amount: number}[]>([
    { id: Date.now(), type: 'Tax', amount: 0 }
  ]);

  // Standalone line items state
  const [standaloneItems, setStandaloneItems] = useState<{id: string; description: string; quantity: number; uom: string; unitPrice: number; glAccount: string; amount: number}[]>([
    { id: `sa-${Date.now()}`, description: '', quantity: 1, uom: 'EA', unitPrice: 0, glAccount: '', amount: 0 }
  ]);

  const addStandaloneItem = () => {
    setStandaloneItems(prev => [...prev, {
      id: `sa-${Date.now()}-${prev.length}`,
      description: '',
      quantity: 1,
      uom: 'EA',
      unitPrice: 0,
      glAccount: '',
      amount: 0
    }]);
  };

  const removeStandaloneItem = (id: string) => {
    setStandaloneItems(prev => prev.filter(i => i.id !== id));
  };

  const updateStandaloneItem = (id: string, field: string, value: any) => {
    setStandaloneItems(prev => prev.map(i => i.id === id ? { ...i, [field]: value } : i));
  };

  const clearAllStandaloneItems = () => {
    setStandaloneItems([{ id: `sa-${Date.now()}`, description: '', quantity: 1, uom: 'EA', unitPrice: 0, glAccount: '', amount: 0 }]);
  };

  const standaloneSubtotal = standaloneItems.reduce((sum, i) => sum + (i.amount || 0), 0);

  // Local state for POs to allow adding/removing
  const [currentPOsData, setCurrentPOsData] = useState<SelectedPOData[]>(selectedPOsData || []);
  const [glConfigModalItemId, setGlConfigModalItemId] = useState<string | null>(null);
  const [glModalSearch, setGlModalSearch] = useState('');
  const [poGlConfigModalItemId, setPoGlConfigModalItemId] = useState<string | null>(null);
  const [poGlModalSearch, setPoGlModalSearch] = useState('');
  const [poToRemove, setPoToRemove] = useState<string | null>(null);
  const [isAddPOOpen, setIsAddPOOpen] = useState(false);
  const [isAddItemModalOpen, setIsAddItemModalOpen] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showBreakdown, setShowBreakdown] = useState(false);

  // Freight State
  const [carrierName, setCarrierName] = useState('FedEx Ground');
  const [shippingMethod, setShippingMethod] = useState('Standard');
  const [dispatchType, setDispatchType] = useState('Direct');
  const [freightAmount, setFreightAmount] = useState(0);

  // Payment Hold State
  const [isPaymentHoldActive, setIsPaymentHoldActive] = useState(false);
  const [holdReason, setHoldReason] = useState('');
  const [holdAttachments, setHoldAttachments] = useState<any[]>([]);
  const [notifiedStakeholders, setNotifiedStakeholders] = useState<string[]>([]);
  const [expandedSections, setExpandedSections] = useState(["additional-details"]);

  useEffect(() => {
    setIsPaymentHoldActive(expandedSections.includes("hold"));
    setIsExceptionActive(expandedSections.includes("exception"));
  }, [expandedSections]);

  // Exception State
  const [isExceptionActive, setIsExceptionActive] = useState(false);
  const [exceptionType, setExceptionType] = useState('');
  const [exceptionDescription, setExceptionDescription] = useState('');
  const [exceptionAttachments, setExceptionAttachments] = useState<any[]>([]);
  const [invoiceAttachments, setInvoiceAttachments] = useState<any[]>([]);
  const [notifiedExceptionStakeholders, setNotifiedExceptionStakeholders] = useState<string[]>([]);

  const vendorData = useMemo(() => {
    // For standalone invoices, use the standalone vendor data
    if (invoiceType === 'standalone' && standaloneVendor) {
      return mockVendors.find(v => v.vendorCode === standaloneVendor.vendorCode) || null;
    }
    const firstPO = currentPOsData[0];
    if (!firstPO) return null;
    return mockVendors.find(v => v.vendorCode === firstPO.vendorCode) || null;
  }, [currentPOsData, standaloneVendor, invoiceType]);

  const currentVendorId = vendorData?.id || standaloneVendor?.vendorId || null;

  // Invoice Details State
  const generateInvoiceNumber = () => `INV-${Math.floor(100000 + Math.random() * 900000)}`;
  const [invoiceNumber, setInvoiceNumber] = useState(generateInvoiceNumber());
  const [vendorInvoiceNumber, setVendorInvoiceNumber] = useState('');
  const [invoiceDate, setInvoiceDate] = useState(new Date().toISOString().split('T')[0]);
  const [paymentTerms, setPaymentTerms] = useState('Net 30');
  const [apAccount, setApAccount] = useState(() => {
    const vendorCategory = standaloneVendor?.vendorCategory || vendorData?.category || '';
    return VENDOR_AP_MAPPING[vendorCategory] || VENDOR_AP_MAPPING['default'];
  });
  const [apConfigModalOpen, setApConfigModalOpen] = useState(false);
  const [apModalSearch, setApModalSearch] = useState('');
  const [description, setDescription] = useState('');
  const [standalonePostingDate, setStandalonePostingDate] = useState(new Date().toISOString().split('T')[0]);
  
  const vendorName = standaloneVendor?.vendorName || currentPOsData[0]?.vendorName || 'Global Logistics Partners';
  
  // PO-based tabs
  const uniquePONumbers = useMemo(() => {
    const pos = currentPOsData.map(po => po.poNumber);
    return Array.from(new Set(pos));
  }, [currentPOsData]);

  const [activePOTab, setActivePOTab] = useState<string>(uniquePONumbers[0] || '');

  // Group items
  const lineItems = useMemo(() => {
    const items: LineItem[] = [];
    currentPOsData.forEach(poData => {
      if (poData.isPreInvoice) {
        // For Pre-Invoices, poData.items is already filtered by the selection modal
        poData.items.forEach(item => {
          const remaining = item.quantity - (item.invoicedQty || 0);
          const invQty = item.customInvoiceQty !== undefined ? item.customInvoiceQty : remaining;
          items.push({
            id: `pre-${poData.poNumber}-${item.id}`,
            sku: item.sku,
            description: item.description,
            orderedQty: item.quantity,
            receivedQty: item.receivedQty || 0,
            invoiceQty: invQty,
            remainingQty: remaining,
            uom: item.uom,
            unitPrice: item.unitPrice,
            lineTotal: invQty * item.unitPrice,
            poNumber: poData.poNumber,
            grnNumbers: [],
            isPreInvoice: true,
            glAccount: item.glAccount || '1205 Advance Payments'
          });
        });
      } else {
        // For Standard Invoices, we must filter based on selectedGRNItemIds
        poData.relatedGRNs.forEach(grn => {
          grn.items.forEach(item => {
            // Only include if this specific item in this GRN was selected
            const isItemSelected = poData.selectedGRNItemIds?.includes(`${grn.grnNumber}:${item.id}`);
            if (!isItemSelected && poData.selectedGRNItemIds) return;

            const poItem = poData.items.find(si => si.sku === item.sku);
            if (!poItem) return;
            
            const remaining = item.quantity - (item.invoicedQty || 0);
            const invQty = poItem.customInvoiceQty !== undefined 
              ? poItem.customInvoiceQty 
              : remaining;

            items.push({
              id: `grn-${grn.grnNumber}-${item.id}`,
              sku: item.sku,
              description: item.description,
              orderedQty: poItem.quantity,
              receivedQty: item.quantity,
              invoiceQty: invQty,
              remainingQty: remaining,
              uom: item.uom,
              unitPrice: poItem.unitPrice || item.unitPrice,
              lineTotal: (poItem.unitPrice || item.unitPrice) * invQty,
              poNumber: poData.poNumber,
              grnNumbers: [grn.grnNumber],
              grnDate: grn.grnDate,
              isPreInvoice: false,
              glAccount: poItem.glAccount || '1200 Inventory'
            });
          });
        });
      }
    });
    return items;
  }, [currentPOsData]);

  const dueDate = useMemo(() => {
    // The logic for due date is the date of receiving document plus the payment terms.
    // If it is set to "Due on Receipt" (due on receiving), it should show the receiving date
    // rather than matching the vendor invoice date.
    
    let baseDate = invoiceDate;
    
    // Find all receiving dates from items that have them (standard invoices)
    const receivingDates = lineItems
      .filter(item => !item.isPreInvoice && item.grnDate)
      .map(item => item.grnDate as string);
      
    if (receivingDates.length > 0) {
      // Use the latest (max) receiving date among all selected items as the baseline
      baseDate = receivingDates.reduce((latest, current) => 
        new Date(current) > new Date(latest) ? current : latest
      , receivingDates[0]);
    }
    
    const date = new Date(baseDate);
    
    // If set to "Due on Receipt", the offset is 0
    if (paymentTerms === 'Due on Receipt') {
      return date.toISOString().split('T')[0];
    }
    
    const days = parseInt(paymentTerms.replace(/\D/g, '')) || 0;
    date.setDate(date.getDate() + days);
    return date.toISOString().split('T')[0];
  }, [invoiceDate, paymentTerms, lineItems]);

  // Compute posting date: latest receiving date from all selected receiving documents
  const postingDate = useMemo(() => {
    const receivingDates = lineItems
      .filter(item => !item.isPreInvoice && item.grnDate)
      .map(item => item.grnDate as string);
    
    if (receivingDates.length > 0) {
      return receivingDates.reduce((latest, current) =>
        new Date(current) > new Date(latest) ? current : latest
      , receivingDates[0]);
    }
    // Fallback to invoice date if no receiving dates available (Pre-Invoice scenario)
    return invoiceDate;
  }, [lineItems, invoiceDate]);

  // Find the GRN number associated with the posting date for display
  const postingDateGRN = useMemo(() => {
    if (!postingDate) return null;
    const matchingItem = lineItems.find(item => !item.isPreInvoice && item.grnDate === postingDate);
    return matchingItem?.grnNumbers?.[0] || null;
  }, [lineItems, postingDate]);

  // Format date for display (DD/MM/YYYY)
  const formatDateDisplay = (dateStr: string) => {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    const dd = String(d.getDate()).padStart(2, '0');
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const yyyy = d.getFullYear();
    return `${dd}/${mm}/${yyyy}`;
  };

  const hasReceivingDocs = lineItems.some(item => !item.isPreInvoice && item.grnDate);

  const updateLineItem = (id: string, field: string, value: any) => {
    setCurrentPOsData(prev => prev.map(po => {
      const newItems = po.items.map(item => {
        if (id.endsWith(item.id)) {
          const updatedItem = { ...item };
          if (field === 'invoiceQty') {
            const qty = parseFloat(value) || 0;
            updatedItem.customInvoiceQty = qty;
            // Also update price based on custom qty if available
            updatedItem.totalPrice = qty * (updatedItem.unitPrice || item.unitPrice);
          } else if (field === 'unitPrice') {
            const price = parseFloat(value) || 0;
            updatedItem.unitPrice = price;
            const currentQty = updatedItem.customInvoiceQty !== undefined ? updatedItem.customInvoiceQty : item.quantity;
            updatedItem.totalPrice = currentQty * price;
          } else if (field === 'glAccount') {
            updatedItem.glAccount = value;
          }
          return updatedItem;
        }
        return item;
      });

      return { ...po, items: newItems };
    }));
  };

  const currentPOItems = lineItems.filter(item => item.poNumber === activePOTab);
  const subtotal = isStandalone ? standaloneSubtotal : lineItems.reduce((sum, item) => sum + item.lineTotal, 0);
  const additionalChargesTotal = additionalCharges.reduce((sum, charge) => sum + charge.amount, 0);
  const total = subtotal + freightAmount + additionalChargesTotal;

  const activePOOriginalData = useMemo(() => {
    if (!activePOTab) return null;
    for (const vendor of mockVendors) {
      const po = vendor.purchaseOrders.find(p => p.poNumber === activePOTab);
      if (po) return po;
    }
    return null;
  }, [activePOTab]);

  const handleAddItemsFromPO = (selectedItems: MockLineItem[]) => {
    setCurrentPOsData(prev => prev.map(po => {
      if (po.poNumber === activePOTab) {
        const existingIds = new Set(po.items.map(i => i.id));
        const newItems = [...po.items];
        selectedItems.forEach(item => {
          if (!existingIds.has(item.id)) {
            newItems.push(item);
          }
        });
        return { ...po, items: newItems };
      }
      return po;
    }));
    setIsAddItemModalOpen(false);
    toast.success(`${selectedItems.length} items added to ${activePOTab}`);
  };

  const handleRemovePO = () => {
    if (!poToRemove) return;
    
    const nextPOs = currentPOsData.filter(po => po.poNumber !== poToRemove);
    setCurrentPOsData(nextPOs);
    
    if (activePOTab === poToRemove) {
      setActivePOTab(nextPOs[0]?.poNumber || '');
    }
    
    setPoToRemove(null);
    toast.success(`Purchase Order ${poToRemove} removed`);
  };

  const handleAddPOs = (newData: SelectedPOData[]) => {
    setCurrentPOsData(prev => {
      const mergedMap = new Map(prev.map(p => [p.poNumber, p]));
      newData.forEach(newPo => {
        const existing = mergedMap.get(newPo.poNumber);
        if (existing) {
          // Merge GRNs: add new GRNs that don't already exist
          const existingGRNNumbers = new Set(existing.relatedGRNs.map(g => g.grnNumber));
          const newGRNs = newPo.relatedGRNs.filter(g => !existingGRNNumbers.has(g.grnNumber));
          const mergedGRNs = [...existing.relatedGRNs, ...newGRNs];

          // Merge selectedGRNItemIds
          const existingGRNItemIds = new Set(existing.selectedGRNItemIds || []);
          const mergedGRNItemIds = [
            ...(existing.selectedGRNItemIds || []),
            ...(newPo.selectedGRNItemIds || []).filter(id => !existingGRNItemIds.has(id))
          ];

          // Merge items: add new items that don't already exist (by id)
          const existingItemIds = new Set(existing.items.map(i => i.id));
          const newItems = newPo.items.filter(i => !existingItemIds.has(i.id));
          const mergedItems = [...existing.items, ...newItems];

          // Merge selectedItemIds
          const existingSelectedIds = new Set(existing.selectedItemIds || []);
          const mergedSelectedItemIds = [
            ...(existing.selectedItemIds || []),
            ...(newPo.selectedItemIds || []).filter(id => !existingSelectedIds.has(id))
          ];

          mergedMap.set(newPo.poNumber, {
            ...existing,
            relatedGRNs: mergedGRNs,
            selectedGRNItemIds: mergedGRNItemIds,
            items: mergedItems,
            selectedItemIds: mergedSelectedItemIds,
            itemCount: mergedItems.length,
          });
        } else {
          mergedMap.set(newPo.poNumber, newPo);
        }
      });
      return Array.from(mergedMap.values());
    });
    setIsAddPOOpen(false);
    toast.success('Selection updated successfully');
  };

  const handleSubmit = () => {
    if (!onInvoicesCreated) return;

    const newInvoices: Invoice[] = [];
    const timestamp = Date.now();
    const vendorName = vendorData?.vendorName || standaloneVendor?.vendorName || 'Global Logistics Partners';
    const currentDate = new Date().toISOString().split('T')[0];

    // Standalone invoice submission
    if (isStandalone) {
      const standaloneInvoice: Invoice = {
        id: `inv-${timestamp}-sa`,
        invoiceNumber: vendorInvoiceNumber || invoiceNumber,
        vendorInvoiceNumber: vendorInvoiceNumber,
        vendor: vendorName,
        type: 'Standalone' as any,
        amount: total,
        outstandingBalance: total,
        currency: vendorData?.currency || standaloneVendor?.currency || 'USD',
        date: currentDate,
        invoiceDate: invoiceDate,
        createdDate: currentDate,
        dueDate: dueDate,
        status: 'Pending Approval',
        createdBy: 'Ahtisham Ahmad',
        apAccount: apAccount,
        description: description || `Standalone invoice for ${vendorName}`,
        linkedPOs: [],
        linkedGRNs: [],
        reference: vendorInvoiceNumber
      };
      newInvoices.push(standaloneInvoice);
      
      toast.success('Standalone invoice submitted', {
        description: `Invoice ${vendorInvoiceNumber || invoiceNumber} has been created for ${vendorName}.`
      });

      onInvoicesCreated(newInvoices);
      onClose();
      return;
    }
    
    // Check if we have pre-invoice items
    const preInvoiceItems = lineItems.filter(item => item.isPreInvoice);
    const standardInvoiceItems = lineItems.filter(item => !item.isPreInvoice);
    
    const hasPre = preInvoiceItems.length > 0;
    const hasStandard = standardInvoiceItems.length > 0;

    if (hasPre && hasStandard) {
      // Split scenario: One Pre-Invoice (Parent) and one Standard Invoice (Child)
      
      // 1. Parent Pre-Invoice (Matches full amount)
      const parentInvoice: Invoice = {
        id: `inv-${timestamp}-pre`,
        invoiceNumber: `${vendorInvoiceNumber}-PRE`,
        vendorInvoiceNumber: vendorInvoiceNumber,
        vendor: vendorName,
        type: 'Pre-Invoice',
        amount: total,
        outstandingBalance: total,
        currency: 'USD',
        date: currentDate,
        invoiceDate: currentDate,
        createdDate: currentDate,
        dueDate: dueDate,
        status: 'Pending Approval',
        createdBy: 'Current User',
        apAccount: apAccount,
        description: description || `Pre-Invoice for PO(s): ${uniquePONumbers.join(', ')}`,
        linkedPOs: uniquePONumbers,
        linkedGRNs: [],
        reference: uniquePONumbers[0]
      };
      newInvoices.push(parentInvoice);

      // 2. Child Standard Invoice (Offsetting for received items)
      // The amount here represents the goods already received
      const standardAmount = standardInvoiceItems.reduce((sum, item) => sum + item.lineTotal, 0);
      const childInvoice: Invoice = {
        id: `inv-${timestamp}-std`,
        invoiceNumber: `${vendorInvoiceNumber}-STD`,
        vendorInvoiceNumber: vendorInvoiceNumber,
        vendor: vendorName,
        type: 'Receiving-based',
        amount: standardAmount,
        outstandingBalance: standardAmount,
        currency: 'USD',
        date: currentDate,
        invoiceDate: currentDate,
        createdDate: currentDate,
        dueDate: dueDate,
        status: 'Pending Approval',
        createdBy: 'Current User',
        apAccount: apAccount,
        description: description || `Standard Invoice for received items from PO(s): ${uniquePONumbers.join(', ')}`,
        linkedPOs: uniquePONumbers,
        linkedGRNs: Array.from(new Set(standardInvoiceItems.flatMap(i => i.grnNumbers))),
        reference: uniquePONumbers[0]
      };
      newInvoices.push(childInvoice);
      
      toast.success('Invoices submitted successfully', {
        description: `Automated split: 1 Pre-Invoice and 1 Standard Invoice have been created.`
      });
    } else {
      // Single invoice scenario
      const finalType = hasPre ? 'Pre-Invoice' : 'PO-based';
      const singleInvoice: Invoice = {
        id: `inv-${timestamp}`,
        invoiceNumber: vendorInvoiceNumber,
        vendorInvoiceNumber: vendorInvoiceNumber,
        vendor: vendorName,
        type: finalType as any,
        amount: total,
        outstandingBalance: total,
        currency: 'USD',
        date: currentDate,
        invoiceDate: currentDate,
        createdDate: currentDate,
        dueDate: dueDate,
        status: 'Pending Approval',
        createdBy: 'Current User',
        apAccount: apAccount,
        description: description || `${finalType} for PO(s): ${uniquePONumbers.join(', ')}`,
        linkedPOs: uniquePONumbers,
        linkedGRNs: Array.from(new Set(lineItems.flatMap(i => i.grnNumbers))),
        reference: uniquePONumbers[0]
      };
      newInvoices.push(singleInvoice);
      
      toast.success('Invoice submitted successfully', {
        description: `Invoice ${vendorInvoiceNumber} has been created for ${vendorName}.`
      });
    }

    onInvoicesCreated(newInvoices);
    onClose();
  };

  const hasMixedInvoiceTypes = useMemo(() => {
    const hasPre = currentPOsData.some(po => po.isPreInvoice);
    const hasStandard = currentPOsData.some(po => !po.isPreInvoice);
    return hasPre && hasStandard;
  }, [currentPOsData]);

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-0 md:p-4 lg:p-6">
      <div className={`bg-white shadow-2xl w-full flex flex-col overflow-hidden transition-all duration-300 relative rounded-none md:rounded-lg ${isFullScreen ? 'h-full max-w-full m-0' : 'max-w-[1300px] h-[92vh]'}`}>
        
        {/* Sleek Header */}
        <div className="bg-white border-b border-gray-100 px-4 py-3 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <button onClick={onClose} className="p-1 hover:bg-gray-50 rounded-lg transition-colors cursor-pointer">
              <ArrowLeft className="w-4 h-4 text-gray-700" />
            </button>
            <div>
              <h1 className="text-[14px] font-bold text-gray-900 leading-none">{isStandalone ? 'Create Standalone Vendor Invoice' : 'Create Vendor Invoice from PO'}</h1>
              <p className="text-[10px] text-gray-400 font-medium mt-0.5 tracking-tight">{isStandalone ? 'Manual invoice entry for selected vendor' : 'Configure details for selection'}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => setIsFullScreen(!isFullScreen)} 
              className="h-7 px-2.5 text-[10px] font-bold border-gray-200 text-gray-700 gap-1.5 bg-white hover:bg-gray-50 shadow-sm rounded-md tracking-wider"
            >
              <Maximize2 className="w-3 h-3" />
              {isFullScreen ? 'Exit full' : 'Full view'}
            </Button>
            <div className="h-4 w-px bg-gray-200 mx-1" />
            <button onClick={onClose} className="p-1 hover:bg-gray-50 rounded-full transition-colors cursor-pointer text-gray-400">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Standalone: Manual Expense Entry Banner */}
        {isStandalone && (
          <div className="bg-[#F0F6FF] border-b border-blue-100 px-4 py-2.5 flex items-center gap-2.5 shrink-0">
            <div className="w-6 h-6 rounded-full bg-white flex items-center justify-center shrink-0 border border-blue-200 shadow-sm">
              <Info className="w-3 h-3 text-blue-500" />
            </div>
            <div className="flex-1 flex items-center gap-2">
              <h4 className="text-[12px] font-bold text-gray-900 whitespace-nowrap">Manual Expense Entry</h4>
              <p className="text-[12px] text-gray-500 font-medium leading-none">
                This is a standalone invoice. Each line item debits an expense GL account. Please add line items manually below.
              </p>
            </div>
          </div>
        )}

        {/* Automated Splitting Alert - Fixed Banner */}
        {!isStandalone && hasMixedInvoiceTypes && (
          <div className="bg-[#F8FAFF] border-b border-blue-50 px-4 py-2 flex items-center gap-2.5 shrink-0 shadow-[0_1px_2_rgba(0,0,0,0.01)]">
            <div className="w-6 h-6 rounded-full bg-white flex items-center justify-center shrink-0 border border-blue-100 shadow-sm">
              <Info className="w-3 h-3 text-blue-500" />
            </div>
            <div className="flex-1 flex items-center gap-2">
              <h4 className="text-[12px] font-bold text-gray-900 whitespace-nowrap">Automated invoice splitting</h4>
              <p className="text-[12px] text-gray-500 font-medium leading-none">
                Mixed document status detected. System will automatically generate separate <span className="text-amber-600 font-bold">Pre-invoice</span> and <span className="text-emerald-600 font-bold">Invoice</span> records upon posting.
              </p>
            </div>
          </div>
        )}

        <div className="flex flex-1 overflow-hidden">
          
          {/* LEFT SECTION (70%) */}
          <div className="w-[70%] flex flex-col overflow-hidden bg-white border-r border-gray-100">
            <div className="flex-1 overflow-y-auto px-4 py-3 custom-scrollbar space-y-4">
              
              {/* PO Tabs - Compressed with Removal and Addition (hidden for standalone) */}
              {!isStandalone && <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-hide items-center">
                {uniquePONumbers.map(po => {
                  const poData = currentPOsData.find(p => p.poNumber === po);
                  const itemsForThisPO = lineItems.filter(li => li.poNumber === po);
                  return (
                    <HoverCard key={po} openDelay={200}>
                      <HoverCardTrigger asChild>
                        <div 
                          className={`group flex items-center gap-1.5 px-3 py-1.5 rounded-lg border transition-all whitespace-nowrap cursor-pointer ${
                            activePOTab === po 
                              ? 'bg-gray-900 text-white border-gray-900 shadow-sm' 
                              : 'bg-white text-gray-400 border-gray-100 hover:border-gray-200 shadow-sm'
                          }`}
                        >
                          <button 
                            onClick={() => setActivePOTab(po)}
                            className="flex items-center gap-1.5 text-[10px] font-bold tracking-wider"
                          >
                            <ShoppingCart className="w-3 h-3" />
                            {po}
                          </button>
                          <button 
                            onClick={(e) => {
                              e.stopPropagation();
                              setPoToRemove(po);
                            }}
                            className={`p-0.5 rounded-full hover:bg-white/20 transition-colors ${activePOTab === po ? 'text-white/60 hover:text-white' : 'text-gray-300 hover:text-gray-600'}`}
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      </HoverCardTrigger>
                      <HoverCardContent className="w-80 p-0 overflow-hidden rounded-xl border-gray-200 shadow-xl z-[70]" align="start">
                        <div className="bg-gray-900 px-4 py-3">
                          <div className="flex justify-between items-center mb-1">
                            <span className="text-[10px] font-black text-white/50 tracking-widest uppercase">PO validation details</span>
                          <span className={`px-1.5 py-0.5 rounded text-[8px] font-bold tracking-tighter ${
                                poData?.isPreInvoice ? 'bg-amber-500/20 text-amber-300' : 'bg-emerald-500/20 text-emerald-300'
                              }`}>
                                {poData?.isPreInvoice ? 'Pre-invoice' : 'Invoice'}
                              </span>
                          </div>
                          <h4 className="text-white font-bold text-sm leading-none flex items-center gap-2">
                            {po}
                            <div className="w-1 h-1 rounded-full bg-white/20" />
                            <span className="text-[11px] text-white/40 font-medium tracking-tight">Issued {poData?.poDate}</span>
                          </h4>
                        </div>
                        <div className="p-3 space-y-3 bg-white">
                          <div className="space-y-2">
                            <div className="flex items-center justify-between">
                              <p className="text-[9px] font-bold text-gray-400 tracking-widest uppercase">Billed items ({itemsForThisPO.length})</p>
                              <div className={`flex items-center gap-1 text-[11px] font-bold ${poData?.isPreInvoice ? 'text-amber-600' : 'text-emerald-600'}`}>
                                <div className={`w-1 h-1 rounded-full ${poData?.isPreInvoice ? 'bg-amber-500' : 'bg-emerald-500'}`} />
                                {poData?.isPreInvoice ? '2-way match' : '3-way match'}
                              </div>
                            </div>
                            <div className="space-y-1 max-h-[220px] overflow-y-auto pr-1 custom-scrollbar">
                              {itemsForThisPO.map((item, idx) => (
                                <div key={idx} className="flex items-center justify-between py-1.5 border-b border-gray-50 last:border-0">
                                  <div className="flex flex-col gap-0.5">
                                    <span className="text-[10px] font-bold text-gray-700 leading-tight">{item.description}</span>
                                    <div className="flex items-center gap-1.5">
                                      <span className="text-[8px] text-gray-400 font-medium tracking-wider bg-gray-50 px-1 rounded uppercase">{item.sku}</span>
                                      <span className="text-[8px] text-gray-400 font-medium">{item.uom}</span>
                                    </div>
                                  </div>
                                  <div className="text-right">
                                    <span className="text-[10px] font-black text-gray-900">{item.invoiceQty} units</span>
                                    <p className="text-[8px] text-gray-400 font-bold tracking-tight">${item.unitPrice.toLocaleString()}/unit</p>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                          <div className="pt-2 border-t border-gray-100 flex items-center justify-between">
                             <div className="flex items-center gap-2">
                               <div className="w-6 h-6 rounded-lg bg-blue-50 flex items-center justify-center border border-blue-100 shadow-sm">
                                  <Wallet className="w-3 h-3 text-blue-600" />
                               </div>
                               <div>
                                  <p className="text-[8px] font-bold text-gray-400 leading-none uppercase tracking-tighter">Line items total</p>
                                  <p className="text-[13px] font-black text-gray-900 mt-0.5 tracking-tight">${itemsForThisPO.reduce((sum, i) => sum + i.lineTotal, 0).toLocaleString()}</p>
                               </div>
                             </div>
                             <div className="text-right bg-gray-50 px-2 py-1 rounded border border-gray-100">
                               <p className="text-[8px] font-bold text-gray-400 leading-none uppercase">CCY</p>
                               <p className="text-[10px] font-black text-gray-900 mt-0.5">{poData?.currency}</p>
                             </div>
                          </div>
                        </div>
                      </HoverCardContent>
                    </HoverCard>
                  );
                })}
                
                <button 
                  onClick={() => setIsAddPOOpen(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-blue-200 bg-blue-50 text-blue-600 hover:bg-blue-100 hover:border-blue-300 transition-all text-[10px] font-bold tracking-wider cursor-pointer shadow-sm group"
                >
                  <Plus className="w-3.5 h-3.5 group-hover:scale-110 transition-transform" />
                  Add more
                </button>
              </div>}

              {/* Standalone Vendor Badge */}
              {isStandalone && vendorData && (
                <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl border border-purple-100 bg-purple-50/30">
                  <div className="w-9 h-9 rounded-xl overflow-hidden border border-purple-200 bg-white flex items-center justify-center shrink-0">
                    {vendorData.imageUrl ? (
                      <ImageWithFallback src={vendorData.imageUrl} alt={vendorData.vendorName} className="w-full h-full object-cover" />
                    ) : (
                      <Building2 className="w-4 h-4 text-purple-400" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-[12px] font-bold text-gray-900 truncate">{vendorData.vendorName}</span>
                      <span className="text-[9px] font-semibold text-gray-400 px-1.5 py-0.5 rounded bg-white border border-gray-100">{vendorData.vendorCode}</span>
                    </div>
                    <div className="flex items-center gap-3 mt-0.5 text-[10px] text-gray-400">
                      <span className="font-medium">{vendorData.category}</span>
                      <span className="font-medium">{vendorData.currency}</span>
                      <span className="font-medium">{vendorData.paymentTerms}</span>
                    </div>
                  </div>
                  <span className="text-[9px] font-bold text-purple-600 bg-purple-100 px-2 py-0.5 rounded-full uppercase tracking-wider shrink-0">Standalone</span>
                </div>
              )}

              {/* Invoice Details Section */}
              <section className="space-y-3">
                <div className="p-3.5 bg-white rounded-xl border border-gray-100 shadow-sm space-y-3">
                  <div className="flex items-center justify-between w-full">
                    <div className="flex items-center gap-2.5">
                      <h2 className="text-[14px] font-bold text-gray-900 tracking-tight">Invoice details</h2>
                      
                      {/* Vendor Pill - View Only with Hover Card */}
                      {vendorData && (
                        <HoverCard openDelay={200}>
                          <HoverCardTrigger asChild>
                            <div className="flex items-center gap-2 px-2 py-0.5 bg-gray-50 border border-gray-100 rounded-full shadow-sm cursor-help hover:bg-white transition-colors">
                              <div className="w-4 h-4 rounded-full overflow-hidden border border-white bg-white">
                                <ImageWithFallback 
                                  src={vendorData.imageUrl || ''} 
                                  alt={vendorData.vendorName}
                                  className="w-full h-full object-cover"
                                />
                              </div>
                              <span className="text-[10px] font-bold text-gray-600 max-w-[120px] truncate">{vendorData.vendorName}</span>
                            </div>
                          </HoverCardTrigger>
                          <HoverCardContent className="w-72 p-0 overflow-hidden z-[100] border-none shadow-2xl" side="bottom" align="start">
                            <div className="bg-[#0F172A] p-4 flex items-center gap-3">
                              <div className="w-12 h-12 rounded-xl overflow-hidden border-2 border-white/20 shadow-lg shrink-0">
                                <ImageWithFallback 
                                  src={vendorData.imageUrl || ''} 
                                  alt={vendorData.vendorName}
                                  className="w-full h-full object-cover"
                                />
                              </div>
                              <div className="overflow-hidden">
                                <h3 className="text-[13px] font-bold text-white truncate leading-tight">{vendorData.vendorName}</h3>
                                <p className="text-[10px] font-medium text-blue-300 tracking-wider mt-1">{vendorData.vendorCode}</p>
                              </div>
                            </div>
                            <div className="p-4 space-y-3 bg-white">
                              <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1">
                                  <Label className="text-[9px] font-black text-gray-400 uppercase tracking-[0.05em] flex items-center gap-1.5">
                                    <Package className="w-2.5 h-2.5" />
                                    Category
                                  </Label>
                                  <p className="text-[11px] font-bold text-gray-700">{vendorData.category}</p>
                                </div>
                                <div className="space-y-1">
                                  <Label className="text-[9px] font-black text-gray-400 uppercase tracking-[0.05em] flex items-center gap-1.5">
                                    <Truck className="w-2.5 h-2.5" />
                                    Type
                                  </Label>
                                  <p className="text-[11px] font-bold text-gray-700">{vendorData.type}</p>
                                </div>
                              </div>
                              
                              <div className="pt-3 border-t border-gray-50 grid grid-cols-2 gap-4">
                                <div className="space-y-1">
                                  <Label className="text-[9px] font-black text-gray-400 uppercase tracking-[0.05em] flex items-center gap-1.5">
                                    <Wallet className="w-2.5 h-2.5" />
                                    Terms
                                  </Label>
                                  <p className="text-[11px] font-bold text-gray-700">{vendorData.paymentTerms}</p>
                                </div>
                                <div className="space-y-1">
                                  <Label className="text-[9px] font-black text-gray-400 uppercase tracking-[0.05em] flex items-center gap-1.5">
                                    <DollarSign className="w-2.5 h-2.5" />
                                    Currency
                                  </Label>
                                  <p className="text-[11px] font-bold text-gray-700">{vendorData.currency}</p>
                                </div>
                              </div>
                              
                              <div className="pt-2">
                                <div className="px-2.5 py-2 bg-blue-50/50 rounded-lg flex items-center justify-between border border-blue-100/50">
                                  <div className="flex items-center gap-2">
                                    <div className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
                                    <span className="text-[10px] font-bold text-blue-600">Active Account</span>
                                  </div>
                                  <span className="text-[10px] font-black text-blue-700">2100-AP-VEND</span>
                                </div>
                              </div>
                            </div>
                          </HoverCardContent>
                        </HoverCard>
                      )}
                    </div>

                    {!isStandalone && currentPOsData.find(p => p.poNumber === activePOTab)?.isPreInvoice && (
                      <span className="px-1.5 py-0.5 rounded text-[9px] font-bold tracking-tight bg-amber-50 text-amber-600 border border-amber-100 uppercase">
                        Pre-invoice
                      </span>
                    )}
                  </div>
                  
                  {/* Row 1: Vendor Invoice Number & Vendor Invoice Date */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <Label className="text-[11px] text-gray-500 tracking-wide uppercase font-medium">Vendor invoice number <span className="text-red-400">*</span></Label>
                      <Input 
                        value={vendorInvoiceNumber}
                        onChange={(e) => setVendorInvoiceNumber(e.target.value)}
                        placeholder="e.g. VEN-98231"
                        className="h-[34px] bg-white border-gray-200 text-[12px] font-medium focus:ring-1 focus:ring-blue-200 focus:border-blue-300 shadow-none rounded-md" 
                      />
                      <p className="text-[10px] text-gray-400 leading-tight px-0.5">Vendor's reference document number.</p>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-[11px] text-gray-500 tracking-wide uppercase font-medium">Vendor invoice date <span className="text-red-400">*</span></Label>
                      <Input 
                        type="date" 
                        value={invoiceDate}
                        onChange={(e) => setInvoiceDate(e.target.value)}
                        className="h-[34px] bg-white border-gray-200 text-[12px] font-medium focus:ring-1 focus:ring-blue-200 focus:border-blue-300 shadow-none rounded-md" 
                      />
                      <p className="text-[10px] text-gray-400 leading-tight px-0.5">Document date from the vendor invoice.</p>
                    </div>
                  </div>

                  {/* Row 2: Posting Date & Description */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <Label className="text-[11px] text-gray-500 tracking-wide uppercase font-medium flex items-center gap-1.5">
                        Posting date
                        {!isStandalone && <Lock className="w-3 h-3 text-gray-300" />}
                      </Label>
                      {isStandalone ? (
                        <Input 
                          type="date"
                          value={standalonePostingDate}
                          onChange={(e) => setStandalonePostingDate(e.target.value)}
                          className="h-[34px] bg-white border-gray-200 text-[12px] font-medium focus:ring-1 focus:ring-blue-200 focus:border-blue-300 shadow-none rounded-md" 
                        />
                      ) : (
                        <Input 
                          type="text"
                          value={formatDateDisplay(postingDate)}
                          readOnly
                          disabled
                          className="h-[34px] bg-gray-50 border-gray-200 text-[12px] font-medium text-gray-500 cursor-not-allowed shadow-none rounded-md" 
                        />
                      )}
                      <p className="text-[10px] text-gray-400 leading-tight px-0.5">{isStandalone ? 'Select the GL posting date' : 'Based on receiving date'}</p>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-[11px] text-gray-500 tracking-wide uppercase font-medium">Description</Label>
                      <div className="relative">
                        <Input 
                          value={description}
                          onChange={(e) => {
                            const maxLen = isStandalone ? 80 : 150;
                            if (e.target.value.length <= maxLen) setDescription(e.target.value);
                          }}
                          placeholder="Brief summary of invoice purpose or context." 
                          className="h-[34px] bg-white border-gray-200 font-medium focus:ring-1 focus:ring-blue-200 focus:border-blue-300 shadow-none rounded-md text-[12px] text-gray-700 pr-14"
                        />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-gray-300 font-medium pointer-events-none">{description.length}/{isStandalone ? 80 : 150}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </section>

              {/* Standalone Line Items - Simplified Table */}
              {isStandalone && (
                <section className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <h2 className="text-[14px] font-bold text-gray-900 tracking-tight">Invoice line items</h2>
                      <div className="flex items-center gap-1 px-2 py-0.5 bg-gray-100 text-gray-600 border border-gray-200 rounded-md text-[10px] font-bold tracking-tight">
                        {standaloneItems.length} line items
                      </div>
                      <span className="px-2 py-0.5 rounded border text-[10px] font-bold tracking-tight bg-blue-50 border-blue-100 text-blue-700">Manual entry</span>
                    </div>
                  </div>

                  <div className="border border-gray-100 rounded-xl shadow-sm bg-white overflow-x-auto relative">
                    <table className="w-full text-left border-collapse min-w-[650px]">
                      <thead className="bg-[#F8F9FA] border-b border-gray-100 text-[9px] font-bold text-gray-400 uppercase tracking-widest">
                        <tr>
                          <th className="px-3 py-2.5 w-[44px] text-center">#</th>
                          <th className="px-3 py-2.5 w-[220px]">GL Account</th>
                          <th className="px-3 py-2.5">Description</th>
                          <th className="px-3 py-2.5 w-[120px] text-center">Amount</th>
                          <th className="px-3 py-2.5 w-12 text-center"></th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-50">
                        {standaloneItems.map((item, index) => (
                          <tr key={item.id} className="hover:bg-gray-50/50 transition-colors group">
                            <td className="px-3 py-2 text-center">
                              <span className="text-[11px] font-bold text-blue-600">{index + 1}</span>
                            </td>
                            {/* GL Account (Debit) - Read-only display + configure button */}
                            <td className="px-3 py-1.5">
                              <div className="flex items-center gap-1.5">
                                <div className="flex-1 min-w-0 h-[30px] flex items-center px-2 bg-gray-50 rounded-md border border-gray-100">
                                  {item.glAccount ? (
                                    <span className="truncate text-[10px] font-bold text-gray-700">{item.glAccount}</span>
                                  ) : (
                                    <span className="truncate text-[10px] font-medium text-gray-400 italic">No account</span>
                                  )}
                                </div>
                                <button
                                  onClick={() => { setGlConfigModalItemId(item.id); setGlModalSearch(''); }}
                                  className="shrink-0 h-[30px] w-[30px] flex items-center justify-center rounded-md border border-gray-200 bg-white hover:bg-blue-50 hover:border-blue-200 text-gray-400 hover:text-blue-600 transition-colors"
                                  title="GL Configuration"
                                >
                                  <Settings2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </td>
                            {/* Description */}
                            <td className="px-3 py-1.5">
                              <Input 
                                value={item.description}
                                onChange={(e) => updateStandaloneItem(item.id, 'description', e.target.value)}
                                placeholder="Enter description..."
                                className="h-[30px] bg-white border-gray-200 text-[11px] font-medium shadow-none rounded-md focus-visible:ring-1 focus-visible:ring-blue-100"
                              />
                            </td>
                            {/* Amount */}
                            <td className="px-3 py-1.5">
                              <Input 
                                type="number"
                                value={item.amount || ''}
                                onChange={(e) => updateStandaloneItem(item.id, 'amount', Number(e.target.value))}
                                placeholder="0.00"
                                className="h-[30px] text-center font-bold text-[11px] bg-white border-gray-200 shadow-none rounded-md [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none focus-visible:ring-1 focus-visible:ring-blue-100"
                              />
                            </td>
                            {/* Delete */}
                            <td className="px-3 py-1.5 text-center">
                              <button 
                                onClick={() => removeStandaloneItem(item.id)}
                                className="p-1 hover:bg-red-50 text-gray-300 hover:text-red-500 rounded-md transition-colors disabled:opacity-30"
                                disabled={standaloneItems.length <= 1}
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Add lines / Clear all / Total row */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <button 
                        onClick={addStandaloneItem}
                        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border border-gray-200 text-[10px] font-bold text-blue-600 hover:bg-blue-50 hover:border-blue-200 transition-all tracking-wider"
                      >
                        <Plus className="w-3 h-3" />
                        Add lines
                      </button>
                      <button 
                        onClick={clearAllStandaloneItems}
                        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border border-gray-200 text-[10px] font-bold text-gray-500 hover:bg-gray-50 hover:text-gray-700 transition-all tracking-wider"
                      >
                        <X className="w-3 h-3" />
                        Clear all lines
                      </button>
                    </div>
                    <div className="text-right flex items-center gap-3">
                      <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Total</span>
                      <span className="text-[18px] font-bold text-gray-900 leading-none">${standaloneSubtotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                    </div>
                  </div>
                </section>
              )}

              {/* PO-based Invoice Line Items */}
              {!isStandalone && <section className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <h2 className="text-[14px] font-bold text-gray-900 tracking-tight">Invoice line items</h2>
                    <div className="flex items-center gap-1 px-2 py-0.5 bg-gray-100 text-gray-600 border border-gray-200 rounded-md text-[10px] font-bold tracking-tight">
                      {currentPOItems.length} line items
                    </div>
                    {(() => {
                      const activePO = currentPOsData.find(p => p.poNumber === activePOTab);
                      const isPre = activePO?.isPreInvoice;
                      const hasIssue = !isPre && currentPOItems.some(item => item.invoiceQty > item.receivedQty);
                      
                      const statusColor = hasIssue 
                        ? 'bg-red-50 border-red-100 text-red-700' 
                        : isPre 
                          ? 'bg-amber-50 border-amber-100 text-amber-700' 
                          : 'bg-emerald-50 border-emerald-100 text-emerald-700';
                      
                      const dotColor = hasIssue ? 'bg-red-500' : isPre ? 'bg-amber-500' : 'bg-emerald-500';
                      const label = hasIssue ? '3-way match issue' : isPre ? '2-way match (Pre-invoice)' : '3-way match (Invoice)';
                      const icon = hasIssue ? <AlertTriangle className="w-3 h-3 text-red-400 cursor-help" /> : <Info className="w-3 h-3 text-gray-400 cursor-help" />;

                      return (
                        <div className={`flex items-center gap-2 px-2 py-0.5 rounded border shadow-sm ${statusColor}`}>
                          <div className={`w-1 h-1 rounded-full ${dotColor}`} />
                          <span className="text-[11px] font-bold tracking-tight">
                            {label}
                          </span>
                          <HoverCard openDelay={100}>
                            <HoverCardTrigger asChild>
                              {icon}
                            </HoverCardTrigger>
                            <HoverCardContent className="w-64 p-3 z-[100]" side="top">
                              <div className="space-y-1.5">
                                <p className="text-[10px] font-bold text-gray-900">
                                  {hasIssue ? 'Matching discrepancy' : isPre ? '2-way match logic' : '3-way match logic'}
                                </p>
                                <p className="text-[9px] text-gray-500 font-medium leading-relaxed">
                                  {hasIssue 
                                    ? 'Invoice quantity exceeds warehouse received quantity (GRN). Requires manual review or adjustment before posting.' 
                                    : isPre 
                                      ? 'Matching vendor invoice against purchase order values. Used for pre-invoicing before goods receipt.' 
                                      : 'Quantities and pricing validated against warehouse receiving documents (GRNs).'}
                                </p>
                              </div>
                            </HoverCardContent>
                          </HoverCard>
                        </div>
                      );
                    })()}
                  </div>
                  <div className="flex items-center gap-2">
                    {selectedIds.size > 1 ? (
                      <Button 
                        variant="destructive" 
                        size="sm" 
                        onClick={() => {
                          const previousData = JSON.parse(JSON.stringify(currentPOsData));
                          const count = selectedIds.size;
                          const idsToRemove = new Set(selectedIds);
                          
                          setCurrentPOsData(prev => prev.map(po => {
                            if (po.poNumber === activePOTab) {
                              return {
                                ...po,
                                items: po.items.filter(pItem => {
                                  const isSelected = Array.from(idsToRemove).some(selectedId => selectedId.endsWith(pItem.id));
                                  return !isSelected;
                                })
                              };
                            }
                            return po;
                          }));
                          
                          setSelectedIds(new Set());
                          
                          toast(`${count} items have been removed from PO ${activePOTab}`, {
                            description: "This action can be undone within 30 seconds.",
                            action: {
                              label: "Undo (30s)",
                              onClick: () => {
                                setCurrentPOsData(previousData);
                                setSelectedIds(idsToRemove);
                              },
                            },
                            duration: 30000,
                          });
                        }}
                        className="h-7 px-2.5 text-[10px] font-bold bg-red-50 text-red-600 border-red-100 hover:bg-red-600 hover:text-white shadow-none rounded-md tracking-wider gap-1.5 border transition-all animate-in fade-in slide-in-from-right-1"
                      >
                        <Trash2 className="w-3 h-3" />
                        Remove {selectedIds.size} items
                      </Button>
                    ) : (
                      <Button 
                        variant="outline" 
                        size="sm" 
                        onClick={() => setIsAddPOOpen(true)}
                        className="h-7 px-2.5 text-[10px] font-bold border-gray-200 text-gray-700 bg-white hover:bg-gray-50 shadow-none rounded-md tracking-wider gap-1.5"
                      >
                        <Plus className="w-3 h-3" />
                        Add more items
                      </Button>
                    )}
                  </div>
                </div>

                {/* PO line items table */}
                                <div className="border border-gray-100 rounded-xl shadow-sm bg-white overflow-x-auto relative">
                  <table className="w-full text-left border-collapse min-w-[1000px]">
                    <thead className="bg-[#F8F9FA] border-b border-gray-100 text-[9px] font-bold text-gray-400 uppercase tracking-widest">
                      <tr>
                        <th className="px-3 py-2.5 w-12 text-center sticky left-0 bg-[#F8F9FA] border-r border-gray-50 z-20 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.05)]">
                           <Checkbox 
                             checked={currentPOItems.length > 0 && selectedIds.size === currentPOItems.length}
                             onCheckedChange={() => {
                               if (selectedIds.size === currentPOItems.length) {
                                 setSelectedIds(new Set());
                               } else {
                                 setSelectedIds(new Set(currentPOItems.map(i => i.id)));
                                }
                             }}
                             className="rounded border-gray-200"
                           />
                        </th>
                        <th className="px-3 py-2.5 w-[180px]">Item / SKU</th>
                        <th className="px-2 py-2.5 w-[80px] text-center">Ordered qty</th>
                        <th className="px-2 py-2.5 w-[100px] text-center">Received qty</th>
                        <th className="px-2 py-2.5 w-[110px] text-center">Unit price</th>
                        <th className="px-2 py-2.5 w-[110px] text-center text-emerald-600">Invoice quantity</th>
                        <th className="px-3 py-2.5 w-[140px]">GL account</th>
                        <th className="px-3 py-2.5 w-[110px] text-right">Total amount</th>
                        {selectedIds.size <= 1 && (
                          <th className="px-3 py-2.5 w-14 text-center sticky right-0 bg-[#F8F9FA] border-l border-gray-50 shadow-[-4px_0_8px_-4px_rgba(0,0,0,0.05)] z-20">Action</th>
                        )}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {currentPOItems.map(item => {
                        const isOverBilled = item.invoiceQty > item.remainingQty;
                        const lineTotal = item.invoiceQty * item.unitPrice;
                        const isSelected = selectedIds.has(item.id);
                        
                        return (
                          <tr key={item.id} className={`hover:bg-gray-50/50 transition-colors group ${isSelected ? 'bg-blue-50/40' : ''}`}>
                            <td className={`px-3 py-1.5 text-center sticky left-0 z-10 border-r border-gray-50 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.05)] transition-colors ${isSelected ? 'bg-blue-50' : 'bg-white group-hover:bg-gray-50/50'}`}>
                              <Checkbox 
                                checked={isSelected}
                                onCheckedChange={() => {
                                  const next = new Set(selectedIds);
                                  if (next.has(item.id)) next.delete(item.id);
                                  else next.add(item.id);
                                  setSelectedIds(next);
                                }}
                                className="rounded border-gray-200"
                              />
                            </td>
                            <td className="px-3 py-1.5">
                              <div className="flex items-center gap-2">
                                <div className="w-7 h-7 rounded-md overflow-hidden border border-gray-100 shrink-0 bg-gray-50">
                                  <ImageWithFallback 
                                    src={`https://images.unsplash.com/photo-1581091226825-a6a2a5aee158?auto=format&fit=crop&q=80&w=80&h=80`} 
                                    alt={item.sku}
                                    className="w-full h-full object-cover"
                                  />
                                </div>
                                <div className="min-w-0">
                                  <div className="font-bold text-gray-900 leading-tight uppercase tracking-tight truncate text-[10px]">{item.sku}</div>
                                  <div className="text-gray-400 font-medium mt-0.5 leading-tight truncate text-[9px]">{item.description}</div>
                                </div>
                              </div>
                            </td>
                            <td className="px-2 py-1.5 text-center">
                              <div className="font-bold text-gray-900 tracking-tighter text-[10px]">{item.orderedQty} {item.uom}</div>
                            </td>
                            <td className="px-2 py-1.5 text-center">
                              <div className="flex items-center justify-center gap-1.5">
                                <span className="text-[10px] font-bold text-gray-900">{item.receivedQty} {item.uom}</span>
                                <span className="text-[9px] font-medium text-gray-400">(${(item.receivedQty * item.unitPrice).toLocaleString(undefined, { minimumFractionDigits: 2 })})</span>
                              </div>
                            </td>
                            <td className="px-2 py-1.5">
                              <div className="flex items-center justify-center gap-1.5">
                                <div className="relative w-20">
                                  <span className="absolute left-1.5 top-1/2 -translate-y-1/2 text-[9px] font-bold text-gray-400">$</span>
                                  <Input 
                                    type="number" 
                                    value={item.unitPrice} 
                                    onChange={(e) => updateLineItem(item.id, 'unitPrice', e.target.value)}
                                    className="h-7 pl-4 pr-1 text-right font-bold text-[10px] border-gray-200 shadow-none rounded-md [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none focus-visible:ring-1 focus-visible:ring-blue-100"
                                  />
                                </div>
                                <span className="text-[8px] font-bold text-gray-400 uppercase tracking-widest whitespace-nowrap">/ {item.uom}</span>
                              </div>
                            </td>
                            <td className="px-2 py-1.5">
                              <div className="flex flex-col items-center justify-center gap-1">
                                <div className="flex items-center gap-1 w-24">
                                  <Input 
                                    type="number" 
                                    value={item.invoiceQty} 
                                    onChange={(e) => updateLineItem(item.id, 'invoiceQty', e.target.value)}
                                    className={`h-7 text-center font-bold text-[10px] shadow-none rounded-md [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none focus-visible:ring-1 ${
                                      isOverBilled ? 'bg-red-50 border-red-300 text-red-600 focus-visible:ring-red-100' : 'text-emerald-700 bg-emerald-50/50 border-emerald-100 focus-visible:ring-emerald-100'
                                    }`}
                                  />
                                  <span className="text-[8px] font-bold text-gray-400 uppercase tracking-widest shrink-0">{item.uom}</span>
                                </div>
                                {isOverBilled && (
                                  <div className="flex items-center gap-1 text-[8px] font-black text-red-500 animate-in fade-in slide-in-from-top-1">
                                    <AlertTriangle className="w-2.5 h-2.5" />
                                    <span>Exceeds remaining ({item.remainingQty})</span>
                                  </div>
                                )}
                              </div>
                            </td>
                            <td className="px-3 py-1.5">
                              <button 
                                onClick={() => { setPoGlConfigModalItemId(item.id); setPoGlModalSearch(''); }}
                                className="flex items-center justify-between w-full px-2 py-1 bg-gray-50 hover:bg-white hover:border-blue-200 text-gray-600 rounded border border-gray-100 uppercase tracking-tight transition-colors group/gl"
                              >
                                <span className="truncate mr-1 text-[10px] font-bold">{item.glAccount || 'Select GL...'}</span>
                                <Settings2 className="w-2.5 h-2.5 text-gray-300 group-hover/gl:text-blue-500 shrink-0" />
                              </button>
                            </td>
                            <td className="px-3 py-1.5">
                              <div className="text-right font-bold text-[11px] text-gray-900 pr-0.5">
                                ${lineTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                              </div>
                            </td>
                            {selectedIds.size <= 1 && (
                              <td className="px-3 py-1.5 text-center sticky right-0 z-10 border-l border-gray-50 shadow-[-4px_0_8px_-4px_rgba(0,0,0,0.05)] transition-colors bg-white group-hover:bg-gray-50/50">
                                <div className="flex items-center justify-center">
                                  <button 
                                    onClick={() => {
                                      const previousData = JSON.parse(JSON.stringify(currentPOsData));
                                      setCurrentPOsData(prev => prev.map(po => {
                                        if (po.poNumber !== item.poNumber) return po;
                                        
                                        // Filter items, selectedItemIds, and selectedGRNItemIds to ensure full removal
                                        const originalItemId = item.id.split('-').pop();
                                        return {
                                          ...po,
                                          items: po.items.filter(pItem => !item.id.endsWith(pItem.id)),
                                          selectedItemIds: po.selectedItemIds.filter(id => id !== originalItemId),
                                          selectedGRNItemIds: po.selectedGRNItemIds?.filter(id => id !== `${item.grnNumbers[0]}:${originalItemId}`)
                                        };
                                      }));
                                      
                                      toast(`Item ${item.sku} has been removed from Invoice ${invoiceNumber}`, {
                                        description: "This action can be undone within 30 seconds.",
                                        action: {
                                          label: "Undo (30s)",
                                          onClick: () => setCurrentPOsData(previousData),
                                        },
                                        cancel: {
                                          label: "Close",
                                          onClick: () => console.log("Toast closed"),
                                        },
                                        duration: 30000,
                                      });
                                    }}
                                    className="p-1 hover:bg-red-50 text-gray-300 hover:text-red-500 rounded-md transition-colors"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </td>
                            )}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </section>}

              <div className="h-6" />
            </div>
          </div>

          {/* RIGHT SECTION (30%) */}
          <div className="w-[30%] bg-[#F8FAFC] flex flex-col overflow-hidden">
            <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
              {/* Multi-Section Accordion Review */}
              <Accordion 
                type="multiple" 
                value={expandedSections} 
                onValueChange={setExpandedSections}
                className="space-y-2.5"
              >
                
                {/* Section 1: General information */}
                <AccordionItem value="additional-details" className="border border-gray-200 rounded-xl bg-white px-4 shadow-sm overflow-hidden">
                  <AccordionTrigger className="hover:no-underline py-3 group">
                    <div className="flex items-center gap-2.5">
                      <div className="w-6 h-6 rounded-lg bg-blue-50 flex items-center justify-center group-hover:bg-blue-100 transition-colors">
                        <LayoutGrid className="w-3.5 h-3.5 text-blue-600" />
                      </div>
                      <span className="text-[13px] font-semibold text-gray-900 tracking-tight">General information</span>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="pb-4 pt-1 space-y-4">
                    <div className="grid grid-cols-1 gap-4">
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between">
                          <HoverCard openDelay={200}>
                            <HoverCardTrigger asChild>
                              <div className="flex items-center gap-1.5 cursor-help">
                                <Label className="text-[11px] font-bold text-gray-400 tracking-tight">Invoice ID</Label>
                                <Info className="w-2.5 h-2.5 text-gray-300" />
                              </div>
                            </HoverCardTrigger>
                            <HoverCardContent className="w-64 p-3 border-gray-100 shadow-xl">
                              <div className="space-y-1">
                                <p className="text-[11px] font-bold text-gray-900">System Generated ID</p>
                                <p className="text-[10px] text-gray-500 leading-normal">This unique identifier is automatically generated by the Omne ERP system to ensure accounting integrity and internal traceability.</p>
                              </div>
                            </HoverCardContent>
                          </HoverCard>
                          <button 
                            onClick={() => setInvoiceNumber(generateInvoiceNumber())}
                            className="text-[9px] font-black text-blue-600 hover:text-blue-700 flex items-center gap-1 transition-colors"
                          >
                            <RotateCcw className="w-2.5 h-2.5" />
                            Regenerate
                          </button>
                        </div>
                        <Input 
                          value={invoiceNumber} 
                          readOnly
                          className="h-9 bg-gray-50 border-gray-100 text-[11px] font-bold text-gray-500 cursor-not-allowed shadow-none" 
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                          <Label className="text-[11px] font-bold text-gray-400 tracking-tight">Payment terms</Label>
                          <Select value={paymentTerms} onValueChange={setPaymentTerms}>
                            <SelectTrigger className="h-9 bg-white border-gray-200 text-[11px] font-bold shadow-none focus:ring-1 focus:ring-blue-100">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="Due on Receipt" className="text-[11px] font-bold">Due on receiving</SelectItem>
                              <SelectItem value="Net 15" className="text-[11px] font-bold">Net 15</SelectItem>
                              <SelectItem value="Net 30" className="text-[11px] font-bold">Net 30</SelectItem>
                              <SelectItem value="Net 60" className="text-[11px] font-bold">Net 60</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>

                        <div className="space-y-1.5">
                          <Label className="text-[11px] font-bold text-gray-400 tracking-tight">Due date</Label>
                          <div className="relative">
                            <Input 
                              value={dueDate} 
                              readOnly 
                              className="h-9 bg-gray-50 border-gray-100 text-[11px] font-bold text-gray-500 cursor-not-allowed shadow-none" 
                            />
                            <Calendar className="w-3.5 h-3.5 text-gray-300 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                          </div>
                        </div>
                      </div>

                      <div className="space-y-1.5">
                        <Label className="text-[11px] font-bold text-gray-400 tracking-tight">A/P account</Label>
                        <div className="flex items-center gap-1.5">
                          <div className="flex-1 min-w-0 h-9 flex items-center px-2.5 bg-gray-50 rounded-md border border-gray-100">
                            {apAccount ? (
                              <span className="truncate text-[11px] font-bold text-gray-700">{apAccount}</span>
                            ) : (
                              <span className="truncate text-[11px] font-medium text-gray-400 italic">No A/P account</span>
                            )}
                          </div>
                          <button
                            onClick={() => { setApConfigModalOpen(true); setApModalSearch(''); }}
                            className="shrink-0 h-9 w-9 flex items-center justify-center rounded-md border border-gray-200 bg-white hover:bg-blue-50 hover:border-blue-200 text-gray-400 hover:text-blue-600 transition-colors"
                            title="A/P Configuration"
                          >
                            <Settings2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                        {/* Auto-populated indicator */}
                        <div className="flex items-center gap-1.5 mt-1">
                          <div className="w-1.5 h-1.5 rounded-full bg-green-400" />
                          <span className="text-[9px] font-medium text-gray-400">Auto-assigned from vendor profile</span>
                        </div>
                      </div>
                    </div>
                  </AccordionContent>
                </AccordionItem>

                {/* Section 2: GL Impact */}
                <AccordionItem value="gl-impact" className="border border-gray-200 rounded-xl bg-white px-4 shadow-sm overflow-hidden">
                  <AccordionTrigger className="hover:no-underline py-3 group">
                    <div className="flex items-center gap-2.5">
                      <div className="w-6 h-6 rounded-lg bg-purple-50 flex items-center justify-center group-hover:bg-purple-100 transition-colors">
                        <FileText className="w-3.5 h-3.5 text-purple-600" />
                      </div>
                      <span className="text-[13px] font-semibold text-gray-900 tracking-tight">GL impact</span>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="pb-4 pt-1 space-y-4">
                    <div className="space-y-4">
                      <div className="space-y-3">
                        <div>
                          <p className="text-[9px] font-semibold text-gray-400 tracking-widest uppercase mb-1.5">Debit</p>
                          <div className="flex items-center justify-between p-2 bg-gray-50/50 rounded-lg border border-gray-100/50">
                            <div className="flex items-center gap-2">
                              <span className="text-[10px] font-medium text-gray-400">1200</span>
                              <span className="text-[11px] font-semibold text-gray-700 tracking-tight">Inventory</span>
                            </div>
                            <span className="text-[12px] font-bold text-gray-900 tracking-tight">${total.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                          </div>
                        </div>

                        <div>
                          <p className="text-[9px] font-semibold text-gray-400 tracking-widest uppercase mb-1.5">Credit</p>
                          <div className="flex items-center justify-between p-2 bg-gray-50/50 rounded-lg border border-gray-100/50">
                            <div className="flex items-center gap-2">
                              <span className="text-[10px] font-medium text-gray-400">{apAccount.split(' ')[0]}</span>
                              <span className="text-[11px] font-semibold text-gray-700 tracking-tight">{apAccount.substring(apAccount.split(' ')[0].length + 1)}</span>
                            </div>
                            <span className="text-[12px] font-bold text-gray-900 tracking-tight">${total.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                          </div>
                        </div>

                        <div className="bg-emerald-50 border border-emerald-100 rounded-lg p-2.5 flex items-center justify-between mt-1">
                           <div className="flex items-center gap-2">
                              <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                              <span className="text-[9px] font-bold text-emerald-700 uppercase tracking-wider">Balanced</span>
                           </div>
                           <div className="text-[10px] font-semibold text-emerald-800 tracking-tight">
                              Dr: ${total.toLocaleString()} | Cr: ${total.toLocaleString()}
                           </div>
                        </div>
                      </div>

                      
                    </div>
                  </AccordionContent>
                </AccordionItem>

                {/* Section 3: Payment hold */}
                <AccordionItem value="hold" className="border border-gray-200 rounded-xl bg-white px-4 shadow-sm overflow-hidden">
                  <div className="flex items-center justify-between w-full group">
                    <AccordionTrigger className="hover:no-underline py-3 flex-1 [&>svg]:hidden">
                      <div className="flex items-center gap-2.5">
                        <div className="w-6 h-6 rounded-lg bg-red-50 flex items-center justify-center group-hover:bg-red-100 transition-colors">
                          <Lock className="w-3.5 h-3.5 text-red-600" />
                        </div>
                        <span className="text-[13px] font-semibold text-gray-900 tracking-tight">Payment hold</span>
                      </div>
                    </AccordionTrigger>
                    <Switch 
                      checked={isPaymentHoldActive}
                      onCheckedChange={(checked) => {
                        setIsPaymentHoldActive(checked);
                        if (checked) {
                          if (!expandedSections.includes("hold")) {
                            setExpandedSections(prev => [...prev, "hold"]);
                          }
                        } else {
                          setExpandedSections(prev => prev.filter(s => s !== "hold"));
                        }
                      }}
                      onClick={(e) => e.stopPropagation()}
                      className="scale-90"
                    />
                  </div>
                  <AccordionContent className="pb-4 pt-1 space-y-4">
                    <div className="space-y-4">
                      <div className="space-y-1.5">
                        <Textarea 
                          placeholder="Hold reason (required)..." 
                          value={holdReason}
                          onChange={(e) => setHoldReason(e.target.value)}
                          className={`min-h-[80px] text-[10px] font-medium border-gray-200 focus:ring-1 focus:ring-gray-200 shadow-none resize-none transition-colors ${!holdReason ? 'bg-gray-50/50' : 'bg-white'}`}
                        />
                        {!holdReason && (
                          <p className="font-bold text-gray-400 tracking-tight flex items-center gap-1 text-[10px]">
                            <AlertTriangle className="w-2.5 h-2.5" />
                            Reason required
                          </p>
                        )}
                      </div>

                      <div className="space-y-2.5">
                        <div className="flex items-center gap-1.5">
                          <FileText className="w-3 h-3 text-gray-400" />
                          <p className="text-[9px] font-bold text-gray-400 tracking-widest uppercase">Supporting Documents</p>
                        </div>
                        <div className="space-y-2">
                          <input
                            type="file"
                            id="payment-hold-upload"
                            className="hidden"
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) {
                                setHoldAttachments(prev => [...prev, { name: file.name }]);
                              }
                              e.target.value = '';
                            }}
                          />
                          <Button 
                            variant="outline" 
                            className="w-full h-9 border-gray-200 text-[11px] font-bold gap-2 hover:bg-gray-50 text-gray-700"
                            onClick={() => document.getElementById('payment-hold-upload')?.click()}
                          >
                            <Upload className="w-3.5 h-3.5" />
                            Attach Document
                          </Button>
                        </div>
                        {holdAttachments.length > 0 && (
                          <div className="flex flex-wrap gap-2 pt-1">
                            {holdAttachments.map((file, idx) => (
                              <div key={idx} className="flex items-center gap-1.5 px-2 py-1 bg-gray-50 border border-gray-100 rounded text-[9px] font-medium text-gray-600 group/attachment">
                                <Paperclip className="w-2.5 h-2.5 text-gray-400" />
                                <span className="truncate max-w-[120px]">{file.name}</span>
                                <button 
                                  onClick={() => setHoldAttachments(prev => prev.filter((_, i) => i !== idx))}
                                  className="ml-0.5 p-0.5 hover:bg-gray-200 rounded-sm text-gray-400 hover:text-red-500 transition-colors"
                                >
                                  <X className="w-2.5 h-2.5" />
                                </button>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      <div className="space-y-2.5">
                        <div className="flex items-center gap-1.5">
                          <Users className="w-3 h-3 text-gray-400" />
                          <p className="text-[9px] font-bold text-gray-400 tracking-widest uppercase">Notify Stakeholders</p>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {['Finance Manager', 'AP Supervisor', 'CFO', 'Controller'].map((role) => {
                            const isSelected = notifiedStakeholders.includes(role);
                            return (
                              <button
                                key={role}
                                onClick={() => {
                                  setNotifiedStakeholders(prev => 
                                    isSelected ? prev.filter(r => r !== role) : [...prev, role]
                                  );
                                }}
                                className={`px-3 py-1.5 rounded-lg text-[10px] font-bold transition-all border ${
                                  isSelected 
                                    ? 'bg-gray-900 border-gray-900 text-white shadow-sm' 
                                    : 'bg-white border-gray-200 text-gray-500 hover:border-gray-300'
                                }`}
                              >
                                {role}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  </AccordionContent>
                </AccordionItem>

                {/* Section 4: Exception */}
                <AccordionItem value="exception" className="border border-gray-200 rounded-xl bg-white px-4 shadow-sm overflow-hidden">
                  <div className="flex items-center justify-between w-full group">
                    <AccordionTrigger className="hover:no-underline py-3 flex-1 [&>svg]:hidden">
                      <div className="flex items-center gap-2.5">
                        <div className="w-6 h-6 rounded-lg bg-rose-50 flex items-center justify-center group-hover:bg-rose-100 transition-colors">
                          <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />
                        </div>
                        <span className="text-[13px] font-semibold text-gray-900 tracking-tight">Exception</span>
                      </div>
                    </AccordionTrigger>
                    <Switch 
                      checked={isExceptionActive}
                      onCheckedChange={(checked) => {
                        setIsExceptionActive(checked);
                        if (checked) {
                          if (!expandedSections.includes("exception")) {
                            setExpandedSections(prev => [...prev, "exception"]);
                          }
                        } else {
                          setExpandedSections(prev => prev.filter(s => s !== "exception"));
                        }
                      }}
                      onClick={(e) => e.stopPropagation()}
                      className="scale-90"
                    />
                  </div>
                  <AccordionContent className="pb-4 pt-1 space-y-4">
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <Select value={exceptionType} onValueChange={setExceptionType}>
                          <SelectTrigger className="h-9 bg-white border-gray-200 text-[11px] font-medium shadow-none focus:ring-1 focus:ring-gray-200">
                            <SelectValue placeholder="Select type..." />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="price-discrepancy" className="text-[11px] font-medium">Price Discrepancy</SelectItem>
                            <SelectItem value="quantity-mismatch" className="text-[11px] font-medium">Quantity Mismatch</SelectItem>
                            <SelectItem value="damaged-goods" className="text-[11px] font-medium">Damaged Goods</SelectItem>
                            <SelectItem value="duplicate-invoice" className="text-[11px] font-medium">Duplicate Invoice</SelectItem>
                            <SelectItem value="incorrect-vendor" className="text-[11px] font-medium">Incorrect Vendor</SelectItem>
                          </SelectContent>
                        </Select>

                        <Textarea 
                          placeholder="Describe exception..." 
                          value={exceptionDescription}
                          onChange={(e) => setExceptionDescription(e.target.value)}
                          className="min-h-[80px] text-[10px] font-medium border-gray-200 focus:ring-1 focus:ring-gray-200 shadow-none resize-none transition-colors bg-white"
                        />
                      </div>

                      <div className="space-y-2.5">
                        <div className="flex items-center gap-1.5">
                          <FileText className="w-3 h-3 text-gray-400" />
                          <p className="text-[9px] font-bold text-gray-400 tracking-widest uppercase">SUPPORTING DOCUMENTS</p>
                        </div>
                        <div className="space-y-2">
                          <input
                            type="file"
                            id="exception-upload"
                            className="hidden"
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) {
                                setExceptionAttachments(prev => [...prev, { name: file.name }]);
                              }
                              e.target.value = '';
                            }}
                          />
                          <Button 
                            variant="outline" 
                            className="w-full h-9 border-gray-200 text-[11px] font-bold gap-2 hover:bg-gray-50 text-gray-700"
                            onClick={() => document.getElementById('exception-upload')?.click()}
                          >
                            <Upload className="w-3.5 h-3.5" />
                            Attach Document
                          </Button>
                        </div>
                        {exceptionAttachments.length > 0 && (
                          <div className="flex wrap gap-2 pt-1">
                            {exceptionAttachments.map((file, idx) => (
                              <div key={idx} className="flex items-center gap-1.5 px-2 py-1 bg-gray-50 border border-gray-100 rounded text-[9px] font-medium text-gray-600 group/attachment">
                                <Paperclip className="w-2.5 h-2.5 text-gray-400" />
                                <span className="truncate max-w-[120px]">{file.name}</span>
                                <button 
                                  onClick={() => setExceptionAttachments(prev => prev.filter((_, i) => i !== idx))}
                                  className="ml-0.5 p-0.5 hover:bg-gray-200 rounded-sm text-gray-400 hover:text-red-500 transition-colors"
                                >
                                  <X className="w-2.5 h-2.5" />
                                </button>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      <div className="space-y-2.5">
                        <div className="flex items-center gap-1.5">
                          <Users className="w-3 h-3 text-gray-400" />
                          <p className="text-[9px] font-bold text-gray-400 tracking-widest uppercase">NOTIFY STAKEHOLDERS</p>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {['Finance Manager', 'AP Supervisor', 'CFO', 'Controller'].map((role) => {
                            const isSelected = notifiedExceptionStakeholders.includes(role);
                            return (
                              <button
                                key={role}
                                onClick={() => {
                                  setNotifiedExceptionStakeholders(prev => 
                                    isSelected ? prev.filter(r => r !== role) : [...prev, role]
                                  );
                                }}
                                className={`px-3 py-1.5 rounded-lg text-[10px] font-bold transition-all border ${
                                  isSelected 
                                    ? 'bg-gray-900 border-gray-900 text-white shadow-sm' 
                                    : 'bg-white border-gray-200 text-gray-500 hover:border-gray-300'
                                }`}
                              >
                                {role}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  </AccordionContent>
                </AccordionItem>

                {/* Section 5: Additional charges */}
                <AccordionItem value="additional-charges" className="border border-gray-200 rounded-xl bg-white px-4 shadow-sm overflow-hidden">
                  <AccordionTrigger className="hover:no-underline py-3 group">
                    <div className="flex items-center gap-2.5">
                      <div className="w-6 h-6 rounded-lg bg-orange-50 flex items-center justify-center group-hover:bg-orange-100 transition-colors">
                        <DollarSign className="w-3.5 h-3.5 text-orange-600" />
                      </div>
                      <span className="text-[13px] font-semibold text-gray-900 tracking-tight">Additional charges</span>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="pb-4 pt-1">
                    <div className="space-y-4">
                      {additionalCharges.map((charge, index) => (
                        <div key={charge.id} className="flex items-end gap-3 animate-in fade-in slide-in-from-top-1 duration-200">
                          <div className="flex-1 space-y-1.5">
                            {index === 0 && <Label className="text-[10px] font-bold text-gray-400 tracking-tight uppercase">Charge Type</Label>}
                            <Select 
                              value={charge.type} 
                              onValueChange={(value) => {
                                const newCharges = [...additionalCharges];
                                newCharges[index].type = value;
                                setAdditionalCharges(newCharges);
                              }}
                            >
                              <SelectTrigger className="h-9 bg-white border-gray-200 text-[11px] font-bold shadow-none">
                                <SelectValue placeholder="Select type" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="Tax">Tax</SelectItem>
                                <SelectItem value="Service Fees">Service Fees</SelectItem>
                                <SelectItem value="Custom Charges">Custom Charges</SelectItem>
                                <SelectItem value="Handling Fees">Handling Fees</SelectItem>
                                <SelectItem value="Adjustments">Adjustments</SelectItem>
                                <SelectItem value="Insurance">Insurance</SelectItem>
                                <SelectItem value="Fuel Surcharge">Fuel Surcharge</SelectItem>
                                <SelectItem value="Other">Other</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>

                          <div className="w-[140px] space-y-1.5">
                            {index === 0 && <Label className="text-[10px] font-bold text-gray-400 tracking-tight uppercase">Amount</Label>}
                            <div className="relative">
                              <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 font-bold text-[10px]">$</span>
                              <Input 
                                type="number" 
                                value={charge.amount || ''}
                                onChange={(e) => {
                                  const newCharges = [...additionalCharges];
                                  newCharges[index].amount = Number(e.target.value);
                                  setAdditionalCharges(newCharges);
                                }}
                                className="pl-6 h-9 bg-white border-gray-200 text-[11px] font-bold shadow-none focus:ring-1 focus:ring-orange-200" 
                                placeholder="0.00"
                              />
                            </div>
                          </div>

                          {additionalCharges.length > 1 && (
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              onClick={() => {
                                setAdditionalCharges(additionalCharges.filter(c => c.id !== charge.id));
                              }}
                              className="h-9 w-9 text-gray-400 hover:text-red-500 hover:bg-red-50"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          )}
                        </div>
                      ))}

                      {additionalCharges.length < 5 && (
                        <Button 
                          variant="outline" 
                          size="sm" 
                          onClick={() => {
                            setAdditionalCharges([...additionalCharges, { id: Date.now(), type: 'Service Fees', amount: 0 }]);
                          }}
                          className="w-full border-dashed border-gray-200 text-[11px] font-bold text-gray-500 hover:text-orange-600 hover:border-orange-200 hover:bg-orange-50/50 py-5"
                        >
                          <Plus className="w-3.5 h-3.5 mr-2" />
                          Add another charge
                        </Button>
                      )}

                      <div className="pt-2 border-t border-gray-50">
                        <div className="flex items-center justify-between px-1">
                          <span className="text-[10px] font-bold text-gray-400 uppercase tracking-tight">Total Additional Charges</span>
                          <span className="text-[12px] font-bold text-gray-900">${additionalChargesTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                        </div>
                      </div>
                    </div>
                  </AccordionContent>
                </AccordionItem>

                {/* Section 6: Freight */}
                <AccordionItem value="freight" className="border border-gray-200 rounded-xl bg-white px-4 shadow-sm overflow-hidden">
                  <AccordionTrigger className="hover:no-underline py-3 group">
                    <div className="flex items-center gap-2.5">
                      <div className="w-6 h-6 rounded-lg bg-amber-50 flex items-center justify-center group-hover:bg-amber-100 transition-colors">
                        <Truck className="w-3.5 h-3.5 text-amber-600" />
                      </div>
                      <span className="text-[13px] font-semibold text-gray-900 tracking-tight">Freight</span>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="pb-4 pt-1 space-y-4">
                    <div className="grid grid-cols-2 gap-x-4 gap-y-3">
                      <div className="space-y-1.5">
                        <Label className="text-[9px] font-bold text-gray-400 tracking-widest uppercase">CARRIER NAME</Label>
                        <Select value={carrierName} onValueChange={setCarrierName}>
                          <SelectTrigger className="h-9 bg-white border-gray-200 text-[11px] font-medium shadow-none focus:ring-1 focus:ring-gray-200">
                            <SelectValue placeholder="Select carrier..." />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="FedEx Ground" className="text-[11px] font-medium">FedEx Ground</SelectItem>
                            <SelectItem value="UPS Freight" className="text-[11px] font-medium">UPS Freight</SelectItem>
                            <SelectItem value="DHL Express" className="text-[11px] font-medium">DHL Express</SelectItem>
                            <SelectItem value="Swift Transportation" className="text-[11px] font-medium">Swift Transportation</SelectItem>
                            <SelectItem value="Old Dominion" className="text-[11px] font-medium">Old Dominion</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-1.5">
                        <Label className="text-[9px] font-bold text-gray-400 tracking-widest uppercase">SHIPPING METHOD</Label>
                        <Select value={shippingMethod} onValueChange={setShippingMethod}>
                          <SelectTrigger className="h-9 bg-white border-gray-200 text-[11px] font-medium shadow-none focus:ring-1 focus:ring-gray-200">
                            <SelectValue placeholder="Select method..." />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Standard" className="text-[11px] font-medium">Standard</SelectItem>
                            <SelectItem value="Expedited" className="text-[11px] font-medium">Expedited</SelectItem>
                            <SelectItem value="Overnight" className="text-[11px] font-medium">Overnight</SelectItem>
                            <SelectItem value="LTL" className="text-[11px] font-medium">LTL (Less Than Truckload)</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-1.5">
                        <Label className="text-[9px] font-bold text-gray-400 tracking-widest uppercase">DISPATCH TYPE</Label>
                        <Select value={dispatchType} onValueChange={setDispatchType}>
                          <SelectTrigger className="h-9 bg-white border-gray-200 text-[11px] font-medium shadow-none focus:ring-1 focus:ring-gray-200">
                            <SelectValue placeholder="Select type..." />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Direct" className="text-[11px] font-medium">Direct</SelectItem>
                            <SelectItem value="Drop-off" className="text-[11px] font-medium">Drop-off</SelectItem>
                            <SelectItem value="Pickup" className="text-[11px] font-medium">Pickup</SelectItem>
                            <SelectItem value="Intermodal" className="text-[11px] font-medium">Intermodal</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-1.5">
                        <Label className="text-[9px] font-bold text-gray-400 tracking-widest uppercase">FREIGHT CHARGES</Label>
                        <div className="relative">
                          <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 font-bold text-[10px]">$</span>
                          <Input 
                            type="number" 
                            value={freightAmount}
                            onChange={(e) => setFreightAmount(Number(e.target.value))}
                            className="pl-6 h-9 bg-white border-gray-200 text-[11px] font-bold shadow-none focus:ring-1 focus:ring-gray-200" 
                          />
                        </div>
                      </div>
                    </div>
                    <div className="p-2.5 bg-gray-50 rounded-lg border border-gray-100 flex items-start gap-2.5">
                      <div className="w-5 h-5 rounded bg-white flex items-center justify-center border border-gray-200 shrink-0">
                        <Info className="w-3 h-3 text-gray-400" />
                      </div>
                      <p className="text-gray-500 font-medium leading-normal text-[10px]">
                        {isStandalone 
                          ? 'Enter freight details for this standalone invoice. These values will be included in the final invoice total.'
                          : <>Initial values pulled from <span className="text-gray-900 font-bold">{activePOTab}</span>. Modifications made here will only apply to this invoice and will not update the original Purchase Order.</>
                        }
                      </p>
                    </div>
                  </AccordionContent>
                </AccordionItem>

                {/* Section 7: Notes */}
                <AccordionItem value="notes" className="border border-gray-200 rounded-xl bg-white px-4 shadow-sm overflow-hidden">
                  <AccordionTrigger className="hover:no-underline py-3 group">
                    <div className="flex items-center gap-2.5">
                      <div className="w-6 h-6 rounded-lg bg-slate-50 flex items-center justify-center group-hover:bg-slate-100 transition-colors">
                        <Edit3 className="w-3.5 h-3.5 text-slate-600" />
                      </div>
                      <span className="text-[13px] font-semibold text-gray-900 tracking-tight">Notes</span>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="pb-4 pt-1">
                    <Textarea 
                      placeholder="Enter internal notes for this invoice..." 
                      className="min-h-[80px] text-[11px] font-medium border-gray-200 focus:ring-1 focus:ring-blue-100 shadow-none resize-none"
                    />
                  </AccordionContent>
                </AccordionItem>

                {/* Section 8: Attachments */}
                <AccordionItem value="attachments" className="border border-gray-200 rounded-xl bg-white px-4 shadow-sm overflow-hidden">
                  <AccordionTrigger className="hover:no-underline py-3 group">
                    <div className="flex items-center gap-2.5">
                      <div className="w-6 h-6 rounded-lg bg-zinc-50 flex items-center justify-center group-hover:bg-zinc-100 transition-colors">
                        <Paperclip className="w-3.5 h-3.5 text-zinc-600" />
                      </div>
                      <span className="text-[13px] font-semibold text-gray-900 tracking-tight">Attachments</span>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="pb-4 pt-1">
                    <div className="space-y-3">
                      <input
                        type="file"
                        id="invoice-attachments-upload"
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            setInvoiceAttachments(prev => [...prev, { name: file.name }]);
                          }
                          e.target.value = '';
                        }}
                      />
                      <div 
                        onClick={() => document.getElementById('invoice-attachments-upload')?.click()}
                        className="border-2 border-dashed border-gray-100 rounded-xl p-5 flex flex-col items-center justify-center gap-2 hover:bg-blue-50/50 hover:border-blue-100 cursor-pointer transition-all group/upload"
                      >
                        <Upload className="w-6 h-6 text-gray-300 group-hover/upload:text-blue-500 group-hover/upload:scale-110 transition-all" />
                        <div className="text-center">
                          <p className="text-[10px] font-bold text-gray-600">Attach vendor invoice</p>
                          <p className="text-[8px] text-gray-400 font-medium mt-0.5">PDF, JPG, or PNG up to 10MB</p>
                        </div>
                      </div>

                      {invoiceAttachments.length > 0 && (
                        <div className="flex flex-wrap gap-2 pt-1">
                          {invoiceAttachments.map((file, idx) => (
                            <div key={idx} className="flex items-center gap-1.5 px-2 py-1 bg-gray-50 border border-gray-100 rounded text-[9px] font-medium text-gray-600 group/attachment w-full justify-between">
                              <div className="flex items-center gap-1.5 min-w-0">
                                <Paperclip className="w-2.5 h-2.5 text-gray-400 shrink-0" />
                                <span className="truncate">{file.name}</span>
                              </div>
                              <button 
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setInvoiceAttachments(prev => prev.filter((_, i) => i !== idx));
                                }}
                                className="ml-0.5 p-0.5 hover:bg-gray-200 rounded-sm text-gray-400 hover:text-red-500 transition-colors shrink-0"
                              >
                                <X className="w-2.5 h-2.5" />
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </AccordionContent>
                </AccordionItem>
              </Accordion>

              <div className="h-10" />
            </div>

            <div className="p-4 border-t border-gray-200 bg-white shrink-0 sticky bottom-0 z-10">
              <div className="mb-4 space-y-2.5 px-1">
                <button 
                  onClick={() => setShowBreakdown(!showBreakdown)}
                  className="flex items-center gap-1.5 text-[11px] font-bold text-blue-600 hover:text-blue-700 transition-colors cursor-pointer mb-2"
                >
                  {showBreakdown ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                  {showBreakdown ? 'Hide breakdown' : 'Show breakdown'}
                </button>

                {showBreakdown && (
                  <div className="space-y-2.5 animate-in fade-in slide-in-from-top-1 duration-200">
                    <div className="flex justify-between items-center">
                      <span className="text-[11px] font-bold text-gray-400">Subtotal (Items)</span>
                      <span className="text-[12px] font-bold text-gray-700">${subtotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-[11px] font-bold text-gray-400">Freight</span>
                      <span className="text-[12px] font-bold text-gray-700">${freightAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                    </div>
                    {additionalCharges.map((charge) => charge.amount > 0 && (
                      <div key={charge.id} className="flex justify-between items-center">
                        <span className="text-[11px] font-bold text-gray-400">{charge.type}</span>
                        <span className="text-[12px] font-bold text-gray-700">${charge.amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                      </div>
                    ))}
                  </div>
                )}

                <div className="pt-3 mt-1 border-t border-gray-100 flex justify-between items-end">
                  <span className="text-[11px] font-bold text-gray-900 tracking-widest uppercase mb-1">Final Total</span>
                  <div className="text-right">
                    <span className="text-[20px] font-bold text-gray-900 leading-none">${total.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                  </div>
                </div>
              </div>
              <div className="flex gap-3">
                <Button 
                  variant="outline" 
                  onClick={onClose} 
                  className="flex-1 h-11 border-gray-200 text-[#475569] font-bold text-[14px] rounded-lg cursor-pointer hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </Button>
                <Button 
                  onClick={handleSubmit} 
                  className="flex-[2] h-11 bg-[#2563EB] hover:bg-blue-700 text-white font-bold text-[14px] shadow-sm transition-all rounded-lg cursor-pointer flex items-center justify-center gap-2"
                >
                  <SendHorizontal className="w-4 h-4" />
                  Submit for approval
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Removal Confirmation Prompt */}
      {!isStandalone && poToRemove && (
        <div className="fixed inset-0 bg-black/60 z-[60] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full p-6 animate-in zoom-in-95 duration-200">
            <div className="w-12 h-12 rounded-full bg-red-50 flex items-center justify-center mb-4">
              <AlertTriangle className="w-6 h-6 text-red-500" />
            </div>
            <h3 className="text-lg font-bold text-gray-900 mb-2">Remove Purchase Order?</h3>
            <p className="text-sm text-gray-500 mb-6">
              You are about to remove <span className="font-bold text-gray-900">{poToRemove}</span> from this invoice creation. All line items associated with this PO will be cleared.
            </p>
            <div className="flex gap-3">
              <Button 
                variant="outline" 
                onClick={() => setPoToRemove(null)}
                className="flex-1 h-10 text-xs font-bold tracking-wider rounded-lg"
              >
                Cancel
              </Button>
              <Button 
                onClick={handleRemovePO}
                className="flex-1 h-10 bg-red-600 hover:bg-red-700 text-white text-xs font-bold tracking-wider rounded-lg"
              >
                Yes, remove
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Add Items Modal */}
      {!isStandalone && (
        <AddItemFromPOModal 
          isOpen={isAddItemModalOpen}
          onClose={() => setIsAddItemModalOpen(false)}
          poData={activePOOriginalData}
          currentItems={currentPOsData.find(p => p.poNumber === activePOTab)?.items || []}
          onAdd={handleAddItemsFromPO}
        />
      )}

      {/* Vendor Selection Modal for adding more POs */}
      {!isStandalone && (
        <VendorSelectionModalNested 
          isOpen={isAddPOOpen}
          onClose={() => setIsAddPOOpen(false)}
          onContinue={handleAddPOs}
          fixedVendorId={currentVendorId || undefined}
        />
      )}

      {/* GL Configuration Modal */}
      {glConfigModalItemId && (() => {
        const currentItem = standaloneItems.find(i => i.id === glConfigModalItemId);
        // Only show expense accounts: 5xxx COGS, 6xxx Operating, 7xxx Non-Operating, 9xxx Tax
        const expenseAccounts = GL_ACCOUNTS.filter(a => {
          const code = parseInt(a.split(' ')[0]);
          return (code >= 5000 && code < 8000) || code >= 9000;
        });
        const filteredAccounts = expenseAccounts.filter(a => 
          a.toLowerCase().includes(glModalSearch.toLowerCase())
        );
        
        // Group by category
        const grouped: Record<string, string[]> = {};
        filteredAccounts.forEach(account => {
          const code = parseInt(account.split(' ')[0]);
          let category = 'Other';
          if (code >= 5000 && code < 6000) category = 'Cost of Goods Sold';
          else if (code >= 6000 && code < 7000) category = 'Operating Expenses';
          else if (code >= 7000 && code < 8000) category = 'Non-Operating Expenses';
          else if (code >= 9000) category = 'Tax Expense';
          if (!grouped[category]) grouped[category] = [];
          grouped[category].push(account);
        });

        return (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[110] flex items-center justify-center p-4" onClick={() => setGlConfigModalItemId(null)}>
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-[520px] max-h-[80vh] flex flex-col overflow-hidden border border-gray-200" onClick={(e) => e.stopPropagation()}>
              
              {/* Modal Header */}
              <div className="px-5 pt-5 pb-3 border-b border-gray-100">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-blue-50 border border-blue-100 flex items-center justify-center">
                      <LayoutGrid className="w-4 h-4 text-blue-600" />
                    </div>
                    <div>
                      <h3 className="text-[13px] font-bold text-gray-900">GL Configuration</h3>
                      <p className="text-[10px] text-gray-400 font-medium">Select an expense account to debit for this line item</p>
                    </div>
                  </div>
                  <button 
                    onClick={() => setGlConfigModalItemId(null)}
                    className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors text-gray-400 hover:text-gray-600"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                {/* Currently selected */}
                {currentItem?.glAccount && (
                  <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-blue-50/60 border border-blue-100 mb-3">
                    <Check className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                    <span className="text-[11px] font-bold text-blue-700">Current: {currentItem.glAccount}</span>
                  </div>
                )}

                {/* Search */}
                <div className="relative">
                  <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <Input 
                    value={glModalSearch}
                    onChange={(e) => setGlModalSearch(e.target.value)}
                    placeholder="Search by account code or name..."
                    className="h-[34px] pl-9 bg-gray-50 border-gray-200 text-[11px] font-medium shadow-none rounded-lg focus-visible:ring-1 focus-visible:ring-blue-200"
                    autoFocus
                  />
                </div>
              </div>

              {/* Account List */}
              <div className="flex-1 overflow-y-auto px-3 py-2 custom-scrollbar">
                {filteredAccounts.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-10 text-gray-400">
                    <Search className="w-5 h-5 mb-2 text-gray-300" />
                    <span className="text-[11px] font-medium">No accounts match your search</span>
                  </div>
                ) : (
                  Object.entries(grouped).map(([category, accounts]) => (
                    <div key={category} className="mb-2">
                      <div className="sticky top-0 z-10 bg-white px-2 py-1.5">
                        <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest">{category}</span>
                      </div>
                      <div className="space-y-0.5">
                        {accounts.map((account) => {
                          const isSelected = currentItem?.glAccount === account;
                          const code = account.split(' ')[0];
                          const name = account.substring(code.length + 1);
                          return (
                            <button
                              key={account}
                              onClick={() => {
                                updateStandaloneItem(glConfigModalItemId, 'glAccount', account);
                                setGlConfigModalItemId(null);
                              }}
                              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all text-left group/item ${
                                isSelected 
                                  ? 'bg-blue-50 border border-blue-200' 
                                  : 'hover:bg-gray-50 border border-transparent'
                              }`}
                            >
                              <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 transition-colors ${
                                isSelected ? 'bg-blue-600 border-blue-600' : 'border-gray-200 group-hover/item:border-gray-300'
                              }`}>
                                {isSelected && <Check className="w-3 h-3 text-white" />}
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                  <span className={`text-[11px] font-black tracking-tight ${isSelected ? 'text-blue-700' : 'text-gray-600'}`}>{code}</span>
                                  <span className={`text-[11px] font-medium truncate ${isSelected ? 'text-blue-600' : 'text-gray-500'}`}>{name}</span>
                                </div>
                              </div>
                              <span className="text-[9px] font-bold text-gray-300 uppercase tracking-wider shrink-0">DR</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* Modal Footer */}
              <div className="px-5 py-3 border-t border-gray-100 bg-gray-50/50 flex items-center justify-between">
                <span className="text-[10px] text-gray-400 font-medium">{filteredAccounts.length} account{filteredAccounts.length !== 1 ? 's' : ''} available</span>
                <div className="flex items-center gap-2">
                  <Button 
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      if (currentItem?.glAccount) {
                        updateStandaloneItem(glConfigModalItemId, 'glAccount', '');
                      }
                      setGlConfigModalItemId(null);
                    }}
                    className="h-8 px-3 text-[10px] font-bold border-gray-200 text-gray-500 shadow-none"
                  >
                    {currentItem?.glAccount ? 'Clear & Close' : 'Cancel'}
                  </Button>
                  <Button 
                    size="sm"
                    onClick={() => setGlConfigModalItemId(null)}
                    className="h-8 px-4 text-[10px] font-bold bg-gray-900 hover:bg-gray-800 text-white shadow-none"
                  >
                    Done
                  </Button>
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* PO GL Configuration Modal */}
      {poGlConfigModalItemId && (() => {
        const currentItem = currentPOsData.flatMap(po => po.items).find(i => i.id === poGlConfigModalItemId);
        if (!currentItem) return null;

        // Filter and group GL accounts
        const filteredGLAccounts = GL_ACCOUNTS.filter(a =>
          a.toLowerCase().includes(poGlModalSearch.toLowerCase())
        );

        // Group GL accounts by category
        const glGrouped: Record<string, string[]> = {};
        filteredGLAccounts.forEach(account => {
          const code = parseInt(account.split(' ')[0]);
          let category = 'Other';
          if (code >= 1200 && code < 1300) category = 'Inventory Assets';
          else if (code >= 5000 && code < 5300) category = 'Cost of Goods Sold';
          else if (code >= 6000 && code < 7000) category = 'Operating Expenses';
          else if (code >= 7000 && code < 9000) category = 'Non-Operating Expenses';
          else if (code >= 9000) category = 'Tax Expenses';
          if (!glGrouped[category]) glGrouped[category] = [];
          glGrouped[category].push(account);
        });

        return (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[110] flex items-center justify-center p-4" onClick={() => setPoGlConfigModalItemId(null)}>
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-[520px] max-h-[80vh] flex flex-col overflow-hidden border border-gray-200" onClick={(e) => e.stopPropagation()}>
              
              {/* Modal Header */}
              <div className="px-5 pt-5 pb-3 border-b border-gray-100">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-blue-50 border border-blue-100 flex items-center justify-center">
                      <LayoutGrid className="w-4 h-4 text-blue-600" />
                    </div>
                    <div>
                      <h3 className="text-[13px] font-bold text-gray-900">GL Configuration</h3>
                      <p className="text-[10px] text-gray-400 font-medium">Select the general ledger account to debit</p>
                    </div>
                  </div>
                  <button 
                    onClick={() => setPoGlConfigModalItemId(null)}
                    className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors text-gray-400 hover:text-gray-600"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                {/* Item info */}
                <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-gray-50/60 border border-gray-100 mb-3">
                  <Package className="w-3.5 h-3.5 text-gray-600 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <span className="text-[10px] font-bold text-gray-700 block truncate">
                      {currentItem.description}
                    </span>
                    <span className="text-[9px] font-medium text-gray-400">
                      {currentItem.sku} • Invoice Qty: {currentItem.invoiceQty} {currentItem.uom}
                    </span>
                  </div>
                </div>

                {/* Currently selected */}
                {currentItem.glAccount && (
                  <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-blue-50/60 border border-blue-100 mb-3">
                    <Check className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                    <span className="text-[11px] font-bold text-blue-700">Current: {currentItem.glAccount}</span>
                  </div>
                )}

                {/* Search */}
                <div className="relative">
                  <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <Input 
                    value={poGlModalSearch}
                    onChange={(e) => setPoGlModalSearch(e.target.value)}
                    placeholder="Search by account code or name..."
                    className="h-[34px] pl-9 bg-gray-50 border-gray-200 text-[11px] font-medium shadow-none rounded-lg focus-visible:ring-1 focus-visible:ring-blue-200"
                    autoFocus
                  />
                </div>
              </div>

              {/* Account List */}
              <div className="flex-1 overflow-y-auto px-3 py-2 custom-scrollbar">
                {filteredGLAccounts.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-10 text-gray-400">
                    <Search className="w-5 h-5 mb-2 text-gray-300" />
                    <span className="text-[11px] font-medium">No accounts match your search</span>
                  </div>
                ) : (
                  Object.entries(glGrouped).map(([category, accounts]) => (
                    <div key={category} className="mb-2">
                      <div className="sticky top-0 z-10 bg-white px-2 py-1.5">
                        <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest">{category}</span>
                      </div>
                      <div className="space-y-0.5">
                        {accounts.map((account) => {
                          const isSelected = currentItem.glAccount === account;
                          const code = account.split(' ')[0];
                          const name = account.substring(code.length + 1);
                          return (
                            <button
                              key={account}
                              onClick={() => {
                                updateLineItem(currentItem.id, 'glAccount', account);
                                setPoGlConfigModalItemId(null);
                              }}
                              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all text-left group/item ${
                                isSelected 
                                  ? 'bg-blue-50 border border-blue-200' 
                                  : 'hover:bg-gray-50 border border-transparent'
                              }`}
                            >
                              <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 transition-colors ${
                                isSelected ? 'bg-blue-600 border-blue-600' : 'border-gray-200 group-hover/item:border-gray-300'
                              }`}>
                                {isSelected && <Check className="w-3 h-3 text-white" />}
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                  <span className={`text-[11px] font-black tracking-tight ${isSelected ? 'text-blue-700' : 'text-gray-600'}`}>{code}</span>
                                  <span className={`text-[11px] font-medium truncate ${isSelected ? 'text-blue-600' : 'text-gray-500'}`}>{name}</span>
                                </div>
                              </div>
                              <span className="text-[9px] font-bold text-gray-300 uppercase tracking-wider shrink-0">DR</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* Modal Footer */}
              <div className="px-5 py-3 border-t border-gray-100 bg-gray-50/50 flex items-center justify-between">
                <span className="text-[10px] text-gray-400 font-medium">{filteredGLAccounts.length} account{filteredGLAccounts.length !== 1 ? 's' : ''} available</span>
                <div className="flex items-center gap-2">
                  <Button 
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      if (currentItem?.glAccount) {
                        updateLineItem(currentItem.id, 'glAccount', '');
                      }
                      setPoGlConfigModalItemId(null);
                    }}
                    className="h-8 px-3 text-[10px] font-bold border-gray-200 text-gray-500 shadow-none"
                  >
                    {currentItem?.glAccount ? 'Clear & Close' : 'Cancel'}
                  </Button>
                  <Button 
                    size="sm"
                    onClick={() => setPoGlConfigModalItemId(null)}
                    className="h-8 px-4 text-[10px] font-bold bg-gray-900 hover:bg-gray-800 text-white shadow-none"
                  >
                    Done
                  </Button>
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* A/P Configuration Modal */}
      {apConfigModalOpen && (() => {
        const filteredAPAccounts = AP_ACCOUNTS.filter(a =>
          a.toLowerCase().includes(apModalSearch.toLowerCase())
        );

        // Group A/P accounts by sub-category
        const apGrouped: Record<string, string[]> = {};
        filteredAPAccounts.forEach(account => {
          const code = parseInt(account.split(' ')[0]);
          let category = 'Other Liabilities';
          if (code >= 2000 && code < 2100) category = 'Accounts Payable';
          else if (code >= 2100 && code < 2200) category = 'Accrued Liabilities';
          else if (code >= 2200 && code < 2600) category = 'Other Current Liabilities';
          else if (code >= 2500) category = 'Tax Liabilities';
          if (!apGrouped[category]) apGrouped[category] = [];
          apGrouped[category].push(account);
        });

        const vendorCategory = standaloneVendor?.vendorCategory || vendorData?.category || '';
        const defaultAP = VENDOR_AP_MAPPING[vendorCategory] || VENDOR_AP_MAPPING['default'];

        return (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[110] flex items-center justify-center p-4" onClick={() => setApConfigModalOpen(false)}>
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-[520px] max-h-[80vh] flex flex-col overflow-hidden border border-gray-200" onClick={(e) => e.stopPropagation()}>
              
              {/* Modal Header */}
              <div className="px-5 pt-5 pb-3 border-b border-gray-100">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-emerald-50 border border-emerald-100 flex items-center justify-center">
                      <Wallet className="w-4 h-4 text-emerald-600" />
                    </div>
                    <div>
                      <h3 className="text-[13px] font-bold text-gray-900">A/P Configuration</h3>
                      <p className="text-[10px] text-gray-400 font-medium">Select the accounts payable account to credit</p>
                    </div>
                  </div>
                  <button 
                    onClick={() => setApConfigModalOpen(false)}
                    className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors text-gray-400 hover:text-gray-600"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                {/* Vendor auto-assignment info */}
                <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-emerald-50/60 border border-emerald-100 mb-3">
                  <Building2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <span className="text-[10px] font-bold text-emerald-700">
                      Vendor default: {defaultAP}
                    </span>
                    {apAccount !== defaultAP && (
                      <span className="text-[9px] font-medium text-amber-600 ml-2">• Overridden</span>
                    )}
                  </div>
                  {apAccount !== defaultAP && (
                    <button 
                      onClick={() => setApAccount(defaultAP)}
                      className="text-[9px] font-bold text-emerald-600 hover:text-emerald-700 underline shrink-0"
                    >
                      Reset
                    </button>
                  )}
                </div>

                {/* Currently selected */}
                {apAccount && (
                  <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-blue-50/60 border border-blue-100 mb-3">
                    <Check className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                    <span className="text-[11px] font-bold text-blue-700">Current: {apAccount}</span>
                  </div>
                )}

                {/* Search */}
                <div className="relative">
                  <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <Input 
                    value={apModalSearch}
                    onChange={(e) => setApModalSearch(e.target.value)}
                    placeholder="Search by account code or name..."
                    className="h-[34px] pl-9 bg-gray-50 border-gray-200 text-[11px] font-medium shadow-none rounded-lg focus-visible:ring-1 focus-visible:ring-emerald-200"
                    autoFocus
                  />
                </div>
              </div>

              {/* Account List */}
              <div className="flex-1 overflow-y-auto px-3 py-2 custom-scrollbar">
                {filteredAPAccounts.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-10 text-gray-400">
                    <Search className="w-5 h-5 mb-2 text-gray-300" />
                    <span className="text-[11px] font-medium">No accounts match your search</span>
                  </div>
                ) : (
                  Object.entries(apGrouped).map(([category, accounts]) => (
                    <div key={category} className="mb-2">
                      <div className="sticky top-0 z-10 bg-white px-2 py-1.5">
                        <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest">{category}</span>
                      </div>
                      <div className="space-y-0.5">
                        {accounts.map((account) => {
                          const isSelected = apAccount === account;
                          const isDefault = account === defaultAP;
                          const code = account.split(' ')[0];
                          const name = account.substring(code.length + 1);
                          return (
                            <button
                              key={account}
                              onClick={() => {
                                setApAccount(account);
                                setApConfigModalOpen(false);
                              }}
                              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all text-left group/item ${
                                isSelected 
                                  ? 'bg-blue-50 border border-blue-200' 
                                  : 'hover:bg-gray-50 border border-transparent'
                              }`}
                            >
                              <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 transition-colors ${
                                isSelected ? 'bg-blue-600 border-blue-600' : 'border-gray-200 group-hover/item:border-gray-300'
                              }`}>
                                {isSelected && <Check className="w-3 h-3 text-white" />}
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                  <span className={`text-[11px] font-black tracking-tight ${isSelected ? 'text-blue-700' : 'text-gray-600'}`}>{code}</span>
                                  <span className={`text-[11px] font-medium truncate ${isSelected ? 'text-blue-600' : 'text-gray-500'}`}>{name}</span>
                                  {isDefault && (
                                    <span className="text-[8px] font-bold text-emerald-600 bg-emerald-50 border border-emerald-100 px-1.5 py-0.5 rounded-full uppercase tracking-wider shrink-0">Default</span>
                                  )}
                                </div>
                              </div>
                              <span className="text-[9px] font-bold text-gray-300 uppercase tracking-wider shrink-0">CR</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* Modal Footer */}
              <div className="px-5 py-3 border-t border-gray-100 bg-gray-50/50 flex items-center justify-between">
                <span className="text-[10px] text-gray-400 font-medium">{filteredAPAccounts.length} account{filteredAPAccounts.length !== 1 ? 's' : ''} available</span>
                <div className="flex items-center gap-2">
                  <Button 
                    variant="outline"
                    size="sm"
                    onClick={() => setApConfigModalOpen(false)}
                    className="h-8 px-3 text-[10px] font-bold border-gray-200 text-gray-500 shadow-none"
                  >
                    Cancel
                  </Button>
                  <Button 
                    size="sm"
                    onClick={() => setApConfigModalOpen(false)}
                    className="h-8 px-4 text-[10px] font-bold bg-gray-900 hover:bg-gray-800 text-white shadow-none"
                  >
                    Done
                  </Button>
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      <style dangerouslySetInnerHTML={{ __html: `
        .custom-scrollbar::-webkit-scrollbar {
          width: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #E2E8F0;
          border-radius: 10px;
        }
        .scrollbar-hide::-webkit-scrollbar {
          display: none;
        }
      `}} />
    </div>
  );
}

function AddItemFromPOModal({ 
  isOpen, 
  onClose, 
  poData, 
  currentItems, 
  onAdd 
}: { 
  isOpen: boolean; 
  onClose: () => void; 
  poData: VendorPO | null; 
  currentItems: MockLineItem[]; 
  onAdd: (items: MockLineItem[]) => void;
}) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const currentItemIds = new Set(currentItems.map(i => i.id));
  
  const availableItems = poData?.items.filter(item => !currentItemIds.has(item.id)) || [];

  const toggleSelection = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedIds(next);
  };

  const handleAdd = () => {
    const itemsToAdd = availableItems.filter(i => selectedIds.has(i.id));
    onAdd(itemsToAdd);
    setSelectedIds(new Set());
  };

  if (!isOpen || !poData) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-md z-[100] flex items-center justify-center p-4">
      <div className="bg-white rounded-[24px] shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[85vh] animate-in zoom-in-95 duration-300 border border-gray-100">
        <div className="px-8 py-6 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
          <div>
            <h3 className="text-[16px] font-black text-gray-900 tracking-tighter">Add items from {poData.poNumber}</h3>
            <p className="text-[11px] text-gray-500 font-bold mt-1 tracking-widest">{availableItems.length} available line items</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-200 rounded-full transition-all">
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>
        
        <div className="flex-1 overflow-y-auto p-4 space-y-2 custom-scrollbar">
          {availableItems.length === 0 ? (
            <div className="py-20 text-center">
              <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-4 border border-dashed border-gray-200">
                <Package className="w-8 h-8 text-gray-200" />
              </div>
              <p className="text-[12px] font-black text-gray-400 tracking-widest">All PO items are currently active</p>
              <p className="text-[10px] text-gray-400 mt-2">No additional items were found for this purchase order.</p>
            </div>
          ) : (
            <div className="border border-gray-100 rounded-xl overflow-hidden">
              <table className="w-full text-left">
                <thead className="bg-white border-b border-gray-100 text-[10px] font-black text-gray-400 tracking-widest">
                  <tr>
                    <th className="px-4 py-3 w-12 text-center">
                      <Checkbox 
                        checked={selectedIds.size === availableItems.length}
                        onCheckedChange={() => {
                          if (selectedIds.size === availableItems.length) setSelectedIds(new Set());
                          else setSelectedIds(new Set(availableItems.map(i => i.id)));
                        }}
                      />
                    </th>
                    <th className="px-4 py-3">Item / SKU</th>
                    <th className="px-4 py-3 text-right">Quantity</th>
                    <th className="px-4 py-3 text-right">Unit Price</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {availableItems.map((item) => (
                    <tr 
                      key={item.id} 
                      className={`hover:bg-gray-50/50 cursor-pointer transition-colors ${selectedIds.has(item.id) ? 'bg-blue-50/30' : ''}`}
                      onClick={() => toggleSelection(item.id)}
                    >
                      <td className="px-4 py-3 text-center" onClick={(e) => e.stopPropagation()}>
                        <Checkbox 
                          checked={selectedIds.has(item.id)}
                          onCheckedChange={() => toggleSelection(item.id)}
                        />
                      </td>
                      <td className="px-4 py-3">
                        <p className="text-[12px] font-bold text-gray-900 leading-tight">{item.description}</p>
                        <p className="text-[10px] text-gray-400 font-medium mt-0.5 uppercase tracking-tighter">{item.sku}</p>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className="text-[12px] font-black text-gray-900">{item.quantity} {item.uom}</span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className="text-[12px] font-bold text-gray-600">${item.unitPrice.toFixed(2)}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="px-8 py-6 border-t border-gray-100 bg-gray-50/50 flex items-center justify-between">
          <div className="text-[11px] font-bold text-gray-400 tracking-wider">
            {selectedIds.size} ITEMS SELECTED
          </div>
          <div className="flex gap-3">
            <Button variant="outline" onClick={onClose} className="h-10 px-6 font-black text-[11px] tracking-widest uppercase border-gray-200">
              Cancel
            </Button>
            <Button 
              onClick={handleAdd}
              disabled={selectedIds.size === 0}
              className="h-10 px-8 font-black text-[11px] tracking-widest uppercase bg-blue-600 hover:bg-blue-700 shadow-lg shadow-blue-200"
            >
              Add items
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
