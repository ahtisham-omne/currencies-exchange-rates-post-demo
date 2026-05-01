import React, { useState, useMemo, useEffect } from 'react';
import { X, Search, ChevronRight, ChevronDown, Maximize2, Minimize2, ShoppingCart, Package, Building2, AlertTriangle, Filter, Calendar, User, Tag, RotateCcw, CheckCircle2, Info } from 'lucide-react';
import { Button } from '@/app/components/ui/button';
import { Input } from '@/app/components/ui/input';
import { Checkbox } from '@/app/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/app/components/ui/select';
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/app/components/ui/hover-card";
import { mockVendors, Vendor, VendorPO, VendorGRN, LineItem } from '@/app/data/mockVendors';
import { Tooltip, TooltipTrigger, TooltipContent } from '@/app/components/ui/tooltip';
import { ImageWithFallback } from '@/app/components/figma/ImageWithFallback';
import { VIMoneyCell } from '@/app/components/currency/VIMoneyCell';

// Material UI Imports
import dayjs from 'dayjs';
import type { Dayjs } from 'dayjs';

interface VendorSelectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onContinue: (selectedData: SelectedPOData[]) => void;
  fixedVendorId?: string; // New: lock to a specific vendor
}

export interface SelectedPOData {
  vendorCode: string;
  vendorName: string;
  vendorCategory: string;
  currency: string;
  paymentTerms: string;
  poNumber: string;
  poDate: string;
  poAmount: number;
  poStatus: string;
  itemCount: number;
  isPreInvoice: boolean;
  relatedGRNs: VendorGRN[];
  items: LineItem[];
  selectedItemIds: string[]; // New: track which specific items were selected
  selectedGRNItemIds?: string[]; // New: track which specific GRN items were selected (grnNumber:itemId)
}

type FilterType = 'all' | 'vendor' | 'po' | 'grn' | 'item';

