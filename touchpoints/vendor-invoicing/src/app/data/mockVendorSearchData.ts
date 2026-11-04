import { mulberry32 } from './seededRandom';

// Seeded so search suggestions stay stable across reloads — see
// mockInvoices.ts for the rationale.
const rand = mulberry32(0x5EA12CB);

export interface SearchableItem {
  id: string;
  name: string;
  type: 'vendor' | 'po' | 'receiving' | 'item';
  vendorId?: string;
  vendorName?: string;
  poNumber?: string;
  receivingDocNumber?: string;
  amount?: number;
  date?: string;
  status?: string;
  quantity?: number;
  unitPrice?: number;
  description?: string;
}

export interface VendorSearchResult {
  id: string;
  name: string;
  code: string;
  type: 'vendor';
  totalPOs: number;
  totalReceivings: number;
  openBalance: number;
  purchaseOrders: PurchaseOrder[];
  receivingDocuments: ReceivingDocument[];
  items: Item[];
}

export interface PurchaseOrder {
  id: string;
  poNumber: string;
  type: 'po';
  vendorId: string;
  vendorName: string;
  date: string;
  totalAmount: number;
  status: string;
  items: Item[];
}

export interface ReceivingDocument {
  id: string;
  receivingNumber: string;
  type: 'receiving';
  vendorId: string;
  vendorName: string;
  poNumber: string;
  date: string;
  totalAmount: number;
  status: string;
  items: Item[];
}

export interface Item {
  id: string;
  itemCode: string;
  type: 'item';
  description: string;
  quantity: number;
  unitPrice: number;
  amount: number;
  vendorId?: string;
  vendorName?: string;
  poNumber?: string;
  receivingNumber?: string;
}

const vendors = [
  'Acme Corp', 'Global Supplies Inc', 'Tech Solutions Ltd', 'Office Depot Co',
  'Industrial Materials', 'Premier Manufacturing', 'Quality Parts Inc', 'Swift Logistics',
  'Metro Wholesale', 'Alliance Trading', 'Precision Tools Ltd', 'Universal Distributors',
  'Northern Suppliers', 'Eastern Equipment', 'Western Materials', 'Southern Goods Co',
  'Pacific Components', 'Atlantic Resources', 'Continental Trading', 'International Supply'
];

const items = [
  { code: 'ITM-001', desc: 'Steel Brackets (Pack of 100)' },
  { code: 'ITM-002', desc: 'Industrial Fasteners Set' },
  { code: 'ITM-003', desc: 'Hydraulic Pump Assembly' },
  { code: 'ITM-004', desc: 'Office Desk Chair - Ergonomic' },
  { code: 'ITM-005', desc: 'Printer Toner Cartridge - Black' },
  { code: 'ITM-006', desc: 'Laptop Computer - Business Grade' },
  { code: 'ITM-007', desc: 'Network Switch 24-Port' },
  { code: 'ITM-008', desc: 'LED Monitor 27 inch' },
  { code: 'ITM-009', desc: 'Warehouse Shelving Unit' },
  { code: 'ITM-010', desc: 'Forklift Battery - 48V' },
  { code: 'ITM-011', desc: 'Safety Equipment Bundle' },
  { code: 'ITM-012', desc: 'Electrical Wiring Components' },
  { code: 'ITM-013', desc: 'HVAC Filter Replacement Set' },
  { code: 'ITM-014', desc: 'Cleaning Supplies Kit' },
  { code: 'ITM-015', desc: 'Packing Materials - Bubble Wrap' },
];

const poStatuses = ['Confirmed', 'Partial', 'Completed', 'Pending', 'Approved'];
const receivingStatuses = ['Open', 'Partial', 'Completed', 'Pending', 'Approved'];

// Generate mock vendor search data
export const mockVendorSearchData: VendorSearchResult[] = vendors.map((vendorName, vIndex) => {
  const vendorId = `VND-${String(vIndex + 1001).padStart(4, '0')}`;
  const numPOs = Math.floor(rand() * 8) + 3; // 3-10 POs per vendor
  const numReceivings = Math.floor(rand() * 6) + 2; // 2-7 receivings per vendor
  
  const purchaseOrders: PurchaseOrder[] = [];
  const receivingDocuments: ReceivingDocument[] = [];
  const allItems: Item[] = [];
  
  // Generate POs for this vendor
  for (let i = 0; i < numPOs; i++) {
    const poNumber = `PO-${String(vIndex * 100 + i + 1000).padStart(6, '0')}`;
    const numItems = Math.floor(rand() * 5) + 2; // 2-6 items per PO
    const poItems: Item[] = [];
    
    for (let j = 0; j < numItems; j++) {
      const itemData = items[Math.floor(rand() * items.length)];
      const quantity = Math.floor(rand() * 50) + 1;
      const unitPrice = Math.floor(rand() * 50000) / 100;
      
      poItems.push({
        id: `${poNumber}-ITEM-${j + 1}`,
        itemCode: itemData.code,
        type: 'item',
        description: itemData.desc,
        quantity,
        unitPrice,
        amount: quantity * unitPrice,
        vendorId,
        vendorName,
        poNumber,
      });
    }
    
    const totalAmount = poItems.reduce((sum, item) => sum + item.amount, 0);
    
    purchaseOrders.push({
      id: `PO-${vIndex}-${i}`,
      poNumber,
      type: 'po',
      vendorId,
      vendorName,
      date: new Date(2025, Math.floor(rand() * 12), Math.floor(rand() * 28) + 1).toISOString().split('T')[0],
      totalAmount,
      status: poStatuses[Math.floor(rand() * poStatuses.length)],
      items: poItems,
    });
    
    allItems.push(...poItems);
  }
  
  // Generate receiving documents for this vendor
  for (let i = 0; i < numReceivings; i++) {
    const receivingNumber = `RCV-${String(vIndex * 50 + i + 5000).padStart(6, '0')}`;
    const relatedPO = purchaseOrders[Math.floor(rand() * purchaseOrders.length)];
    const numItems = Math.floor(rand() * 4) + 1; // 1-4 items per receiving
    const recItems: Item[] = [];
    
    for (let j = 0; j < numItems; j++) {
      const itemData = items[Math.floor(rand() * items.length)];
      const quantity = Math.floor(rand() * 30) + 1;
      const unitPrice = Math.floor(rand() * 40000) / 100;
      
      recItems.push({
        id: `${receivingNumber}-ITEM-${j + 1}`,
        itemCode: itemData.code,
        type: 'item',
        description: itemData.desc,
        quantity,
        unitPrice,
        amount: quantity * unitPrice,
        vendorId,
        vendorName,
        receivingNumber,
        poNumber: relatedPO.poNumber,
      });
    }
    
    const totalAmount = recItems.reduce((sum, item) => sum + item.amount, 0);
    
    receivingDocuments.push({
      id: `RCV-${vIndex}-${i}`,
      receivingNumber,
      type: 'receiving',
      vendorId,
      vendorName,
      poNumber: relatedPO.poNumber,
      date: new Date(2025, Math.floor(rand() * 12), Math.floor(rand() * 28) + 1).toISOString().split('T')[0],
      totalAmount,
      status: receivingStatuses[Math.floor(rand() * receivingStatuses.length)],
      items: recItems,
    });
    
    allItems.push(...recItems);
  }
  
  return {
    id: vendorId,
    name: vendorName,
    code: vendorId,
    type: 'vendor',
    totalPOs: numPOs,
    totalReceivings: numReceivings,
    openBalance: Math.floor(rand() * 100000),
    purchaseOrders,
    receivingDocuments,
    items: allItems,
  };
});