export function VendorSelectionModalNested(props: VendorSelectionModalProps) {
  const { isOpen, onClose, onContinue, fixedVendorId } = props;
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [vendorSearch, setVendorSearch] = useState('');
  const [poSearch, setPoSearch] = useState('');
  const [grnSearch, setGrnSearch] = useState('');
  const [itemSearch, setItemSearch] = useState('');
  
  // Set initial expanded vendor if fixedVendorId is provided
  const [expandedVendors, setExpandedVendors] = useState<Set<string>>(new Set(fixedVendorId ? [fixedVendorId] : []));
  const [expandedPOs, setExpandedPOs] = useState<Set<string>>(new Set());
  const [expandedGRNs, setExpandedGRNs] = useState<Set<string>>(new Set());
  const [selectedPOs, setSelectedPOs] = useState<Set<string>>(new Set());
  const [selectedItemIds, setSelectedItemIds] = useState<Set<string>>(new Set());
  const [selectedGRNs, setSelectedGRNs] = useState<Set<string>>(new Set());
  const [selectedGRNItems, setSelectedGRNItems] = useState<Set<string>>(new Set());
  const [collapsedPOItemTables, setCollapsedPOItemTables] = useState<Set<string>>(new Set());
  const [showAlert, setShowAlert] = useState<{ show: boolean, msg: string, type: 'info' | 'warning' }>({ show: false, msg: '', type: 'info' });

  // Multi-vendor validation - Simplified and robust
  const selectedVendorCount = useMemo(() => {
    const activeVendors = new Set<string>();
    
    // We derive vendor codes directly from selected item IDs
    // ID format: item-V-01000-0-0
    selectedItemIds.forEach(id => {
      const parts = id.split('-');
      if (parts.length >= 3) {
        activeVendors.add(`${parts[1]}-${parts[2]}`);
      }
    });

    // Also check GRN items (which follow same ID format after the colon)
    selectedGRNItems.forEach(key => {
      const parts = key.split(':');
      if (parts.length >= 2) {
        const idParts = parts[1].split('-');
        if (idParts.length >= 3) {
          activeVendors.add(`${idParts[1]}-${idParts[2]}`);
        }
      }
    });

    return activeVendors.size;
  }, [selectedItemIds, selectedGRNItems]);

  // Sync Alert with selection state
  useEffect(() => {
    // Reset alert by default
    if (selectedVendorCount > 1) {
      setShowAlert({ 
        show: true, 
        type: 'warning', 
        msg: "Multiple vendors selected. You can only create an invoice against a single vendor at a time. Please deselect items from other vendors to continue." 
      });
    } else if (selectedGRNItems.size >= 2) {
      const selectedGRNNums = new Set<string>();
      const selectedPONums = new Set<string>();

      selectedGRNItems.forEach(key => {
        const [grnNumber] = key.split(':');
        selectedGRNNums.add(grnNumber);
        
        // Find the PO associated with this GRN
        for (const vendor of mockVendors) {
          const grn = vendor.receivingDocuments.find(g => g.grnNumber === grnNumber);
          if (grn) {
            selectedPONums.add(grn.poNumber);
            break;
          }
        }
      });

      if (selectedGRNNums.size >= 2 && selectedPONums.size >= 2) {
        setShowAlert({ 
          show: true, 
          type: 'info', 
          msg: "Selected items will be grouped by their respective Purchase Orders in the next step." 
        });
      } else {
        setShowAlert(prev => prev.type === 'warning' ? { ...prev, show: false } : prev);
      }
    } else {
      setShowAlert(prev => ({ ...prev, show: false }));
    }
  }, [selectedVendorCount, selectedGRNItems]);

  // New Filters
  const [selectedCreatedBy, setSelectedCreatedBy] = useState<string>('all');
  const [selectedPOStatus, setSelectedPOStatus] = useState<string>('all');
  const [selectedType, setSelectedType] = useState<string>('all');
  const [selectedDate, setSelectedDate] = useState<string>('');
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [showClosedPOs, setShowClosedPOs] = useState(false);

  // Advanced Search Modes
  const [vendorFilterMode, setVendorFilterMode] = useState<'include' | 'exclude'>('include');
  const [vendorActiveOnly, setVendorActiveOnly] = useState(false);
  const [poFilterMode, setPoFilterMode] = useState<'include' | 'exclude'>('include');
  const [grnFilterMode, setGrnFilterMode] = useState<'include' | 'exclude'>('include');
  const [itemFilterMode, setItemFilterMode] = useState<'include' | 'exclude'>('include');
  const [showAllItems, setShowAllItems] = useState(false);
  const [showReceivedOnly, setShowReceivedOnly] = useState(false);
  
  // Date Range
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  
  // Popover states
  const [activePopover, setActivePopover] = useState<string | null>(null);

  // Image preview state
  const [previewImage, setPreviewImage] = useState<{ src: string, alt: string } | null>(null);

  const toggleVendor = (vendorId: string) => {
    const newExpanded = new Set(expandedVendors);
    if (newExpanded.has(vendorId)) {
      newExpanded.delete(vendorId);
    } else {
      newExpanded.add(vendorId);
    }
    setExpandedVendors(newExpanded);
  };

  const togglePO = (poKey: string) => {
    const newExpanded = new Set(expandedPOs);
    if (newExpanded.has(poKey)) {
      newExpanded.delete(poKey);
    } else {
      newExpanded.add(poKey);
    }
    setExpandedPOs(newExpanded);
  };

  const toggleGRN = (grnKey: string) => {
    const newExpanded = new Set(expandedGRNs);
    if (newExpanded.has(grnKey)) {
      newExpanded.delete(grnKey);
    } else {
      newExpanded.add(grnKey);
    }
    setExpandedGRNs(newExpanded);
  };

  const togglePOSelection = (poKey: string, vendor: Vendor, po: VendorPO) => {
    const newSelectedPOs = new Set(selectedPOs);
    const newSelectedItemIds = new Set(selectedItemIds);
    const newSelectedGRNs = new Set(selectedGRNs);
    const newSelectedGRNItems = new Set(selectedGRNItems);
    
    // Check if the PO is currently fully selected
    const isCurrentlyFullySelected = po.items.every(item => newSelectedItemIds.has(item.id));
    
    if (isCurrentlyFullySelected) {
      // Unselect everything in this PO
      newSelectedPOs.delete(poKey);
      po.items.forEach(item => newSelectedItemIds.delete(item.id));
      vendor.receivingDocuments.filter(g => g.poNumber === po.poNumber).forEach(grn => {
        newSelectedGRNs.delete(grn.grnNumber);
        grn.items.forEach(item => {
          newSelectedGRNItems.delete(`${grn.grnNumber}:${item.id}`);
        });
      });
    } else {
      // Select everything in this PO
      newSelectedPOs.add(poKey);
      po.items.forEach(item => newSelectedItemIds.add(item.id));
      vendor.receivingDocuments.filter(g => g.poNumber === po.poNumber).forEach(grn => {
        newSelectedGRNs.add(grn.grnNumber);
        grn.items.forEach(item => {
          newSelectedGRNItems.add(`${grn.grnNumber}:${item.id}`);
        });
      });
    }
    
    setSelectedPOs(newSelectedPOs);
    setSelectedItemIds(newSelectedItemIds);
    setSelectedGRNs(newSelectedGRNs);
    setSelectedGRNItems(newSelectedGRNItems);
  };

  const toggleGRNSelection = (grnNumber: string, poKey: string, po: VendorPO, grn: VendorGRN) => {
    const newSelectedGRNs = new Set(selectedGRNs);
    const newSelectedItemIds = new Set(selectedItemIds);
    const newSelectedPOs = new Set(selectedPOs);
    const newSelectedGRNItems = new Set(selectedGRNItems);

    if (newSelectedGRNs.has(grnNumber)) {
      newSelectedGRNs.delete(grnNumber);
      // Deselect all items in this GRN
      grn.items.forEach(item => {
        const itemKey = `${grn.grnNumber}:${item.id}`;
        newSelectedGRNItems.delete(itemKey);
        
        // Only deselect from PO items if no other selected GRN contains this item SKU
        const poItem = po.items.find(i => i.sku === item.sku);
        if (poItem) {
          const isItemInOtherSelectedGRN = Array.from(newSelectedGRNItems).some(k => {
            const [gNum] = k.split(':');
            const otherGrn = mockVendors.flatMap(v => v.receivingDocuments).find(g => g.grnNumber === gNum);
            return otherGrn?.poNumber === po.poNumber && otherGrn.items.some(i => i.sku === item.sku);
          });
          if (!isItemInOtherSelectedGRN) newSelectedItemIds.delete(poItem.id);
        }
      });

      // Update PO selection state based on items
      const anyItemInPOSelected = po.items.some(i => newSelectedItemIds.has(i.id));
      if (!anyItemInPOSelected) {
        newSelectedPOs.delete(poKey);
      }
    } else {
      newSelectedGRNs.add(grnNumber);
      // Select all items in this GRN
      grn.items.forEach(item => {
        newSelectedGRNItems.add(`${grn.grnNumber}:${item.id}`);
        const poItem = po.items.find(i => i.sku === item.sku);
        if (poItem) newSelectedItemIds.add(poItem.id);
      });
      newSelectedPOs.add(poKey);
    }

    setSelectedGRNs(newSelectedGRNs);
    setSelectedGRNItems(newSelectedGRNItems);
    setSelectedItemIds(newSelectedItemIds);
    setSelectedPOs(newSelectedPOs);
  };

  const toggleGRNItemSelection = (item: LineItem, grn: VendorGRN, po: VendorPO, poKey: string) => {
    const newSelectedGRNItems = new Set(selectedGRNItems);
    const newSelectedGRNs = new Set(selectedGRNs);
    const newSelectedItemIds = new Set(selectedItemIds);
    const newSelectedPOs = new Set(selectedPOs);
    
    const key = `${grn.grnNumber}:${item.id}`;
    
    if (newSelectedGRNItems.has(key)) {
      newSelectedGRNItems.delete(key);
      // If all items in GRN are deselected, deselect the GRN
      const anyOtherItemInGRNSelected = grn.items.some(i => newSelectedGRNItems.has(`${grn.grnNumber}:${i.id}`));
      if (!anyOtherItemInGRNSelected) {
        newSelectedGRNs.delete(grn.grnNumber);
      }
      
      // Check if this item SKU exists in other selected GRN items before deselecting from PO level
      const poItem = po.items.find(i => i.sku === item.sku);
      if (poItem) {
        const isItemInOtherSelectedGRN = Array.from(newSelectedGRNItems).some(k => {
          const [gNum] = k.split(':');
          const otherGrn = mockVendors.flatMap(v => v.receivingDocuments).find(g => g.grnNumber === gNum);
          return otherGrn?.poNumber === po.poNumber && otherGrn.items.some(i => i.sku === item.sku);
        });
        if (!isItemInOtherSelectedGRN) newSelectedItemIds.delete(poItem.id);
      }
    } else {
      newSelectedGRNItems.add(key);
      newSelectedGRNs.add(grn.grnNumber);
      newSelectedPOs.add(poKey);
      
      const poItem = po.items.find(i => i.sku === item.sku);
      if (poItem) newSelectedItemIds.add(poItem.id);
    }
    
    // Update PO selection state
    const anyItemInPOSelected = po.items.some(i => newSelectedItemIds.has(i.id));
    if (anyItemInPOSelected) {
      newSelectedPOs.add(poKey);
    } else {
      newSelectedPOs.delete(poKey);
    }
    
    setSelectedGRNItems(newSelectedGRNItems);
    setSelectedGRNs(newSelectedGRNs);
    setSelectedItemIds(newSelectedItemIds);
    setSelectedPOs(newSelectedPOs);
  };

  const toggleItemTableCollapse = (poKey: string) => {
    const newCollapsed = new Set(collapsedPOItemTables);
    if (newCollapsed.has(poKey)) {
      newCollapsed.delete(poKey);
    } else {
      newCollapsed.add(poKey);
    }
    setCollapsedPOItemTables(newCollapsed);
  };

  const toggleItemSelection = (item: LineItem, poKey: string, po: VendorPO, vendor: Vendor) => {
    const newSelectedItemIds = new Set(selectedItemIds);
    const newSelectedPOs = new Set(selectedPOs);
    const newSelectedGRNItems = new Set(selectedGRNItems);
    const newSelectedGRNs = new Set(selectedGRNs);
    
    const isSelecting = !newSelectedItemIds.has(item.id);
    
    if (isSelecting) {
      newSelectedItemIds.add(item.id);
      // Select related GRN items
      vendor.receivingDocuments.filter(grn => grn.poNumber === po.poNumber).forEach(grn => {
        const grnItem = grn.items.find(i => i.sku === item.sku);
        if (grnItem) {
          // Rule: Vendor invoices must always match the vendor's actual invoice amount.
          // When partial receipts exist, we select the GRN item, but the system 
          // logic in CreateInvoiceScreen/Final step will handle the split.
          newSelectedGRNItems.add(`${grn.grnNumber}:${grnItem.id}`);
          newSelectedGRNs.add(grn.grnNumber);
        }
      });
    } else {
      newSelectedItemIds.delete(item.id);
      // Deselect related GRN items
      vendor.receivingDocuments.filter(grn => grn.poNumber === po.poNumber).forEach(grn => {
        const grnItem = grn.items.find(i => i.sku === item.sku);
        if (grnItem) {
          newSelectedGRNItems.delete(`${grn.grnNumber}:${grnItem.id}`);
          // Check if GRN still has selected items
          const hasOtherItems = grn.items.some(i => newSelectedGRNItems.has(`${grn.grnNumber}:${i.id}`));
          if (!hasOtherItems) newSelectedGRNs.delete(grn.grnNumber);
        }
      });
    }
    
    // Update PO selection state based on items
    const anyItemInPOSelected = po.items.some(i => newSelectedItemIds.has(i.id));
    if (anyItemInPOSelected) {
      newSelectedPOs.add(poKey);
    } else {
      newSelectedPOs.delete(poKey);
    }
    
    setSelectedItemIds(newSelectedItemIds);
    setSelectedPOs(newSelectedPOs);
    setSelectedGRNItems(newSelectedGRNItems);
    setSelectedGRNs(newSelectedGRNs);
  };

  const selectAllVendorPOs = (vendor: Vendor, select: boolean) => {
    const newSelectedPOs = new Set(selectedPOs);
    const newSelectedItemIds = new Set(selectedItemIds);
    const newSelectedGRNs = new Set(selectedGRNs);
    const newSelectedGRNItems = new Set(selectedGRNItems);
    
    vendor.purchaseOrders.forEach(po => {
      const poKey = `${vendor.vendorCode}-${po.poNumber}`;
      const relatedGRNs = vendor.receivingDocuments.filter(g => g.poNumber === po.poNumber);
      if (select) {
        newSelectedPOs.add(poKey);
        po.items.forEach(item => newSelectedItemIds.add(item.id));
        relatedGRNs.forEach(grn => {
          newSelectedGRNs.add(grn.grnNumber);
          grn.items.forEach(item => newSelectedGRNItems.add(`${grn.grnNumber}:${item.id}`));
        });
      } else {
        newSelectedPOs.delete(poKey);
        po.items.forEach(item => newSelectedItemIds.delete(item.id));
        // Also deselect all associated GRNs and their items
        relatedGRNs.forEach(grn => {
          newSelectedGRNs.delete(grn.grnNumber);
          grn.items.forEach(item => newSelectedGRNItems.delete(`${grn.grnNumber}:${item.id}`));
        });
      }
    });
    
    setSelectedPOs(newSelectedPOs);
    setSelectedItemIds(newSelectedItemIds);
    setSelectedGRNs(newSelectedGRNs);
    setSelectedGRNItems(newSelectedGRNItems);
  };

  // Sync Alert with selection state
  // Calculate statistics for each vendor
  const vendorStats = useMemo(() => {
    return mockVendors.map(v => {
      const totalPOAmount = v.purchaseOrders.reduce((sum, po) => sum + po.poAmount, 0);
      const totalInvoicedAmount = v.purchaseOrders.reduce((sum, po) => sum + (po.invoicedAmount || 0), 0);
      const totalOpenAmount = totalPOAmount - totalInvoicedAmount;
      const poCount = v.purchaseOrders.length;
      const grnCount = v.receivingDocuments.length;
      
      return {
        id: v.id,
        totalPOAmount,
        totalInvoicedAmount,
        totalOpenAmount,
        poCount,
        grnCount
      };
    });
  }, []);

  const highlightText = (text: string, query: string) => {
    if (!query.trim()) return text;
    
    const parts = text.split(new RegExp(`(${query})`, 'gi'));
    return (
      <>
        {parts.map((part, index) => 
          part.toLowerCase() === query.toLowerCase() ? (
            <mark key={index} className="bg-yellow-200 text-gray-900 font-semibold">
              {part}
            </mark>
          ) : (
            part
          )
        )}
      </>
    );
  };

  const clearAllFilters = () => {
    setVendorSearch('');
    setPoSearch('');
    setGrnSearch('');
    setItemSearch('');
    setSelectedCreatedBy('all');
    setSelectedPOStatus('all');
    setSelectedType('all');
    setSelectedDate('');
    setShowClosedPOs(false);
    setVendorFilterMode('include');
    setVendorActiveOnly(false);
    setPoFilterMode('include');
    setGrnFilterMode('include');
    setItemFilterMode('include');
    setShowAllItems(false);
    setShowReceivedOnly(false);
    setStartDate('');
    setEndDate('');
  };

  const filteredVendors = useMemo(() => {
    let vendors = fixedVendorId 
      ? mockVendors.filter(v => v.id === fixedVendorId)
      : mockVendors;

    // Filter by vendor search if not fixed
    if (!fixedVendorId && vendorSearch.trim()) {
      vendors = vendors.filter(v => {
        const matchesSearch = v.vendorName.toLowerCase().includes(vendorSearch.toLowerCase()) || 
                             v.vendorCode.toLowerCase().includes(vendorSearch.toLowerCase());
        return vendorFilterMode === 'include' ? matchesSearch : !matchesSearch;
      });
    }

    if (selectedCreatedBy !== 'all') {
      vendors = vendors.filter(v => v.createdBy === selectedCreatedBy);
    }

    if (selectedPOStatus !== 'all') {
      vendors = vendors.filter(v => v.purchaseOrders.some(po => po.status === selectedPOStatus));
    }

    if (selectedType !== 'all') {
      vendors = vendors.filter(v => v.type === selectedType);
    }

    if (selectedDate) {
      vendors = vendors.filter(v => v.createdOn === selectedDate);
    }

    // Parallel Search Logic across Vendors, POs, GRNs, and Items
    return vendors.map(v => {
      // 1. Filter POs by poSearch AND itemSearch AND showClosedPOs AND dateRange AND showReceivedOnly
      const filteredPOs = v.purchaseOrders.filter(po => {
        // ERP Logic: By default hide Closed/Cancelled/Fully-Settled. If toggled, show everything.
        const isPOFullyInvoiced = (po.invoicedAmount || 0) >= po.poAmount && po.poAmount > 0;
        const isPOFullyReceived = po.status === 'Fully Received' || po.status === 'Fully Invoiced' || po.items.every(item => (item.receivedQty || 0) >= item.quantity);
        const isActuallyClosed = po.status === 'Closed' || po.status === 'Cancelled' || po.status === 'Fully Invoiced' || (isPOFullyReceived && isPOFullyInvoiced);
        
        if (!showClosedPOs && isActuallyClosed) return false;

        // Received Only logic
        if (showReceivedOnly) {
          const hasGRN = v.receivingDocuments.some(grn => grn.poNumber === po.poNumber);
          if (!hasGRN) return false;
        }

        // Date range filter (Inclusive)
        if (startDate) {
          const start = new Date(startDate);
          start.setHours(0, 0, 0, 0);
          const poDate = new Date(po.poDate);
          if (poDate < start) return false;
        }
        if (endDate) {
          const end = new Date(endDate);
          end.setHours(23, 59, 59, 999);
          const poDate = new Date(po.poDate);
          if (poDate > end) return false;
        }

        const matchesPOQuery = poSearch.trim() 
          ? po.poNumber.toLowerCase().includes(poSearch.toLowerCase()) 
          : true;
          
        const poSearchFinal = poFilterMode === 'include' ? matchesPOQuery : !matchesPOQuery;

        const matchesItemQuery = itemSearch.trim()
          ? po.items.some(item => 
              item.sku.toLowerCase().includes(itemSearch.toLowerCase()) || 
              item.description.toLowerCase().includes(itemSearch.toLowerCase())
            )
          : true;
          
        const itemSearchFinal = itemFilterMode === 'include' ? matchesItemQuery : !matchesItemQuery;

        return poSearchFinal && itemSearchFinal;
      });

      // 2. Filter GRNs by grnSearch AND itemSearch AND dateRange
      const filteredGRNs = v.receivingDocuments.filter(grn => {
        // Date range filter for GRNs (Inclusive)
        if (startDate) {
          const start = new Date(startDate);
          start.setHours(0, 0, 0, 0);
          const grnDate = new Date(grn.grnDate);
          if (grnDate < start) return false;
        }
        if (endDate) {
          const end = new Date(endDate);
          end.setHours(23, 59, 59, 999);
          const grnDate = new Date(grn.grnDate);
          if (grnDate > end) return false;
        }

        const matchesGRNQuery = grnSearch.trim()
          ? grn.grnNumber.toLowerCase().includes(grnSearch.toLowerCase())
          : true;
          
        const grnSearchFinal = grnFilterMode === 'include' ? matchesGRNQuery : !matchesGRNQuery;

        const matchesItemQuery = itemSearch.trim()
          ? grn.items.some(item => 
              item.sku.toLowerCase().includes(itemSearch.toLowerCase()) || 
              item.description.toLowerCase().includes(itemSearch.toLowerCase())
            )
          : true;
          
        const itemSearchFinal = itemFilterMode === 'include' ? matchesItemQuery : !matchesItemQuery;

        return grnSearchFinal && itemSearchFinal;
      });

      // 3. Check Vendor match
      const rawVendorMatch = vendorSearch.trim()
        ? (v.vendorName.toLowerCase().includes(vendorSearch.toLowerCase()) ||
           v.vendorCode.toLowerCase().includes(vendorSearch.toLowerCase()) ||
           v.category.toLowerCase().includes(vendorSearch.toLowerCase()))
        : true;
      
      const matchesVendorQuery = vendorFilterMode === 'include' ? rawVendorMatch : !rawVendorMatch;

      // Logic: A vendor is visible if:
      // (It matches the vendor search OR it's empty) 
      // AND (If PO/GRN/Item search is active, it must have at least one matching child)
      const hasActiveChildSearch = poSearch.trim() || grnSearch.trim() || itemSearch.trim() || startDate || endDate || showReceivedOnly;
      const hasMatchingChildren = hasActiveChildSearch 
        ? (filteredPOs.length > 0 || filteredGRNs.length > 0)
        : true;

      if (matchesVendorQuery && hasMatchingChildren) {
        return {
          ...v,
          purchaseOrders: filteredPOs,
          receivingDocuments: filteredGRNs
        };
      }
      return null;
    }).filter((v): v is Vendor => v !== null);
  }, [vendorSearch, poSearch, grnSearch, itemSearch, selectedCreatedBy, selectedPOStatus, selectedType, selectedDate, showClosedPOs, showReceivedOnly, vendorFilterMode, poFilterMode, grnFilterMode, itemFilterMode, startDate, endDate]);

  useEffect(() => {
    const hasActiveSearch = vendorSearch.trim().length >= 2 || 
                           poSearch.trim().length >= 2 || 
                           grnSearch.trim().length >= 2 || 
                           itemSearch.trim().length >= 2;

    if (hasActiveSearch) {
      const newExpandedVendors = new Set<string>();
      const newExpandedPOs = new Set<string>();

      filteredVendors.forEach(vendor => {
        let vendorShouldExpand = false;
        
        // Expansion logic for Vendor search
        if (vendorSearch.trim().length >= 2 && (
          vendor.vendorName.toLowerCase().includes(vendorSearch.toLowerCase()) ||
          vendor.vendorCode.toLowerCase().includes(vendorSearch.toLowerCase())
        )) {
          vendorShouldExpand = true;
        }

        // Expansion logic for PO search
        vendor.purchaseOrders.forEach(po => {
          const poMatch = (poSearch.trim().length >= 2 && po.poNumber.toLowerCase().includes(poSearch.toLowerCase())) ||
            (itemSearch.trim().length >= 2 && po.items.some(item => 
              item.sku.toLowerCase().includes(itemSearch.toLowerCase()) || 
              item.description.toLowerCase().includes(itemSearch.toLowerCase())
            ));
          
          if (poMatch) {
            newExpandedPOs.add(`${vendor.vendorCode}-${po.poNumber}`);
            vendorShouldExpand = true;
          }
        });

        // Expansion logic for GRN search
        vendor.receivingDocuments.forEach(grn => {
          const grnMatch = (grnSearch.trim().length >= 2 && grn.grnNumber.toLowerCase().includes(grnSearch.toLowerCase())) ||
            (itemSearch.trim().length >= 2 && grn.items.some(item => 
              item.sku.toLowerCase().includes(itemSearch.toLowerCase()) || 
              item.description.toLowerCase().includes(itemSearch.toLowerCase())
            ));
          
          if (grnMatch) {
            newExpandedPOs.add(`${vendor.vendorCode}-${grn.poNumber}`);
            vendorShouldExpand = true;
          }
        });

        if (vendorShouldExpand) {
          newExpandedVendors.add(vendor.id);
        }
      });

      if (newExpandedVendors.size > 0) {
        setExpandedVendors(prev => {
          const next = new Set(prev);
          newExpandedVendors.forEach(id => next.add(id));
          return next;
        });
      }
      
      if (newExpandedPOs.size > 0) {
        setExpandedPOs(prev => {
          const next = new Set(prev);
          newExpandedPOs.forEach(id => next.add(id));
          return next;
        });
      }
    }
  }, [vendorSearch, poSearch, grnSearch, itemSearch, filteredVendors]);

  const handleContinue = () => {
    if (!isOpen) return;
    const selectedData: SelectedPOData[] = [];
    
    filteredVendors.forEach(vendor => {
      vendor.purchaseOrders.forEach(po => {
        const poKey = `${vendor.vendorCode}-${po.poNumber}`;
        if (selectedPOs.has(poKey)) {
          const relatedGRNs = vendor.receivingDocuments.filter(grn => grn.poNumber === po.poNumber);
          
          // Only include selected items
          const itemsToPass = po.items.filter(item => selectedItemIds.has(item.id));
          
          if (itemsToPass.length > 0) {
            const poRelatedGRNs = vendor.receivingDocuments.filter(grn => grn.poNumber === po.poNumber);
            const selectedPOReceipts = poRelatedGRNs.filter(grn => selectedGRNs.has(grn.grnNumber));

            selectedData.push({
              vendorCode: vendor.vendorCode,
              vendorName: vendor.vendorName,
              vendorCategory: vendor.category,
              currency: vendor.currency,
              paymentTerms: vendor.paymentTerms,
              poNumber: po.poNumber,
              poDate: po.poDate,
              poAmount: po.poAmount,
              poStatus: po.status,
              itemCount: itemsToPass.length,
              isPreInvoice: poRelatedGRNs.length === 0,
              relatedGRNs: selectedPOReceipts.length > 0 ? selectedPOReceipts : poRelatedGRNs,
              items: itemsToPass,
              selectedItemIds: Array.from(selectedItemIds).filter(id => po.items.some(i => i.id === id)),
              selectedGRNItemIds: Array.from(selectedGRNItems).filter(key => {
                const [gNum, itemId] = key.split(':');
                return poRelatedGRNs.some(grn => grn.grnNumber === gNum);
              })
            });
          }
        }
      });
    });

    onContinue(selectedData);
  };

  const modalClasses = isFullScreen
    ? "fixed inset-0 z-50 bg-white"
    : "fixed inset-4 z-50 bg-white rounded-[24px] shadow-2xl max-w-6xl mx-auto my-auto max-h-[95vh]";

  if (!isOpen) return null;

  return (
    <>
      <div 
        className="fixed inset-0 bg-black/60 z-40"
        onClick={onClose}
      />

      <div className={modalClasses}>
        <div className="h-full flex flex-col">
              <div className="px-5 py-4 border-b border-gray-200 bg-gray-50/50 flex-shrink-0 rounded-t-[20px] rounded-b-[0px]">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h2 className="text-xl font-bold text-gray-900 tracking-tight flex items-center gap-2">
                      <div className="w-1 h-6 bg-blue-600 rounded-full" />
                      Add Items to Invoice
                    </h2>
                    <p className="text-[12px] text-gray-600 mt-1 font-medium flex items-center gap-1.5">
                      <Info className="w-3.5 h-3.5 text-blue-500" />
                      Select additional purchase orders, receiving documents, or specific line items for the current vendor. The system will automatically validate matching logic.
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setIsFullScreen(!isFullScreen)}
                      className="h-8 px-3 text-[10px] font-bold text-gray-500 hover:bg-white hover:shadow-sm transition-all uppercase tracking-wider"
                    >
                      {isFullScreen ? <Minimize2 className="w-3.5 h-3.5 mr-2" /> : <Maximize2 className="w-3.5 h-3.5 mr-2" />}
                      {isFullScreen ? 'Exit Full View' : 'Full View'}
                    </Button>
                    <div className="w-px h-4 bg-gray-200 mx-1" />
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={onClose}
                      className="h-8 w-8 p-0 hover:bg-white hover:text-red-600 hover:shadow-sm rounded-lg transition-all"
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                </div>

                <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-visible p-3.5 space-y-3.5 mt-4">
                  {/* 1. Parallel Search Fields Grid */}
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                    {/* Vendor Search (Disabled if fixedVendorId provided) */}
                    <div className="relative group">
                      <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                      <Input
                        type="text"
                        placeholder={fixedVendorId ? "Locked to current vendor" : "Search Vendors..."}
                        value={fixedVendorId ? "" : vendorSearch}
                        disabled={!!fixedVendorId}
                        onChange={(e) => setVendorSearch(e.target.value)}
                        className={`pl-9 pr-10 h-10 border-gray-200 transition-all text-xs font-semibold ${fixedVendorId ? 'bg-gray-100/50 cursor-not-allowed text-gray-400' : 'bg-gray-50/50 focus:bg-white focus:ring-2 focus:ring-blue-100'}`}
                      />
                      {!fixedVendorId && (
                        <button 
                          onClick={() => setActivePopover(activePopover === 'vendor' ? null : 'vendor')}
                          className={`absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-md transition-colors ${
                            vendorFilterMode === 'exclude' || vendorActiveOnly ? 'text-blue-600 bg-blue-50' : 'text-gray-400 hover:text-gray-600 hover:bg-gray-100'
                          }`}
                        >
                          <Filter className="w-3.5 h-3.5" />
                        </button>
                      )}
                      {activePopover === 'vendor' && (
                        <div className="absolute top-full right-0 mt-2 w-56 bg-white border border-gray-200 shadow-xl rounded-2xl p-4 z-50 animate-in fade-in zoom-in-95 duration-100">
                          <p className="text-[12px] font-semibold text-gray-500 mb-3 leading-none">Vendor filter mode</p>
                          <div className="space-y-1.5">
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              onClick={() => { setVendorFilterMode('include'); setActivePopover(null); }}
                              className={`w-full justify-start h-9 text-[13px] font-medium rounded-lg ${vendorFilterMode === 'include' ? 'text-blue-600 bg-blue-50' : 'text-gray-600 hover:bg-gray-50'}`}
                            >
                              Contains
                            </Button>
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              onClick={() => { setVendorFilterMode('exclude'); setActivePopover(null); }}
                              className={`w-full justify-start h-9 text-[13px] font-medium rounded-lg ${vendorFilterMode === 'exclude' ? 'text-red-600 bg-red-50' : 'text-gray-600 hover:bg-gray-50'}`}
                            >
                              Does not contain
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* PO Search */}
                    <div className="relative group">
                      <ShoppingCart className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                      <Input
                        type="text"
                        placeholder="Search POs..."
                        value={poSearch}
                        onChange={(e) => setPoSearch(e.target.value)}
                        className="pl-9 pr-10 h-10 bg-gray-50/50 border-gray-200 focus:bg-white focus:ring-2 focus:ring-blue-100 transition-all text-xs font-semibold"
                      />
                      <button 
                        onClick={() => setActivePopover(activePopover === 'po' ? null : 'po')}
                        className={`absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-md transition-colors ${
                          poFilterMode === 'exclude' || selectedCreatedBy !== 'all' || selectedPOStatus !== 'all' ? 'text-blue-600 bg-blue-50' : 'text-gray-400 hover:text-gray-600 hover:bg-gray-100'
                        }`}
                      >
                        <Filter className="w-3.5 h-3.5" />
                      </button>
                      {activePopover === 'po' && (
                        <div className="absolute top-full right-0 mt-2 w-72 bg-white border border-gray-200 shadow-xl rounded-2xl p-5 z-50 animate-in fade-in zoom-in-95 duration-100 space-y-5">
                          <div>
                            <p className="text-[12px] font-semibold text-gray-500 mb-3 leading-none">Filter logic</p>
                            <div className="grid grid-cols-2 gap-2">
                              <Button 
                                variant="ghost" 
                                size="sm" 
                                onClick={() => setPoFilterMode('include')}
                                className={`h-9 text-[12px] font-semibold border rounded-lg ${poFilterMode === 'include' ? 'text-blue-600 bg-blue-50 border-blue-100 shadow-sm' : 'text-gray-600 border-gray-100 hover:bg-gray-50'}`}
                              >
                                Contains
                              </Button>
                              <Button 
                                variant="ghost" 
                                size="sm" 
                                onClick={() => setPoFilterMode('exclude')}
                                className={`h-9 text-[12px] font-semibold border rounded-lg ${poFilterMode === 'exclude' ? 'text-red-600 bg-red-50 border-red-100 shadow-sm' : 'text-gray-600 border-gray-100 hover:bg-gray-50'}`}
                              >
                                Does not contain
                              </Button>
                            </div>
                          </div>

                          <div className="space-y-3.5 pt-4 border-t border-gray-100">
                            <p className="text-[12px] font-semibold text-gray-500 mb-1 leading-none">Advanced filters</p>
                            <div className="space-y-3">
                              <div className="space-y-1.5">
                                <label className="text-[11px] font-medium text-gray-600 ml-0.5">Created by</label>
                                <Select value={selectedCreatedBy} onValueChange={setSelectedCreatedBy}>
                                  <SelectTrigger className="h-9 text-[12px] font-medium border-gray-200 bg-gray-50/50 rounded-lg">
                                    <SelectValue placeholder="All" />
                                  </SelectTrigger>
                                  <SelectContent className="rounded-xl border-gray-200">
                                    <SelectItem value="all">All creators</SelectItem>
                                    {['Sarah Chen', 'James Wilson', 'Maria Garcia', 'Robert Taylor', 'Linda Martinez'].map(c => (
                                      <SelectItem key={c} value={c}>{c}</SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>
                              <div className="space-y-1.5">
                                <label className="text-[11px] font-medium text-gray-600 ml-0.5">PO status</label>
                                <Select value={selectedPOStatus} onValueChange={setSelectedPOStatus}>
                                  <SelectTrigger className="h-9 text-[12px] font-medium border-gray-200 bg-gray-50/50 rounded-lg">
                                    <SelectValue placeholder="All" />
                                  </SelectTrigger>
                                  <SelectContent className="rounded-xl border-gray-200">
                                    <SelectItem value="all">All statuses</SelectItem>
                                    <SelectItem value="Open">Open</SelectItem>
                                    <SelectItem value="Partially Received">Partially Received</SelectItem>
                                    <SelectItem value="Fully Received">Fully Received</SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>
                            </div>
                          </div>
                          
                          <Button 
                            variant="default" 
                            size="sm" 
                            onClick={() => setActivePopover(null)}
                            className="w-full h-10 text-[13px] font-semibold bg-gray-900 hover:bg-black rounded-xl shadow-lg shadow-gray-100 transition-all"
                          >
                            Apply filters
                          </Button>
                        </div>
                      )}
                    </div>

                    {/* Receiver Search */}
                    <div className="relative group">
                      <Package className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                      <Input
                        type="text"
                        placeholder="Search Receivers..."
                        value={grnSearch}
                        onChange={(e) => setGrnSearch(e.target.value)}
                        className="pl-9 pr-10 h-10 bg-gray-50/50 border-gray-200 focus:bg-white focus:ring-2 focus:ring-blue-100 transition-all text-xs font-semibold"
                      />
                      <button 
                        onClick={() => setActivePopover(activePopover === 'grn' ? null : 'grn')}
                        className={`absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-md transition-colors ${
                          grnFilterMode === 'exclude' ? 'text-blue-600 bg-blue-50' : 'text-gray-400 hover:text-gray-600 hover:bg-gray-100'
                        }`}
                      >
                        <Filter className="w-3.5 h-3.5" />
                      </button>
                      {activePopover === 'grn' && (
                        <div className="absolute top-full right-0 mt-2 w-56 bg-white border border-gray-200 shadow-xl rounded-2xl p-4 z-50 animate-in fade-in zoom-in-95 duration-100">
                          <p className="text-[12px] font-semibold text-gray-500 mb-3 leading-none">Receiver mode</p>
                          <div className="space-y-1.5">
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              onClick={() => { setGrnFilterMode('include'); setActivePopover(null); }}
                              className={`w-full justify-start h-9 text-[13px] font-medium rounded-lg ${grnFilterMode === 'include' ? 'text-blue-600 bg-blue-50' : 'text-gray-600 hover:bg-gray-50'}`}
                            >
                              Contains
                            </Button>
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              onClick={() => { setGrnFilterMode('exclude'); setActivePopover(null); }}
                              className={`w-full justify-start h-9 text-[13px] font-medium rounded-lg ${grnFilterMode === 'exclude' ? 'text-red-600 bg-red-50' : 'text-gray-600 hover:bg-gray-50'}`}
                            >
                              Does not contain
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Item Search */}
                    <div className="relative group">
                      <Tag className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                      <Input
                        type="text"
                        placeholder="Search Items/SKUs..."
                        value={itemSearch}
                        onChange={(e) => setItemSearch(e.target.value)}
                        className="pl-9 pr-10 h-10 bg-gray-50/50 border-gray-200 focus:bg-white focus:ring-2 focus:ring-blue-100 transition-all text-xs font-semibold"
                      />
                      <button 
                        onClick={() => setActivePopover(activePopover === 'item' ? null : 'item')}
                        className={`absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-md transition-colors ${
                          itemFilterMode === 'exclude' ? 'text-blue-600 bg-blue-50' : 'text-gray-400 hover:text-gray-600 hover:bg-gray-100'
                        }`}
                      >
                        <Filter className="w-3.5 h-3.5" />
                      </button>
                      {activePopover === 'item' && (
                        <div className="absolute top-full right-0 mt-2 w-56 bg-white border border-gray-200 shadow-xl rounded-2xl p-4 z-50 animate-in fade-in zoom-in-95 duration-100">
                          <p className="text-[12px] font-semibold text-gray-500 mb-3 leading-none">Item filter mode</p>
                          <div className="space-y-1.5">
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              onClick={() => { setItemFilterMode('include'); setActivePopover(null); }}
                              className={`w-full justify-start h-9 text-[13px] font-medium rounded-lg ${itemFilterMode === 'include' ? 'text-blue-600 bg-blue-50' : 'text-gray-600 hover:bg-gray-50'}`}
                            >
                              Contains
                            </Button>
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              onClick={() => { setItemFilterMode('exclude'); setActivePopover(null); }}
                              className={`w-full justify-start h-9 text-[13px] font-medium rounded-lg ${itemFilterMode === 'exclude' ? 'text-red-600 bg-red-50' : 'text-gray-600 hover:bg-gray-50'}`}
                            >
                              Does not contain
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="h-px bg-gray-100 mx-1" />

                  {/* 2. Combined Filters Bar */}
                  <div className="flex items-center gap-6 py-1.5">
                    {/* Global Visibility Toggles */}
                    <div className="flex items-center gap-6 flex-shrink-0">
                      <div className="flex items-center gap-3 group">
                        <Checkbox 
                          id="filter-line-items" 
                          checked={!showAllItems} 
                          onCheckedChange={(checked) => setShowAllItems(!checked)}
                          className="w-4 h-4 border-gray-300 data-[state=checked]:bg-blue-600 data-[state=checked]:border-blue-600 transition-all duration-200 shadow-none"
                        />
                        <div className="flex flex-col">
                          <label htmlFor="filter-line-items" className="text-[13px] font-semibold text-gray-900 cursor-pointer whitespace-nowrap leading-tight">Limit results to search only</label>
                          <span className="text-[11px] text-gray-500 font-medium mt-0.5">Show only records matching the search</span>
                        </div>
                      </div>

                      <div className="w-px h-8 bg-gray-100" />

                      <div className="flex items-center gap-3 group">
                        <Checkbox 
                          id="show-received-only" 
                          checked={showReceivedOnly} 
                          onCheckedChange={(checked) => setShowReceivedOnly(!!checked)}
                          className="w-4 h-4 border-gray-300 data-[state=checked]:bg-blue-600 data-[state=checked]:border-blue-600 transition-all duration-200 shadow-none"
                        />
                        <div className="flex flex-col">
                          <label htmlFor="show-received-only" className="text-[13px] font-semibold text-gray-900 cursor-pointer whitespace-nowrap leading-tight">Received only</label>
                          <span className="text-[11px] text-gray-500 font-medium mt-0.5">Orders with docs</span>
                        </div>
                      </div>

                      <div className="w-px h-8 bg-gray-100" />

                      <div className="flex items-center gap-3 group">
                        <Checkbox 
                          id="show-closed-combined" 
                          checked={showClosedPOs} 
                          onCheckedChange={(checked) => setShowClosedPOs(!!checked)}
                          className="w-4 h-4 border-gray-300 data-[state=checked]:bg-blue-600 data-[state=checked]:border-blue-600 transition-all duration-200 shadow-none"
                        />
                        <div className="flex flex-col">
                          <label htmlFor="show-closed-combined" className="text-[13px] font-semibold text-gray-900 cursor-pointer whitespace-nowrap leading-tight">Include closed</label>
                          <span className="text-[11px] text-gray-500 font-medium mt-0.5">Billed/Cancelled</span>
                        </div>
                      </div>
                    </div>

                    {/* Date Range Selection - Single Field Selector */}
                    <div className="flex items-center gap-4 pl-6 border-l border-gray-200 flex-shrink-0">
                      <div className="flex flex-col">
                        <span className="text-[13px] font-semibold text-gray-900 whitespace-nowrap leading-none">PO Date Range</span>
                        <span className="text-[11px] text-gray-500 font-medium mt-1">Creation date</span>
                      </div>
                      
                      <div className="relative">
                        <button 
                          onClick={() => setActivePopover(activePopover === 'date' ? null : 'date')}
                          className={`flex items-center gap-2.5 h-10 px-3.5 bg-white border rounded-xl shadow-sm transition-all hover:border-blue-400 hover:ring-2 hover:ring-blue-50/50 ${activePopover === 'date' ? 'border-blue-500 ring-2 ring-blue-50' : 'border-gray-300'}`}
                        >
                          <Calendar className={`w-3.5 h-3.5 ${startDate || endDate ? 'text-blue-600' : 'text-gray-400'}`} />
                          <span className={`text-[12px] font-medium ${startDate || endDate ? 'text-gray-900' : 'text-gray-500'}`}>
                            {startDate && endDate 
                              ? `${dayjs(startDate).format('MMM D')} - ${dayjs(endDate).format('MMM D, YYYY')}`
                              : 'Select Range'
                            }
                          </span>
                          <ChevronDown className={`w-3.5 h-3.5 text-gray-400 transition-transform duration-200 ${activePopover === 'date' ? 'rotate-180' : ''}`} />
                        </button>

                        {activePopover === 'date' && (
                          <div className="absolute top-full left-0 mt-2 w-[340px] bg-white border border-gray-200 shadow-2xl rounded-2xl p-5 z-[100] animate-in fade-in slide-in-from-top-1 duration-200">
                            <div className="flex items-center justify-between mb-4">
                              <p className="text-[12px] font-semibold text-gray-500 mb-1 leading-none">Define date range</p>
                              {(startDate || endDate) && (
                                <button 
                                  onClick={() => { setStartDate(''); setEndDate(''); }}
                                  className="text-[11px] font-semibold text-blue-600 hover:text-blue-700 transition-colors"
                                >
                                  Reset
                                </button>
                              )}
                            </div>
                            
                              <div className="grid grid-cols-2 gap-3">
                                <div className="space-y-2">
                                  <label className="text-[11px] font-medium text-gray-600 flex items-center gap-1.5">
                                    From date
                                  </label>
                                  <input
                                    type="date"
                                    value={startDate}
                                    onChange={(e) => setStartDate(e.target.value)}
                                    className="w-full h-[38px] px-3 text-[12px] bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-100 transition-all"
                                  />
                                </div>
                                <div className="space-y-2">
                                  <label className="text-[11px] font-medium text-gray-600 flex items-center gap-1.5">
                                    To date
                                  </label>
                                  <input
                                    type="date"
                                    value={endDate}
                                    onChange={(e) => setEndDate(e.target.value)}
                                    className="w-full h-[38px] px-3 text-[12px] bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-100 transition-all"
                                  />
                                </div>
                              </div>
                            
                            <div className="mt-5">
                              <Button 
                                variant="default" 
                                size="sm" 
                                onClick={() => setActivePopover(null)}
                                className="w-full h-10 text-[13px] font-semibold bg-blue-600 hover:bg-blue-700 rounded-xl transition-all shadow-sm"
                              >
                                Apply selection
                              </Button>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Reset Action */}
                    <div className="flex items-center pl-6 border-l border-gray-200 flex-shrink-0 ml-auto">
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        onClick={clearAllFilters} 
                        className="h-10 px-4 text-[13px] font-bold text-gray-500 hover:text-red-600 hover:bg-red-50 transition-all rounded-xl group"
                      >
                        <RotateCcw className="w-3.5 h-3.5 mr-2 group-hover:rotate-[-45deg] transition-transform duration-300" /> Reset
                      </Button>
                    </div>
                  </div>
                </div>
          </div>

          <div className="flex-1 overflow-auto bg-white relative">
            {showAlert.show && (
              <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-50 animate-in fade-in slide-in-from-bottom-2 duration-300">
                                <div className={`${
                  showAlert.type === 'warning' ? 'bg-red-50 border-red-200' : 'bg-blue-50 border-blue-200'
                } border rounded-xl px-4 py-2.5 shadow-md flex items-center gap-3 min-w-[400px] border-l-4 ${showAlert.type === 'warning' ? 'border-l-red-500' : 'border-l-blue-500'}`}>
                  <div className={`flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center ${showAlert.type === 'warning' ? 'bg-red-100 text-red-600' : 'bg-blue-100 text-blue-600'}`}>
                    {showAlert.type === 'warning' ? <AlertTriangle className="w-4 h-4" /> : <Info className="w-4 h-4" />}
                  </div>
                  <div className="flex-1">
                    <p className={`text-[12px] font-bold ${showAlert.type === 'warning' ? 'text-red-900' : 'text-blue-900'} tracking-tight leading-snug`}>
                      {showAlert.msg}
                    </p>
                  </div>
                  <div className={`w-px h-5 ${showAlert.type === 'warning' ? 'bg-red-200' : 'bg-blue-200'} mx-1`} />
                  <button 
                    onClick={() => setShowAlert({ ...showAlert, show: false })} 
                    className={`${showAlert.type === 'warning' ? 'text-red-400 hover:text-red-600' : 'text-blue-400 hover:text-blue-600'} transition-colors p-1 hover:bg-white/50 rounded-md`}
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            )}

            <div className="divide-y divide-gray-200">
              {filteredVendors.map((vendor) => (
                <VendorNestedRow
                  key={vendor.id}
                  vendor={vendor}
                  vendorSearch={vendorSearch}
                  poSearch={poSearch}
                  grnSearch={grnSearch}
                  itemSearch={itemSearch}
                  itemFilterMode={itemFilterMode}
                  showAllItems={showAllItems}
                  isExpanded={expandedVendors.has(vendor.id)}
                  onToggle={() => toggleVendor(vendor.id)}
                  selectedPOs={selectedPOs}
                  selectedItemIds={selectedItemIds}
                  selectedGRNs={selectedGRNs}
                  collapsedPOItemTables={collapsedPOItemTables}
                  onTogglePO={togglePOSelection}
                  onToggleItem={toggleItemSelection}
                  onToggleGRNSelection={toggleGRNSelection}
                  onToggleGRNItem={toggleGRNItemSelection}
                  onToggleItemTableCollapse={toggleItemTableCollapse}
                  onSelectAllPOs={selectAllVendorPOs}
                  highlightText={highlightText}
                  expandedPOs={expandedPOs}
                  onTogglePOExpand={togglePO}
                  expandedGRNs={expandedGRNs}
                  onToggleGRNExpand={toggleGRN}
                  selectedGRNItems={selectedGRNItems}
                  setPreviewImage={setPreviewImage}
                />
              ))}
            </div>
          </div>

          <div className="px-6 py-4 border-t border-gray-200 bg-gray-50 flex-shrink-0 rounded-b-[20px]">
            <div className="flex items-center justify-between">
              <div className="text-sm text-gray-600 font-medium">
                <span className="font-semibold text-gray-900">{selectedItemIds.size}</span> items selected from <span className="font-semibold text-gray-900">{selectedPOs.size}</span> POs
              </div>
              <div className="flex items-center gap-3">
                <Button variant="outline" onClick={onClose} className="font-semibold text-gray-700">Cancel</Button>
                <Button 
                  onClick={handleContinue}
                  disabled={selectedItemIds.size === 0 || selectedVendorCount > 1}
                  className={`min-w-[160px] h-10 font-bold shadow-sm transition-all rounded-lg text-[13px] ${
                    selectedVendorCount > 1 
                      ? 'bg-gray-100 text-gray-400 cursor-not-allowed border-gray-200 border grayscale' 
                      : 'bg-blue-600 hover:bg-blue-700 text-white hover:scale-[1.02] active:scale-[0.98]'
                  }`}
                >
                  {selectedVendorCount > 1 ? 'Select Single Vendor Only' : `Continue with ${selectedItemIds.size} items`}
                </Button>
              </div>
            </div>
          </div>
          </div>
      </div>
      {/* Image Preview Modal */}
      {previewImage && (
        <div 
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm animate-in fade-in duration-200"
          onClick={() => setPreviewImage(null)}
        >
          <div 
            className="relative max-w-[90vw] max-h-[90vh] bg-white rounded-2xl p-2 shadow-2xl animate-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            <button 
              className="absolute -top-3 -right-3 w-8 h-8 bg-white text-gray-900 rounded-full flex items-center justify-center shadow-lg hover:bg-gray-100 transition-colors z-10 border border-gray-200"
              onClick={() => setPreviewImage(null)}
            >
              <X className="w-4 h-4" />
            </button>
            
            <div className="overflow-hidden rounded-xl bg-gray-50 flex items-center justify-center min-h-[300px] min-w-[300px]">
              <ImageWithFallback 
                src={previewImage.src} 
                alt={previewImage.alt} 
                className="max-w-full max-h-[80vh] object-contain shadow-sm"
              />
            </div>
            
            <div className="mt-3 px-2 pb-2">
              <div className="flex items-center justify-between gap-4">
                <div className="min-w-0">
                  <p className="text-[14px] font-bold text-gray-900 truncate">{previewImage.alt}</p>
                  <p className="text-[11px] font-medium text-gray-500">Omne Item Asset</p>
                </div>
                <Button 
                  size="sm" 
                  variant="outline" 
                  className="h-8 text-[11px] font-bold gap-2"
                  onClick={() => setPreviewImage(null)}
                >
                  Close Preview
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

interface VendorNestedRowProps {
  vendor: Vendor;
  vendorSearch: string;
  poSearch: string;
  grnSearch: string;
  itemSearch: string;
  itemFilterMode: 'include' | 'exclude';
  showAllItems: boolean;
  isExpanded: boolean;
  onToggle: () => void;
  selectedPOs: Set<string>;
  selectedItemIds: Set<string>;
  selectedGRNs: Set<string>;
  collapsedPOItemTables: Set<string>;
  onTogglePO: (poKey: string, vendor: Vendor, po: VendorPO) => void;
  onToggleItem: (item: LineItem, poKey: string, po: VendorPO, vendor: Vendor) => void;
  onToggleGRNSelection: (grnNumber: string, poKey: string, po: VendorPO, grn: VendorGRN) => void;
  onToggleGRNItem: (item: LineItem, grn: VendorGRN, po: VendorPO, poKey: string) => void;
  onToggleItemTableCollapse: (poKey: string) => void;
  onSelectAllPOs: (vendor: Vendor, select: boolean) => void;
  highlightText: (text: string, query: string) => React.ReactNode;
  expandedPOs: Set<string>;
  onTogglePOExpand: (poKey: string) => void;
  expandedGRNs: Set<string>;
  onToggleGRNExpand: (grnKey: string) => void;
  selectedGRNItems: Set<string>;
  setPreviewImage: (image: { src: string, alt: string } | null) => void;
}

function VendorNestedRow({
  vendor,
  vendorSearch,
  poSearch,
  grnSearch,
  itemSearch,
  itemFilterMode,
  showAllItems,
  isExpanded,
  onToggle,
  selectedPOs,
  selectedItemIds,
  selectedGRNs,
  collapsedPOItemTables,
  onTogglePO,
  onToggleItem,
  onToggleGRNSelection,
  onToggleGRNItem,
  onToggleItemTableCollapse,
  onSelectAllPOs,
  highlightText,
  expandedPOs,
  onTogglePOExpand,
  expandedGRNs,
  onToggleGRNExpand,
  selectedGRNItems,
  setPreviewImage
}: VendorNestedRowProps) {
  const [activeTab, setActiveTab] = useState<'pos' | 'receivers'>('receivers');
  
  const allPOsFullySelected = vendor.purchaseOrders.length > 0 && 
    vendor.purchaseOrders.every(po => po.items.every(item => selectedItemIds.has(item.id)));
  
  const anyPOPartiallySelected = vendor.purchaseOrders.some(po => po.items.some(item => selectedItemIds.has(item.id)));
  
  const allPOsCheckboxState = allPOsFullySelected ? true : (anyPOPartiallySelected ? "indeterminate" : false);
  
  const statusColors: Record<string, string> = {
    'Open': 'bg-blue-50 text-blue-700 border-blue-200',
    'Partially Received': 'bg-amber-50 text-amber-700 border-amber-200',
    'Fully Received': 'bg-green-50 text-green-700 border-green-200',
    'Closed': 'bg-gray-50 text-gray-700 border-gray-200'
  };

  const totalPOs = vendor.purchaseOrders.length;
  const invoicedPOs = vendor.purchaseOrders.filter(po => (po.invoicedAmount || 0) >= po.poAmount && po.poAmount > 0).length;
  const uninvoicedPOs = totalPOs - invoicedPOs;

  const invoicedAmount = vendor.purchaseOrders.reduce((sum, po) => sum + (po.invoicedAmount || 0), 0);
  const totalAmount = vendor.purchaseOrders.reduce((sum, po) => sum + po.poAmount, 0);
  
  const totalGRNs = vendor.receivingDocuments.length;
  const uninvoicedGRNs = totalGRNs; // Match the count to the total receivers shown in the list for consistency as requested

  const handleDocumentClick = (e: React.MouseEvent, poKey: string, grnNumber: string) => {
    e.stopPropagation();
    
    // 1. Expand the PO if it's not expanded
    if (!expandedPOs.has(poKey)) {
      onTogglePOExpand(poKey);
    }
    
    // 2. Expand the specific GRN
    const grnKey = `${poKey}-${grnNumber}`;
    if (!expandedGRNs.has(grnKey)) {
      onToggleGRNExpand(grnKey);
    }
    
    // 3. Scroll to the element after a brief delay to allow expansion animations
    setTimeout(() => {
      const element = document.getElementById(`grn-${grnNumber}`);
      if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'center' });
        // Flash the element to highlight it
        element.classList.add('ring-2', 'ring-blue-400', 'ring-offset-2');
        setTimeout(() => {
          element.classList.remove('ring-2', 'ring-blue-400', 'ring-offset-2');
        }, 2000);
      }
    }, 300);
  };

  return (
    <div className={`${isExpanded ? 'bg-blue-50/10' : 'bg-white hover:bg-gray-50'} transition-colors border-b border-gray-100 last:border-0`}>
      <div 
        className="flex items-center gap-5 px-6 py-4 cursor-pointer group select-none transition-all hover:bg-gray-50/50"
        onClick={onToggle}
      >
        <div className={`flex-shrink-0 flex items-center justify-center w-7 h-7 rounded-lg transition-all ${
          isExpanded ? 'bg-blue-600 text-white shadow-md' : 'bg-gray-100 text-gray-400 group-hover:bg-gray-200'
        }`}>
          {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
        </div>

        <div className={`flex-shrink-0 w-10 h-10 rounded-xl overflow-hidden flex items-center justify-center transition-all ${
          isExpanded ? 'ring-2 ring-blue-100 ring-offset-2' : 'border border-gray-100 shadow-sm'
        } bg-white`}>
          {vendor.imageUrl ? (
            <ImageWithFallback 
              src={vendor.imageUrl} 
              alt={vendor.vendorName} 
              className="w-full h-full object-cover"
            />
          ) : (
            <Building2 className={`w-5 h-5 ${isExpanded ? 'text-blue-600' : 'text-gray-400'}`} />
          )}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3">
            <h3 className="text-[14px] font-bold text-gray-900 truncate tracking-tight group-hover:text-blue-600 transition-colors">
              {highlightText(vendor.vendorName, vendorSearch)}
            </h3>
            <span className="text-[10px] font-semibold text-gray-400 px-2 py-0.5 rounded-full bg-gray-50 border border-gray-100">
              {highlightText(vendor.vendorCode, vendorSearch)}
            </span>
          </div>
          
          <div className="flex items-center gap-4 mt-2">
            <span className="text-[10px] font-semibold text-gray-500 bg-gray-50 px-2 py-0.5 rounded-md border border-gray-200">
              {vendor.category}
            </span>
            <div className="flex items-center gap-4 text-[11px] text-gray-400">
              <div className="flex items-center gap-1.5">
                <User className="w-3 h-3 text-gray-400" />
                <span className="text-gray-500 font-medium">{vendor.createdBy}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Calendar className="w-3 h-3 text-gray-400" />
                <span className="text-gray-500 font-medium">{vendor.createdOn}</span>
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-4 pr-1 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
          {/* Actionable Receivers */}
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="flex items-center gap-3 bg-white px-3 py-2 rounded-xl border border-gray-100 hover:border-blue-300 hover:shadow-lg hover:-translate-y-0.5 transition-all duration-300 cursor-help group/metric">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all duration-300 ${
                  uninvoicedGRNs > 0 ? 'bg-gray-50 text-gray-400 group-hover/metric:bg-blue-100 group-hover/metric:text-blue-600' : 'bg-gray-50 text-gray-400'
                }`}>
                  <Package className="w-4 h-4" />
                </div>
                <div className="flex flex-col">
                  <span className={`text-[15px] font-bold leading-none transition-colors duration-300 ${uninvoicedGRNs > 0 ? 'text-gray-900 group-hover/metric:text-blue-700' : 'text-gray-400'}`}>{uninvoicedGRNs}</span>
                  <span className="text-[9px] text-gray-400 font-bold mt-1 transition-colors duration-300 group-hover/metric:text-blue-500">Unprocessed</span>
                </div>
              </div>
            </TooltipTrigger>
            <TooltipContent side="top" className="p-2 bg-gray-900 border-gray-800 shadow-xl">
              <p className="text-[10px] font-bold text-white">
                {uninvoicedGRNs} receivers are unprocessed
              </p>
            </TooltipContent>
          </Tooltip>

          {/* Actionable Purchase Orders */}
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="flex items-center gap-3 bg-white px-3 py-2 rounded-xl border border-gray-100 hover:border-amber-300 hover:shadow-lg hover:-translate-y-0.5 transition-all duration-300 cursor-help group/metric">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all duration-300 ${
                  uninvoicedPOs > 0 ? 'bg-gray-50 text-gray-400 group-hover/metric:bg-amber-100 group-hover/metric:text-amber-600' : 'bg-gray-50 text-gray-400'
                }`}>
                  <ShoppingCart className="w-4 h-4" />
                </div>
                <div className="flex flex-col">
                  <span className={`text-[15px] font-bold leading-none transition-colors duration-300 ${uninvoicedPOs > 0 ? 'text-gray-900 group-hover/metric:text-amber-700' : 'text-gray-400'}`}>{uninvoicedPOs}</span>
                  <span className="text-[9px] text-gray-400 font-bold mt-1 transition-colors duration-300 group-hover/metric:text-amber-500">POs to Invoice</span>
                </div>
              </div>
            </TooltipTrigger>
            <TooltipContent side="top" className="p-2 bg-gray-900 border-gray-800 shadow-xl">
              <p className="text-[10px] font-bold text-white">
                {uninvoicedPOs} POs to invoice
              </p>
            </TooltipContent>
          </Tooltip>
        </div>
      </div>

      {isExpanded && (
        <div className="px-6 pb-6 pl-7">
          {/* Tab Switcher */}
          <div className="flex items-center gap-2 mb-6 border-b border-gray-100">
            <button 
              onClick={() => setActiveTab('receivers')}
              className={`px-4 py-2.5 text-[13px] font-semibold transition-all relative flex items-center gap-2 ${
                activeTab === 'receivers' ? 'text-blue-600' : 'text-gray-400 hover:text-gray-600'
              }`}
            >
              <Package className={`w-4 h-4 ${activeTab === 'receivers' ? 'text-blue-600' : 'text-gray-400'}`} />
              Receivers
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${activeTab === 'receivers' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-500'}`}>
                {vendor.receivingDocuments.length}
              </span>
              {activeTab === 'receivers' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600 rounded-full" />}
            </button>
            <button 
              onClick={() => setActiveTab('pos')}
              className={`px-4 py-2.5 text-[13px] font-semibold transition-all relative flex items-center gap-2 ${
                activeTab === 'pos' ? 'text-blue-600' : 'text-gray-400 hover:text-gray-600'
              }`}
            >
              <ShoppingCart className={`w-4 h-4 ${activeTab === 'pos' ? 'text-blue-600' : 'text-gray-400'}`} />
              Purchase Orders
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${activeTab === 'pos' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-500'}`}>
                {vendor.purchaseOrders.length}
              </span>
              {activeTab === 'pos' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600 rounded-full" />}
            </button>
          </div>

          {activeTab === 'pos' ? (
                        <div className="space-y-3 border-l-2 border-blue-100 pl-4 py-2">
              {vendor.purchaseOrders.map((po) => {
                const poKey = `${vendor.vendorCode}-${po.poNumber}`;
                const relatedGRNs = vendor.receivingDocuments.filter(grn => grn.poNumber === po.poNumber);
                
                // Deriving selection state directly from item data ensures perfect synchronization between tabs
                const selectedItemsInPO = po.items.filter(item => selectedItemIds.has(item.id)).length;
                const isSelected = selectedItemsInPO > 0;
                const isPOExpanded = expandedPOs.has(poKey);
                
                // ERP Rule: Pre-Invoice only for POs with NO receiving documents
                const isPreInvoiceEligible = relatedGRNs.length === 0;
                
                const isPOFullySelected = selectedItemsInPO === po.items.length && po.items.length > 0;
                const isPOIndeterminate = selectedItemsInPO > 0 && selectedItemsInPO < po.items.length;
                const poCheckboxState = isPOFullySelected ? true : (isPOIndeterminate ? "indeterminate" : false);

                // Determine accurate business status
                const totalReceived = po.items.reduce((sum, i) => sum + (i.receivedQty || 0), 0);
                const totalOrdered = po.items.reduce((sum, i) => sum + i.quantity, 0);
                const isInvoiced = (po.invoicedAmount || 0) > 0;
                const isFullyInvoiced = (po.invoicedAmount || 0) >= po.poAmount && po.poAmount > 0;
                
                let effectiveStatus = po.status;
                if (relatedGRNs.length === 0) {
                  effectiveStatus = 'Open';
                } else if (totalReceived >= totalOrdered) {
                  effectiveStatus = 'Fully Received';
                } else if (totalReceived > 0) {
                  effectiveStatus = 'Partially Received';
                }

                // Additional status layer: Invoicing
                const isInvoicingPartial = isInvoiced && !isFullyInvoiced;
                const displayStatus = isFullyInvoiced ? 'Fully Invoiced' : effectiveStatus;

                return (
                  <div key={po.poNumber} className={`rounded-xl border transition-all ${
                    isSelected 
                      ? 'border-blue-300 bg-blue-50/50 shadow-sm' 
                      : displayStatus === 'Closed' || displayStatus === 'Fully Invoiced'
                        ? 'border-gray-200 bg-gray-50/50 opacity-70 grayscale-[0.4]' 
                        : 'border-gray-200 bg-white hover:border-blue-200'
                  }`}>
                    <div 
                      className="flex items-center gap-3 px-3 py-2 cursor-pointer group"
                      onClick={() => onTogglePOExpand(poKey)}
                    >
                      <div className={`flex-shrink-0 flex items-center justify-center w-5 h-5 rounded transition-all ${
                        isPOExpanded ? 'bg-blue-600 text-white shadow-sm' : 'text-gray-400 group-hover:bg-gray-100'
                      }`}>
                        {isPOExpanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                      </div>

                      <div onClick={(e) => e.stopPropagation()} className="flex items-center px-1">
                        <Checkbox 
                          checked={poCheckboxState} 
                          onCheckedChange={() => onTogglePO(poKey, vendor, po)}
                          disabled={displayStatus === 'Closed' || displayStatus === 'Fully Invoiced'}
                        />
                      </div>
                      
                      <div className={`flex-shrink-0 w-7 h-7 rounded flex items-center justify-center transition-all ${
                        displayStatus === 'Closed' || displayStatus === 'Fully Invoiced'
                          ? 'bg-gray-200 text-gray-500'
                          : isSelected ? 'bg-blue-600 text-white shadow-sm' : 'bg-gray-100 text-gray-400 group-hover:bg-blue-50 group-hover:text-blue-600'
                      }`}>
                        <ShoppingCart className="w-3.5 h-3.5" />
                      </div>

                      <div className="flex-1 min-w-0 flex items-center justify-between">
                        <div className="flex flex-col">
                          <div className="flex items-center gap-2">
                            <span className={`font-bold text-[13px] ${displayStatus === 'Closed' || displayStatus === 'Fully Invoiced' ? 'text-gray-500 line-through decoration-gray-300' : 'text-gray-900 group-hover:text-blue-600 transition-colors'}`}>
                              {highlightText(po.poNumber, poSearch)}
                            </span>
                            <span className={`text-[9px] font-bold px-1.5 py-0.25 rounded-sm border ${statusColors[displayStatus] || 'bg-gray-50 text-gray-700 border-gray-200'}`}>
                              {displayStatus}
                            </span>
                            {isInvoiced && !isFullyInvoiced && (
                              <span className="text-[9px] font-bold px-1.5 py-0.25 rounded-sm border bg-purple-50 text-purple-700 border-purple-200">
                                Partially Invoiced
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-2 mt-0.5 text-[10px] font-medium text-gray-500">
                            <span className="text-gray-400">{po.items.length} items</span>
                            {relatedGRNs.length > 0 && (
                              <>
                                <span className="text-gray-300 font-normal">•</span>
                                <span className={`${displayStatus === 'Closed' ? 'text-gray-400' : 'text-gray-600'} font-bold bg-gray-100 px-1.5 py-0.25 rounded-sm text-[9px] tracking-tight`}>
                                  {relatedGRNs.length} Receivers
                                </span>
                              </>
                            )}
                            {selectedItemsInPO > 0 && (
                              <>
                                <span className="text-gray-300 font-normal">•</span>
                                <span className="text-blue-600 font-bold bg-blue-50 px-1.5 rounded-sm">{selectedItemsInPO} selected</span>
                              </>
                            )}
                          </div>
                        </div>

                        <div className="flex flex-col items-end gap-0.5 px-2">
                          <div className="flex items-center gap-2">
                            {isInvoiced && (
                              <div className="flex items-center gap-1.5">
                                <span className={`text-[10px] font-semibold ${
                                  isPreInvoiceEligible 
                                    ? 'text-amber-600 bg-amber-50 border-amber-100' 
                                    : 'text-green-600 bg-green-50 border-green-100'
                                } px-1.5 py-0.5 border rounded flex items-center gap-1`}>
                                  {isPreInvoiceEligible ? <Tag className="w-2.5 h-2.5" /> : <CheckCircle2 className="w-2.5 h-2.5" />}
                                  {isPreInvoiceEligible ? 'Pre-Invoiced' : 'Invoiced'}: <VIMoneyCell value={po.invoicedAmount ?? 0} currency={vendor.currency} />
                                </span>
                                {isPreInvoiceEligible && (
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <Info className="w-3 h-3 text-amber-400 cursor-help" />
                                    </TooltipTrigger>
                                    <TooltipContent className="max-w-[200px] p-2 text-[10px]">
                                      Pre-invoicing is active for this PO because no goods have been received yet.
                                    </TooltipContent>
                                  </Tooltip>
                                )}
                              </div>
                            )}
                            <VIMoneyCell value={po.poAmount} currency={vendor.currency} className={`text-[14px] font-bold ${displayStatus === 'Closed' || displayStatus === 'Fully Invoiced' ? 'text-gray-400' : 'text-green-600'}`} />
                          </div>
                          <span className="text-[8px] text-gray-400 font-bold">PO Value</span>
                        </div>
                      </div>
                    </div>

                    {isPOExpanded && (
                      <div className="px-4 pb-4 animate-in fade-in slide-in-from-top-1 duration-200 space-y-4">
                        {/* Section 1: Items Table - All PO Line Items */}
                        <div className="mt-4 -mx-4 border-y border-gray-100 bg-white/50 overflow-hidden">
                          <div className="px-6 py-2 bg-gray-50/50 border-b border-gray-100 flex items-center justify-between">
                            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">All PO Line Items</p>
                            <span className="text-[9px] font-medium text-gray-400 bg-white px-2 py-0.5 rounded border border-gray-100">
                              {selectedItemsInPO} / {po.items.length} Selected
                            </span>
                          </div>
                          <table className="w-full text-left text-[11px]">
                            <thead className="bg-gray-50/30 border-b border-gray-100 text-gray-400 font-bold uppercase tracking-widest">
                              <tr>
                                <th className="pl-6 pr-4 py-2.5 w-10">
                                  <Checkbox 
                                    checked={poCheckboxState === true} 
                                    onCheckedChange={() => onTogglePO(poKey, vendor, po)}
                                    className={poCheckboxState === "indeterminate" ? 'opacity-50' : ''}
                                    disabled={displayStatus === 'Fully Invoiced'}
                                  />
                                </th>
                                <th className="px-4 py-2.5">Item / SKU</th>
                                <th className="px-4 py-2.5 text-right">Ordered Qty</th>
                                <th className="px-4 py-2.5 text-right">Invoiced Qty / Amt</th>
                                <th className="px-4 py-2.5 text-right">Unit Price</th>
                                <th className="px-4 py-2.5 text-right">Balance Total</th>
                                <th className="px-4 py-2.5 pr-6">Linked Documents</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                              {po.items.filter(item => {
                                const passesSearch = !itemSearch.trim() || 
                                              item.sku.toLowerCase().includes(itemSearch.toLowerCase()) || 
                                              item.description.toLowerCase().includes(itemSearch.toLowerCase());
                                return itemFilterMode === 'include' ? passesSearch : !passesSearch;
                              }).map(item => {
                                const isItemSelected = selectedItemIds.has(item.id);
                                const itemGRNs = vendor.receivingDocuments.filter(grn => 
                                  grn.poNumber === po.poNumber && 
                                  grn.items.some(gi => gi.sku === item.sku)
                                );
                                
                                const isFullyInvoiced = (item.invoicedQty || 0) >= item.quantity;
                                const isPartiallyInvoiced = (item.invoicedQty || 0) > 0 && !isFullyInvoiced;
                                const prevInvoicedAmt = (item.invoicedQty || 0) * item.unitPrice;
                                const remainingAmt = item.totalPrice - prevInvoicedAmt;

                                return (
                                  <tr key={item.id} className={`transition-colors ${isItemSelected ? 'bg-blue-50/50' : isFullyInvoiced ? 'bg-gray-50/50 grayscale-[0.5]' : 'hover:bg-white/80'}`}>
                                    <td className="pl-6 pr-4 py-2.5">
                                      <Checkbox 
                                        checked={isItemSelected} 
                                        onCheckedChange={() => onToggleItem(item, poKey, po, vendor)}
                                        disabled={isFullyInvoiced}
                                      />
                                    </td>
                                    <td className="px-4 py-2.5">
                                      <div className="flex items-center gap-3">
                                        <button 
                                          onClick={() => setPreviewImage({ src: item.image || '', alt: item.sku })}
                                          className="w-9 h-9 rounded-lg border border-gray-100 bg-gray-50 overflow-hidden flex-shrink-0 cursor-zoom-in hover:border-blue-300 transition-colors group/img"
                                        >
                                          <ImageWithFallback 
                                            src={item.image}
                                            alt={item.sku}
                                            className="w-full h-full object-cover group-hover/img:scale-110 transition-transform duration-300"
                                          />
                                        </button>
                                        <div className="min-w-0">
                                          <div className="font-bold text-gray-900 flex items-center gap-2">
                                            {highlightText(item.sku, itemSearch)}
                                          </div>
                                          <div className="font-normal text-gray-400 text-[10px] truncate max-w-[150px]">{highlightText(item.description, itemSearch)}</div>
                                        </div>
                                      </div>
                                    </td>
                                    <td className="px-4 py-2.5 text-right font-bold text-gray-900">{item.quantity} {item.uom}</td>
                                    <td className="px-4 py-2.5 text-right">
                                      <div className="flex flex-col items-end">
                                        <span className={`font-bold ${isFullyInvoiced ? 'text-emerald-600' : isPartiallyInvoiced ? 'text-emerald-500' : 'text-gray-400'}`}>
                                          {item.invoicedQty || 0} {item.uom}
                                        </span>
                                        {prevInvoicedAmt > 0 && (
                                          <span className="text-[9px] text-emerald-700/60 font-medium italic underline decoration-emerald-200 decoration-dotted underline-offset-2">Prev: <VIMoneyCell value={prevInvoicedAmt} currency={vendor.currency} /></span>
                                        )}
                                      </div>
                                    </td>
                                    <td className="px-4 py-2.5 text-right font-medium text-gray-500"><VIMoneyCell value={item.unitPrice} currency={vendor.currency} /></td>
                                    <td className="px-4 py-2.5 text-right font-bold text-blue-600">
                                      <div className="flex flex-col items-end">
                                        <VIMoneyCell value={remainingAmt} currency={vendor.currency} />
                                        {isPartiallyInvoiced && (
                                          <span className="text-[9px] text-gray-300 font-normal line-through">orig: <VIMoneyCell value={item.totalPrice} currency={vendor.currency} /></span>
                                        )}
                                      </div>
                                    </td>
                                    <td className="px-4 py-2.5 pr-6">
                                      <div className="flex flex-col gap-1.5">
                                        {isPreInvoiceEligible && (item.invoicedQty || 0) > 0 ? (
                                          <span className="text-[9px] font-bold text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-100 flex items-center gap-1 w-fit">
                                            <Tag className="w-2.5 h-2.5" />
                                            Pre-Invoiced
                                          </span>
                                        ) : isPartiallyInvoiced ? (
                                          <span className="text-[9px] font-bold text-purple-600 bg-purple-50 px-1.5 py-0.5 rounded border border-purple-100 flex items-center gap-1 w-fit">
                                            Partially Invoiced
                                          </span>
                                        ) : null}
                                        <div className="flex flex-wrap gap-1">
                                          {itemGRNs.length > 0 ? (
                                            <>
                                              {itemGRNs.slice(0, 2).map(grn => (
                                                <button 
                                                  key={grn.grnNumber} 
                                                  onClick={(e) => handleDocumentClick(e, poKey, grn.grnNumber)}
                                                  className="text-[9px] font-bold text-gray-600 bg-gray-100 px-1.5 py-0.5 rounded border border-gray-200 flex items-center gap-1 hover:bg-blue-50 hover:text-blue-600 hover:border-blue-200 transition-colors cursor-pointer"
                                                >
                                                  <Package className="w-2.5 h-2.5" />
                                                  {grn.grnNumber}
                                                </button>
                                              ))}
                                              {itemGRNs.length > 2 && (
                                                <Tooltip>
                                                  <TooltipTrigger asChild>
                                                    <span className="text-[9px] font-bold text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded border border-blue-100 cursor-help">
                                                      + {itemGRNs.length - 2} more
                                                    </span>
                                                  </TooltipTrigger>
                                                  <TooltipContent className="p-2 bg-white border border-gray-200 shadow-xl rounded-xl z-[60]">
                                                    <div className="space-y-1.5">
                                                      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest px-1">Additional Documents</p>
                                                      <div className="flex flex-col gap-1">
                                                        {itemGRNs.slice(2).map(grn => (
                                                          <button 
                                                            key={grn.grnNumber}
                                                            onClick={(e) => handleDocumentClick(e, poKey, grn.grnNumber)}
                                                            className="flex items-center gap-2 px-2 py-1 hover:bg-gray-50 rounded text-[10px] font-semibold text-gray-700 transition-colors group/tool"
                                                          >
                                                            <Package className="w-3 h-3 text-gray-400 group-hover/tool:text-blue-500" />
                                                            <span>{grn.grnNumber}</span>
                                                            <ChevronRight className="w-2.5 h-2.5 ml-auto text-gray-300" />
                                                          </button>
                                                        ))}
                                                      </div>
                                                    </div>
                                                  </TooltipContent>
                                                </Tooltip>
                                              )}
                                            </>
                                          ) : (
                                          <span className="text-[9px] font-medium text-gray-400 italic">Not Received</span>
                                        )}
                                        </div>
                                      </div>
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>

                        {/* Section 2: Receivers Below */}
                        {relatedGRNs.length > 0 && (
                          <div className="mt-4 space-y-2">
                            <div className="flex items-center justify-between px-1">
                              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Linked Receivers</p>
                              <span className="text-[9px] font-medium text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">
                                {relatedGRNs.filter(g => selectedGRNs.has(g.grnNumber)).length} / {relatedGRNs.length} Selected
                              </span>
                            </div>
                            <div className="grid grid-cols-1 gap-2">
                              {relatedGRNs.map(grn => {
                                // Deriving GRN selection from its items for perfect sync
                                const isGRNSelected = grn.items.some(item => selectedGRNItems.has(`${grn.grnNumber}:${item.id}`));
                                const grnTotalAmt = grn.items.reduce((sum, i) => sum + i.totalPrice, 0);
                                const isGRNExpanded = expandedGRNs.has(`${poKey}-${grn.grnNumber}`);
                                
                                return (
                                  <div 
                                    key={grn.grnNumber} 
                                    id={`grn-${grn.grnNumber}`}
                                    className={`flex flex-col border rounded-xl overflow-hidden transition-all ${
                                      isGRNSelected ? 'border-blue-300 ring-1 ring-blue-100 bg-blue-50/20' : 'border-gray-100 bg-white hover:border-blue-100'
                                    }`}
                                  >
                                    <div 
                                      className={`p-3 flex items-center gap-3 cursor-pointer group/grn ${isGRNExpanded ? 'border-b border-gray-100' : ''}`}
                                      onClick={(e) => { e.stopPropagation(); onToggleGRNExpand(`${poKey}-${grn.grnNumber}`); }}
                                    >
                                      <div className={`flex-shrink-0 flex items-center justify-center w-5 h-5 rounded transition-all ${
                                        isGRNExpanded ? 'bg-blue-600 text-white shadow-sm' : 'text-gray-400 group-hover/grn:bg-gray-100'
                                      }`}>
                                        {isGRNExpanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                                      </div>

                                      <div onClick={(e) => e.stopPropagation()} className="flex items-center">
                                        <Checkbox 
                                          checked={isGRNSelected} 
                                          onCheckedChange={() => onToggleGRNSelection(grn.grnNumber, poKey, po, grn)}
                                          disabled={grn.status === 'Fully Invoiced'}
                                        />
                                      </div>
                                      
                                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${isGRNSelected ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-400 group-hover/grn:bg-blue-100 group-hover/grn:text-blue-600'}`}>
                                        <Package className="w-4 h-4" />
                                      </div>

                                      <div className="flex-1">
                                        <div className="flex justify-between items-center">
                                          <div className="flex items-center gap-2">
                                            <span className="text-[12px] font-bold text-gray-900">{highlightText(grn.grnNumber, grnSearch)}</span>
                                            <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded border ${
                                              grn.status === 'Fully Invoiced' ? 'bg-green-50 text-green-700 border-green-100' : 
                                              grn.status === 'Partially Invoiced' ? 'bg-purple-50 text-purple-700 border-purple-100' :
                                              'bg-gray-50 text-gray-600 border-gray-100'
                                            }`}>{grn.status}</span>
                                          </div>
                                          <div className="flex items-center gap-2">
                                            <div className="text-right">
                                              <VIMoneyCell value={grnTotalAmt} currency={vendor.currency} className="text-[11px] font-bold text-gray-900" />
                                              <div className="text-[9px] text-gray-400 font-medium">{grn.grnDate}</div>
                                            </div>
                                          </div>
                                        </div>
                                      </div>
                                    </div>
                                    
                                    {isGRNExpanded && (
                                      <div className="bg-gray-50/30 animate-in fade-in slide-in-from-top-1 duration-200 border-t border-gray-100">
                                        <table className="w-full text-left text-[10px]">
                                          <thead className="bg-gray-100/50 border-b border-gray-100 text-gray-400 font-bold uppercase tracking-wider">
                                            <tr>
                                              <th className="pl-4 pr-1 py-2 w-8">
                                                <Checkbox 
                                                  checked={grn.items.length > 0 && grn.items.every(item => selectedGRNItems.has(`${grn.grnNumber}:${item.id}`))} 
                                                  onCheckedChange={() => onToggleGRNSelection(grn.grnNumber, poKey, po, grn)}
                                                  className={grn.items.some(item => selectedGRNItems.has(`${grn.grnNumber}:${item.id}`)) && !grn.items.every(item => selectedGRNItems.has(`${grn.grnNumber}:${item.id}`)) ? 'opacity-50' : ''}
                                                />
                                              </th>
                                              <th className="px-3 py-2">Item / SKU</th>
                                              <th className="px-4 py-2 text-right">Qty</th>
                                              <th className="px-4 py-2 text-right">Price</th>
                                              <th className="px-4 py-2 text-right">Total</th>
                                            </tr>
                                          </thead>
                                          <tbody className="divide-y divide-gray-100 bg-white/40">
                                            {grn.items.map((item, idx) => {
                                              const isItemSelected = selectedGRNItems.has(`${grn.grnNumber}:${item.id}`);
                                              return (
                                                <tr key={idx} className={`hover:bg-white transition-colors ${isItemSelected ? 'bg-blue-50/30' : ''}`}>
                                                  <td className="pl-4 pr-1 py-2">
                                                    <Checkbox 
                                                      checked={isItemSelected} 
                                                      onCheckedChange={() => onToggleGRNItem(item, grn, po, poKey)}
                                                      disabled={grn.status === 'Fully Invoiced'}
                                                    />
                                                  </td>
                                                  <td className="px-3 py-2">
                                                    <div className="flex items-center gap-2">
                                                      <button 
                                                        onClick={() => setPreviewImage({ src: item.image || '', alt: item.sku })}
                                                        className="w-8 h-8 rounded-lg border border-gray-100 bg-gray-50 overflow-hidden flex-shrink-0 cursor-zoom-in hover:border-blue-300 transition-colors group/img"
                                                      >
                                                        <ImageWithFallback 
                                                          src={item.image}
                                                          alt={item.sku}
                                                          className="w-full h-full object-cover group-hover/img:scale-110 transition-transform duration-300"
                                                        />
                                                      </button>
                                                      <div className="min-w-0">
                                                        <div className="font-bold text-gray-800 truncate max-w-[150px]">{item.sku}</div>
                                                        <div className="text-gray-400 truncate max-w-[150px] font-medium text-[9px]">{item.description}</div>
                                                      </div>
                                                    </div>
                                                  </td>
                                                  <td className="px-4 py-2 text-right font-bold text-gray-900">{item.quantity} {item.uom}</td>
                                                  <td className="px-4 py-2 text-right text-gray-500"><VIMoneyCell value={item.unitPrice} currency={vendor.currency} /></td>
                                                  <td className="px-4 py-2 text-right font-bold text-gray-900"><VIMoneyCell value={item.totalPrice} currency={vendor.currency} /></td>
                                                </tr>
                                              );
                                            })}
                                          </tbody>
                                        </table>
                                      </div>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

          ) : (
                                    <div className="space-y-3 border-l-2 border-blue-100 pl-4 py-2">
              {vendor.receivingDocuments.map((grn) => {
                const poKey = `${vendor.vendorCode}-${grn.poNumber}`;
                const po = vendor.purchaseOrders.find(p => p.poNumber === grn.poNumber);
                if (!po) return null;
                
                const isGRNSelected = selectedGRNs.has(grn.grnNumber);
                const isGRNExpanded = expandedGRNs.has(`${poKey}-${grn.grnNumber}`);
                const grnTotalAmt = grn.items.reduce((sum, i) => sum + i.totalPrice, 0);

                return (
                  <div key={grn.grnNumber} className={`rounded-xl border transition-all ${
                    isGRNSelected 
                      ? 'border-blue-300 bg-blue-50/50 shadow-sm' 
                      : 'border-gray-200 bg-white hover:border-blue-200'
                  }`}>
                    <div 
                      className="flex items-center gap-3 px-3 py-2 cursor-pointer group"
                      onClick={() => onToggleGRNExpand(`${poKey}-${grn.grnNumber}`)}
                    >
                      <div className={`flex-shrink-0 flex items-center justify-center w-5 h-5 rounded transition-all ${
                        isGRNExpanded ? 'bg-blue-600 text-white shadow-sm' : 'text-gray-400 group-hover:bg-gray-100'
                      }`}>
                        {isGRNExpanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                      </div>

                      <div onClick={(e) => e.stopPropagation()} className="flex items-center px-1">
                        <Checkbox 
                          checked={isGRNSelected} 
                          onCheckedChange={() => onToggleGRNSelection(grn.grnNumber, poKey, po, grn)}
                          disabled={grn.status === 'Fully Invoiced'}
                          className="data-[state=checked]:bg-blue-600 data-[state=checked]:border-blue-600"
                        />
                      </div>
                      
                      <div className={`flex-shrink-0 w-7 h-7 rounded flex items-center justify-center transition-all ${
                        isGRNSelected 
                          ? 'bg-blue-600 text-white shadow-sm' 
                          : 'bg-gray-100 text-gray-400 group-hover:bg-blue-50 group-hover:text-blue-600'
                      }`}>
                        <Package className="w-3.5 h-3.5" />
                      </div>

                      <div className="flex-1 min-w-0 flex items-center justify-between">
                        <div className="flex flex-col">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-[13px] text-gray-900 group-hover:text-blue-600 transition-colors">
                              {highlightText(grn.grnNumber, grnSearch)}
                            </span>
                            {(() => {
                              let statusLabel = 'Not Invoiced';
                              let statusStyles = 'bg-gray-50 text-gray-500 border-gray-200';
                              
                              if (grn.status === 'Fully Invoiced') {
                                statusLabel = 'Fully Invoiced';
                                statusStyles = 'bg-green-50 text-green-700 border-green-200';
                              } else if (grn.status === 'Partially Invoiced') {
                                statusLabel = 'Partially Invoiced';
                                statusStyles = 'bg-purple-50 text-purple-700 border-purple-200';
                              } else {
                                statusLabel = 'Not Invoiced';
                                statusStyles = 'bg-gray-50 text-gray-500 border-gray-200';
                              }
                              
                              return (
                                <span className={`text-[9px] font-bold px-1.5 py-0.25 rounded-sm border ${statusStyles}`}>
                                  {statusLabel}
                                </span>
                              );
                            })()}
                          </div>
                          <div className="flex items-center gap-2 mt-0.5 text-[10px] font-medium text-gray-500">
                            <span 
                              className="flex items-center gap-1 font-bold text-gray-500 hover:text-blue-600 hover:underline transition-colors cursor-pointer"
                              onClick={(e) => {
                                e.stopPropagation();
                                setActiveTab('pos');
                              }}
                            >
                              <ShoppingCart className="w-3 h-3" />
                              {grn.poNumber}
                            </span>
                            <span className="text-gray-300 font-normal">•</span>
                            <span>{grn.items.length} items</span>
                            <span className="text-gray-300 font-normal">•</span>
                            <span>{grn.grnDate}</span>
                          </div>
                        </div>

                        <div className="flex flex-col items-end gap-0.5 px-2">
                          <VIMoneyCell value={grnTotalAmt} currency={vendor.currency} className="text-[14px] font-bold text-gray-900" />
                          <span className="text-[8px] text-gray-400 font-bold">Receiver value</span>
                        </div>
                      </div>
                    </div>

                    {isGRNExpanded && (
                      <div className="px-4 pb-4 animate-in fade-in slide-in-from-top-1 duration-200">
                        <div className="border-t border-gray-100 bg-white -mx-4 -mb-4 rounded-b-xl overflow-hidden">
                          <table className="w-full text-left text-[11px]">
                            <thead className="bg-gray-50/80 border-b border-gray-100 text-[9px] text-gray-400 font-bold uppercase tracking-widest">
                              <tr>
                                <th className="px-4 py-3 w-10">
                                  <Checkbox 
                                    checked={grn.items.length > 0 && grn.items.every(item => selectedGRNItems.has(`${grn.grnNumber}:${item.id}`))} 
                                    onCheckedChange={() => onToggleGRNSelection(grn.grnNumber, poKey, po, grn)}
                                    disabled={grn.status === 'Fully Invoiced'}
                                    className={`data-[state=checked]:bg-blue-600 data-[state=checked]:border-blue-600 ${grn.items.some(item => selectedGRNItems.has(`${grn.grnNumber}:${item.id}`)) && !grn.items.every(item => selectedGRNItems.has(`${grn.grnNumber}:${item.id}`)) ? 'opacity-50' : ''}`}
                                  />
                                </th>
                                <th className="px-4 py-3 min-w-[220px]">Item / SKU</th>
                                <th className="px-4 py-3 text-right">Unit Price</th>
                                <th className="px-4 py-3 text-right">Received</th>
                                <th className="px-4 py-3 text-right bg-emerald-50/30 text-emerald-600">Invoiced</th>
                                <th className="px-4 py-3 text-right bg-blue-50/30 text-blue-600">Remaining</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                              {grn.items.map((item, idx) => {
                                const isItemSelected = selectedGRNItems.has(`${grn.grnNumber}:${item.id}`);
                                const remainingQty = item.quantity - (item.invoicedQty || 0);
                                const receivedValue = item.quantity * item.unitPrice;
                                const invoicedValue = (item.invoicedQty || 0) * item.unitPrice;
                                const remainingValue = remainingQty * item.unitPrice;
                                
                                return (
                                  <tr key={idx} className={`transition-colors ${isItemSelected ? 'bg-blue-50/50' : 'hover:bg-gray-50/50'}`}>
                                    <td className="px-4 py-3">
                                      <Checkbox 
                                        checked={isItemSelected} 
                                        onCheckedChange={() => onToggleGRNItem(item, grn, po, poKey)}
                                        disabled={grn.status === 'Fully Invoiced'}
                                        className="data-[state=checked]:bg-blue-600 data-[state=checked]:border-blue-600"
                                      />
                                    </td>
                                    <td className="px-4 py-3">
                                      <div className="flex items-center gap-3">
                                        <button 
                                          onClick={() => setPreviewImage({ src: item.image || '', alt: item.sku })}
                                          className="w-9 h-9 rounded-lg border border-gray-100 bg-gray-50 overflow-hidden flex-shrink-0 cursor-zoom-in hover:border-blue-300 transition-colors group/img"
                                        >
                                          <ImageWithFallback 
                                            src={item.image}
                                            alt={item.sku}
                                            className="w-full h-full object-cover group-hover/img:scale-110 transition-transform duration-300"
                                          />
                                        </button>
                                        <div className="min-w-0">
                                          <div className="font-bold text-gray-900 truncate max-w-[200px]">{item.sku}</div>
                                          <div className="font-medium text-gray-400 text-[10px] truncate max-w-[200px]">{item.description}</div>
                                        </div>
                                      </div>
                                    </td>
                                    <td className="px-4 py-3 text-right">
                                      <VIMoneyCell value={item.unitPrice} currency={vendor.currency} className="font-bold text-gray-900" />
                                      <div className="text-[9px] font-bold text-gray-400 uppercase tracking-tight">Per {item.uom}</div>
                                    </td>
                                    <td className="px-4 py-3 text-right">
                                      <div className="font-bold text-gray-900">{item.quantity} {item.uom}</div>
                                      <VIMoneyCell value={receivedValue} currency={vendor.currency} className="text-[10px] font-medium text-gray-500" />
                                    </td>
                                    <td className="px-4 py-3 text-right bg-emerald-50/10">
                                      <div className="flex flex-col items-end">
                                        <div className="flex items-center gap-1.5">
                                          <span className="font-black text-emerald-600">{item.invoicedQty || 0} {item.uom}</span>
                                          {item.invoicedQty && item.invoicedQty > 0 && (
                                            <HoverCard openDelay={100}>
                                              <HoverCardTrigger asChild>
                                                <Info className="w-3 h-3 text-emerald-400 cursor-help" />
                                              </HoverCardTrigger>
                                              <HoverCardContent side="top" className="w-64 p-3 bg-white border-emerald-100 shadow-xl rounded-xl z-[60]">
                                                <div className="space-y-2 text-left">
                                                  <div className="flex items-center justify-between">
                                                    <span className="text-[9px] font-black text-emerald-600 uppercase tracking-widest">Linked Invoices</span>
                                                    <span className="text-[9px] font-bold text-gray-400">Total: <VIMoneyCell value={invoicedValue} currency={vendor.currency} /></span>
                                                  </div>
                                                  <div className="space-y-1">
                                                    <div className="flex items-center justify-between border-b border-gray-50 pb-1">
                                                      <span className="text-[10px] font-bold text-gray-900">PINV-001-V001</span>
                                                      <VIMoneyCell value={invoicedValue} currency={vendor.currency} className="text-[10px] font-black text-emerald-600" />
                                                    </div>
                                                  </div>
                                                  <p className="text-[10px] text-gray-500 font-medium">This quantity has already been recorded in preceding invoices.</p>
                                                </div>
                                              </HoverCardContent>
                                            </HoverCard>
                                          )}
                                        </div>
                                        <VIMoneyCell value={invoicedValue} currency={vendor.currency} className="text-[10px] font-bold text-emerald-700/70" />
                                      </div>
                                    </td>
                                    <td className="px-4 py-3 text-right bg-blue-50/10">
                                      <div className="font-black text-blue-600">{remainingQty} {item.uom}</div>
                                      <VIMoneyCell value={remainingValue} currency={vendor.currency} className="text-[10px] font-bold text-blue-700/70" />
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

    </div>
  );
}
