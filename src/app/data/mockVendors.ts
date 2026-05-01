export interface LineItem {
  id: string;
  sku: string;
  description: string;
  quantity: number;
  uom: string;
  unitPrice: number;
  totalPrice: number;
  receivedQty?: number;
  invoicedQty?: number;
  image?: string;
  [key: string]: any;
}

export interface VendorPO {
  poNumber: string;
  poDate: string;
  poAmount: number;
  status: string;
  itemCount: number;
  items: LineItem[];
  invoicedAmount?: number; // New: track invoiced amount at PO level
}

export interface VendorGRN {
  grnNumber: string;
  grnDate: string;
  receivedQty: number;
  poNumber: string;
  status: string;
  items: LineItem[];
  vendorName?: string; // For global view
  vendorCode?: string; // For global view
}

export interface Vendor {
  id: string;
  vendorCode: string;
  vendorName: string;
  category: string;
  currency: string;
  paymentTerms: string;
  purchaseOrders: VendorPO[];
  receivingDocuments: VendorGRN[];
  createdBy: string;
  createdOn: string;
  type: 'Domestic' | 'International' | 'Service' | 'Manufacturing';
  imageUrl?: string;
}

const vendorCategories = [
  'Seller (Items)',
  'Sub Contractor',
  'Service Provider',
  'Carrier'
];

const companyPrefixes = [
  'Acme', 'Global', 'Premier', 'United', 'Superior', 'Advanced', 'Elite', 'Prime',
  'Mega', 'Ultra', 'Dynamic', 'Strategic', 'Precision', 'Quality', 'Reliable',
  'Phoenix', 'Summit', 'Apex', 'Nexus', 'Vertex', 'Quantum', 'Stellar', 'Titan',
  'Vanguard', 'Zenith', 'Alpha', 'Beta', 'Sigma', 'Omega', 'Delta'
];

const companySuffixes = [
  'Corp', 'Industries', 'Solutions', 'Systems', 'Technologies', 'Services',
  'Enterprises', 'Group', 'International', 'Global', 'Associates', 'Partners',
  'Supply Co', 'Manufacturing', 'Distribution', 'Logistics', 'Trading'
];

function generateVendorName(index: number): string {
  const prefix = companyPrefixes[index % companyPrefixes.length];
  const suffix = companySuffixes[Math.floor(index / companyPrefixes.length) % companySuffixes.length];
  return `${prefix} ${suffix}`;
}

function generatePOs(vendorCode: string, count: number): VendorPO[] {
  const pos: VendorPO[] = [];
  const statuses = ['Open', 'Partially Received', 'Fully Received', 'Closed', 'Partially Invoiced', 'Fully Invoiced'];
  const items_list = [
    { sku: 'ELEC-M-992', desc: 'Power Management IC - High Efficiency 450V', uom: 'pcs', img: 'https://images.unsplash.com/photo-1672689933227-2ce1249c46a9?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxpbmR1c3RyaWFsJTIwZWxlY3Ryb25pY3MlMjBlcXVpcG1lbnQlMjBjb21wb25lbnR8ZW58MXx8fHwxNzcwMzkxOTQ5fDA&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral' },
    { sku: 'CAB-XL-10', desc: 'Heavy Duty 10AWG Copper Cable - Shielded', uom: 'm', img: 'https://images.unsplash.com/photo-1767340078306-89630b12d81c?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxpbmR1c3RyaWFsJTIwbWFjaGluZXJ5JTIwc3BhcmUlMjBwYXJ0cyUyMG1ldGFsfGVufDF8fHx8MTc3MDM5MTk0OXww&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral' },
    { sku: 'BRKT-IND-22', desc: 'Mounting Brackets - Galvanized Steel', uom: 'units', img: 'https://images.unsplash.com/photo-1769355104335-acef3aa4c9b6?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxwYWNrYWdpbmclMjBib3hlcyUyMGxvZ2lzdGljcyUyMG1hdGVyaWFsc3xlbnwxfHx8fDE3NzAzOTE5NDl8MA&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral' },
    { sku: 'TECH-PC-01', desc: 'Office Workstation Hardware Pro', uom: 'SET', img: 'https://images.unsplash.com/photo-1758857087505-957823893209?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxvZmZpY2UlMjB0ZWNobm9sb2d5JTIwaGFyZHdhcmUlMjBkZXZpY2VzfGVufDF8fHx8MTc3MDM5MTk0OXww&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral' },
    { sku: 'STEEL-001', desc: 'Industrial Steel Pipes', uom: 'EA', img: 'https://images.unsplash.com/photo-1767340078306-89630b12d81c?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxpbmR1c3RyaWFsJTIwbWFjaGluZXJ5JTIwc3BhcmUlMjBwYXJ0cyUyMG1ldGFsfGVufDF8fHx8MTc3MDM5MTk0OXww&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral' },
    { sku: 'COPPER-042', desc: 'Copper Fittings', uom: 'FT', img: 'https://images.unsplash.com/photo-1767340078306-89630b12d81c?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxpbmR1c3RyaWFsJTIwbWFjaGluZXJ5JTIwc3BhcmUlMjBwYXJ0cyUyMG1ldGFsfGVufDF8fHx8MTc3MDM5MTk0OXww&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral' },
    { sku: 'WELD-99', desc: 'Welding Rods Pack', uom: 'PK', img: 'https://images.unsplash.com/photo-1767340078306-89630b12d81c?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxpbmR1c3RyaWFsJTIwbWFjaGluZXJ5JTIwc3BhcmUlMjBwYXJ0cyUyMG1ldGFsfGVufDF8fHx8MTc3MDM5MTk0OXww&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral' },
    { sku: 'HYD-FL-5L', desc: 'Hydraulic Fluid', uom: 'LBS', img: 'https://images.unsplash.com/photo-1769355104335-acef3aa4c9b6?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxwYWNrYWdpbmclMjBib3hlcyUyMGxvZ2lzdGljcyUyMG1hdGVyaWFsc3xlbnwxfHx8fDE3NzAzOTE5NDl8MA&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral' },
    { sku: 'SAFE-H-01', desc: 'Safety Helmets', uom: 'EA', img: 'https://images.unsplash.com/photo-1769355104335-acef3aa4c9b6?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxwYWNrYWdpbmclMjBib3hlcyUyMGxvZ2lzdGljcyUyMG1hdGVyaWFsc3xlbnwxfHx8fDE3NzAzOTE5NDl8MA&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral' },
    { sku: 'GLOVE-B', desc: 'Work Gloves (Bulk)', uom: 'KG', img: 'https://images.unsplash.com/photo-1769355104335-acef3aa4c9b6?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxwYWNrYWdpbmclMjBib3hlcyUyMGxvZ2lzdGljcyUyMG1hdGVyaWFsc3xlbnwxfHx8fDE3NzAzOTE5NDl8MA&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral' }
  ];
  
  for (let i = 0; i < count; i++) {
    const year = 2024;
    const month = (i % 12) + 1;
    // User requested 10 to 20 items per PO
    const itemCount = Math.floor(Math.random() * 11) + 10; 
    const items: LineItem[] = [];
    let poAmount = 0;
    let invoicedAmount = 0;

    const poStatus = statuses[i % statuses.length];

    for (let j = 0; j < itemCount; j++) {
      const baseItem = items_list[j % items_list.length];
      const qty = Math.floor(Math.random() * 50) + 10;
      const price = Math.round((Math.random() * 50 + 5) * 100) / 100;
      const total = Math.round(qty * price * 100) / 100;
      
      let receivedQty = 0;
      let invoicedQty = 0;

      if (poStatus === 'Fully Received' || poStatus === 'Fully Invoiced' || poStatus === 'Closed') {
        receivedQty = qty;
      } else if (poStatus === 'Partially Received') {
        receivedQty = Math.floor(qty * 0.5);
      }

      if (poStatus === 'Fully Invoiced' || poStatus === 'Closed') {
        invoicedQty = qty;
      } else if (poStatus === 'Partially Invoiced') {
        invoicedQty = Math.floor(qty * 0.4);
      }

      poAmount += total;
      invoicedAmount += (invoicedQty * price);

      items.push({
        id: `item-${vendorCode}-${i}-${j}`,
        sku: baseItem.sku,
        description: baseItem.desc,
        quantity: qty,
        uom: baseItem.uom,
        unitPrice: price,
        totalPrice: total,
        receivedQty: receivedQty,
        invoicedQty: invoicedQty,
        image: baseItem.img
      });
    }

    pos.push({
      poNumber: `PO-2024-${String(parseInt(vendorCode.split('-')[1] || '1000') * 10 + i).padStart(5, '0')}`,
      poDate: `${year}-${String(month).padStart(2, '0')}-${String((i % 28) + 1).padStart(2, '0')}`,
      poAmount: Math.round(poAmount * 100) / 100,
      invoicedAmount: Math.round(invoicedAmount * 100) / 100,
      status: poStatus,
      itemCount: itemCount,
      items: items
    });
  }
  
  return pos;
}

function generateGRNs(pos: VendorPO[]): VendorGRN[] {
  const grns: VendorGRN[] = [];
  const statuses = ['Received', 'Inspected', 'Accepted', 'Partially Invoiced', 'Fully Invoiced'];
  
  // Logic for Multi-PO and Multi-GRN mapping
  // We'll process some POs normally, and some in a complex way
  
  const processedPOIndices = new Set<number>();

  // 1. Create a consolidated GRN that spans multiple POs
  if (pos.length >= 2) {
    const po1 = pos[0];
    const po2 = pos[1];
    
    const combinedItems: LineItem[] = [];
    [po1, po2].forEach(po => {
      po.items.slice(0, 3).forEach(item => {
        if ((item.receivedQty || 0) > 0) {
          combinedItems.push({
            ...item,
            quantity: item.receivedQty || 0,
            totalPrice: Math.round((item.unitPrice * (item.receivedQty || 0)) * 100) / 100
          });
        }
      });
    });

    if (combinedItems.length > 0) {
      grns.push({
        grnNumber: `REC-MULTI-${Math.floor(Math.random() * 9000) + 1000}`,
        grnDate: '2024-12-15',
        receivedQty: combinedItems.reduce((sum, item) => sum + item.quantity, 0),
        poNumber: `${po1.poNumber}, ${po2.poNumber}`,
        status: 'Accepted',
        items: combinedItems
      });
    }
  }

  // 2. Create multiple receiving documents for 3 POs (to ensure 3+ GRNs)
  const poIndicesToSplit = [2, 3, 4].filter(idx => idx < pos.length);
  
  poIndicesToSplit.forEach(idx => {
    const po = pos[idx];
    if (po.status === 'Open' || po.items.every(i => (i.receivedQty || 0) === 0)) return;
    
    const splitCount = 3 + (idx % 2); // 3 or 4
    const testItems = po.items.filter(item => (item.receivedQty || 0) > 0);
    
    if (testItems.length === 0) return;

    // We track how much of each item has been assigned to GRNs
    const assignedQtys = new Map<string, number>();

    for (let i = 0; i < splitCount; i++) {
      const grnDate = new Date(po.poDate);
      grnDate.setDate(grnDate.getDate() + 5 + i + (idx * 2));

      const grnItems = testItems.map(item => {
        const totalReceived = item.receivedQty || 0;
        const previouslyAssigned = assignedQtys.get(item.id) || 0;
        const remaining = totalReceived - previouslyAssigned;
        
        if (remaining <= 0) return null;

        let qty = 0;
        if (i === splitCount - 1) {
          // Last GRN gets the rest
          qty = remaining;
        } else {
          // Randomly decide if this item is in this GRN (80% chance for variety)
          if (Math.random() > 0.8 && testItems.length > 3) return null;
          
          // Assign a random portion (between 10% and 50% of total)
          const randomFactor = 0.1 + (Math.random() * 0.4);
          qty = Math.max(1, Math.floor(totalReceived * randomFactor));
          qty = Math.min(qty, remaining - (splitCount - 1 - i)); // Ensure enough left for future GRNs
        }
        
        if (qty <= 0) return null;
        
        assignedQtys.set(item.id, previouslyAssigned + qty);
          
        return {
          ...item,
          quantity: qty,
          totalPrice: Math.round((item.unitPrice * qty) * 100) / 100
        };
      }).filter((item): item is LineItem => item !== null);

      if (grnItems.length > 0) {
        grns.push({
          grnNumber: `REC-SPLIT-${po.poNumber.split('-').pop()}-${i + 1}`,
          grnDate: grnDate.toISOString().split('T')[0],
          receivedQty: grnItems.reduce((sum, item) => sum + item.quantity, 0),
          poNumber: po.poNumber,
          status: 'Received',
          items: grnItems
        });
      }
    }
    processedPOIndices.add(idx);
  });

  // 3. Process remaining POs normally
  pos.forEach((po, index) => {
    if (processedPOIndices.has(index)) return;
    if (po.status === 'Open' || po.items.every(i => (i.receivedQty || 0) === 0)) return;

    const poDate = new Date(po.poDate);
    const grnDate = new Date(poDate);
    grnDate.setDate(grnDate.getDate() + Math.floor(Math.random() * 10) + 5);
    
    const grnItems: LineItem[] = po.items
      .filter(item => (item.receivedQty || 0) > 0)
      .map(item => ({
        ...item,
        quantity: item.receivedQty || 0,
        totalPrice: Math.round((item.unitPrice * (item.receivedQty || 0)) * 100) / 100
      }));

    if (grnItems.length > 0) {
      grns.push({
        grnNumber: `REC-2024-${String(index * 100 + 5000).padStart(6, '0')}`,
        grnDate: grnDate.toISOString().split('T')[0],
        receivedQty: grnItems.reduce((sum, item) => sum + item.quantity, 0),
        poNumber: po.poNumber,
        status: po.status === 'Fully Invoiced' ? 'Fully Invoiced' : statuses[index % statuses.length],
        items: grnItems
      });
    }
  });
  
  return grns;
}

export const mockVendors: Vendor[] = Array.from({ length: 40 }, (_, index) => {
  const vendorCode = `V-${String(1000 + index).padStart(5, '0')}`;
  const vendorName = generateVendorName(index);
  const category = vendorCategories[index % vendorCategories.length];
  
  let pos: VendorPO[];
  let grns: VendorGRN[];

  if (index === 0) {
    // Special case for the first vendor to have complex data
    // We need: Open, Partially Received, Fully Received, Partially Invoiced
    const statuses = ['Open', 'Partially Received', 'Fully Received', 'Partially Invoiced', 'Closed', 'Fully Invoiced'];
    pos = [];
    grns = [];

    statuses.forEach((status, i) => {
      const itemCount = 12;
      const items: LineItem[] = [];
      let poAmount = 0;
      let invoicedAmount = 0;

      for (let j = 0; j < itemCount; j++) {
        const baseItemsList = [
          { sku: 'STEEL-001', desc: 'Industrial Steel Pipes', uom: 'EA', img: 'https://images.unsplash.com/photo-1767340078306-89630b12d81c?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxpbmR1c3RyaWFsJTIwbWFjaGluZXJ5JTIwc3BhcmUlMjBwYXJ0cyUyMG1ldGFsfGVufDF8fHx8MTc3MDM5MTk0OXww&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral' },
          { sku: 'COPPER-042', desc: 'Copper Fittings', uom: 'FT', img: 'https://images.unsplash.com/photo-1767340078306-89630b12d81c?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxpbmR1c3RyaWFsJTIwbWFjaGluZXJ5JTIwc3BhcmUlMjBwYXJ0cyUyMG1ldGFsfGVufDF8fHx8MTc3MDM5MTk0OXww&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral' },
          { sku: 'WELD-99', desc: 'Welding Rods Pack', uom: 'PK', img: 'https://images.unsplash.com/photo-1767340078306-89630b12d81c?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxpbmR1c3RyaWFsJTIwbWFjaGluZXJ5JTIwc3BhcmUlMjBwYXJ0cyUyMG1ldGFsfGVufDF8fHx8MTc3MDM5MTk0OXww&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral' }
        ];
        const baseItem = baseItemsList[j % baseItemsList.length];
        
        const qty = 100;
        const price = 50.00;
        const total = qty * price;
        
        let receivedQty = 0;
        let invoicedQty = 0;

        // Received Qty Logic
        if (status === 'Fully Received' || status === 'Fully Invoiced' || status === 'Closed') {
          receivedQty = qty;
        } else if (status === 'Partially Received' || status === 'Partially Invoiced') {
          receivedQty = 60;
        } else if (status === 'Open') {
          receivedQty = 0;
        }

        // Invoiced Qty Logic
        if (status === 'Fully Invoiced' || status === 'Closed') {
          invoicedQty = qty;
        } else if (status === 'Partially Invoiced') {
          invoicedQty = 30;
        } else if (status === 'Open' && i === 0) {
          // Special case: Open PO that is Pre-Invoiced (no receipts, but invoiced)
          invoicedQty = 40; 
        }

        poAmount += total;
        invoicedAmount += (invoicedQty * price);

        items.push({
          id: `item-${vendorCode}-${i}-${j}`,
          sku: baseItem.sku,
          description: baseItem.desc,
          quantity: qty,
          uom: baseItem.uom,
          unitPrice: price,
          totalPrice: total,
          receivedQty: receivedQty,
          invoicedQty: invoicedQty,
          image: baseItem.img
        });
      }

      const poNumber = `PO-2024-V001-${i + 1}`;
      pos.push({
        poNumber,
        poDate: `2024-01-${String(i + 1).padStart(2, '0')}`,
        poAmount,
        invoicedAmount,
        status: status === 'Open' && invoicedAmount > 0 ? 'Partially Invoiced' : status,
        itemCount,
        items
      });

      // Create GRNs only for POs with receipts
      if (status !== 'Open') {
        const receivedItems = items.filter(item => (item.receivedQty || 0) > 0);
        if (receivedItems.length > 0) {
          // Distribute GRNs with random variety
          const splitCount = i < 3 ? 4 : 2;
          const assignedQtys = new Map<string, number>();
          
          for (let s = 0; s < splitCount; s++) {
             let grnStatus = 'Not Invoiced';
             
             // Target specific GRN distributions
             if (status === 'Partially Invoiced') {
                if (s === 0) grnStatus = 'Fully Invoiced';
                else if (s === 1) grnStatus = 'Partially Invoiced';
                else grnStatus = 'Not Invoiced';
             } else if (status === 'Fully Invoiced' || status === 'Closed') {
                grnStatus = 'Fully Invoiced';
             } else {
                if (s === 0 && i % 2 === 0) grnStatus = 'Partially Invoiced';
                else grnStatus = 'Not Invoiced';
             }

             const finalItems = receivedItems.map(item => {
                const totalReceived = item.receivedQty!;
                const previouslyAssigned = assignedQtys.get(item.id) || 0;
                const remaining = totalReceived - previouslyAssigned;
                
                if (remaining <= 0) return null;

                let share = 0;
                if (s === splitCount - 1) {
                  share = remaining;
                } else {
                  // Variety: Randomly skip some items (30% chance)
                  if (Math.random() > 0.7 && receivedItems.length > 2) return null;
                  
                  // Randomly assign a portion (between 15% and 45%)
                  const factor = 0.15 + (Math.random() * 0.3);
                  share = Math.max(1, Math.floor(totalReceived * factor));
                  share = Math.min(share, remaining - (splitCount - 1 - s));
                }

                if (share <= 0) return null;
                assignedQtys.set(item.id, previouslyAssigned + share);
                
                let itemInvoicedQty = 0;
                if (grnStatus === 'Fully Invoiced') itemInvoicedQty = share;
                else if (grnStatus === 'Partially Invoiced') itemInvoicedQty = Math.floor(share * (0.3 + Math.random() * 0.4));

                return {
                  ...item,
                  quantity: share,
                  totalPrice: Math.round(share * item.unitPrice * 100) / 100,
                  invoicedQty: itemInvoicedQty
                };
             }).filter((item): item is any => item != null) as LineItem[];

             if (finalItems.length > 0) {
                grns.push({
                  grnNumber: `REC-V001-PO${i + 1}-${String.fromCharCode(65 + s)}`,
                  grnDate: `2024-02-${String(1 + s * 5 + (i * 2)).padStart(2, '0')}`,
                  receivedQty: finalItems.reduce((sum, item) => sum + item.quantity, 0),
                  poNumber,
                  status: grnStatus,
                  items: finalItems,
                  vendorName,
                  vendorCode
                });
             }
          }
        }
      }
    });
  } else {
    const poCount = Math.floor(Math.random() * 3) + 8; 
    pos = generatePOs(vendorCode, poCount);
    grns = generateGRNs(pos).map((grn, gIdx) => {
      // Add variety to all vendors' GRNs to ensure 2+ of each status
      let grnStatus = grn.status;
      if (grnStatus !== 'Fully Invoiced' && grnStatus !== 'Partially Invoiced') {
        if (gIdx === 1 || gIdx === 3) grnStatus = 'Fully Invoiced';
        else if (gIdx === 2 || gIdx === 4) grnStatus = 'Partially Invoiced';
        else grnStatus = 'Not Invoiced';
      }
      return {
        ...grn,
        status: grnStatus,
        vendorName,
        vendorCode
      };
    });
  }
  
  const creators = ['Sarah Chen', 'James Wilson', 'Maria Garcia', 'Robert Taylor', 'Linda Martinez'];
  const types: ('Domestic' | 'International' | 'Service' | 'Manufacturing')[] = ['Domestic', 'International', 'Service', 'Manufacturing'];
  
  const createdOn = `2024-${String(Math.floor(Math.random() * 12) + 1).padStart(2, '0')}-${String(Math.floor(Math.random() * 28) + 1).padStart(2, '0')}`;

  return {
    id: `vendor-${index + 1}`,
    vendorCode,
    vendorName,
    category,
    currency: 'USD',
    paymentTerms: ['Net 30', 'Net 45', 'Net 60', '2/10 Net 30'][index % 4],
    purchaseOrders: pos,
    receivingDocuments: grns,
    createdBy: creators[index % creators.length],
    createdOn: createdOn,
    type: types[index % types.length],
    imageUrl: index % 3 === 0 ? `https://images.unsplash.com/photo-${index % 2 === 0 ? '1486406146926-c627a92ad1ab' : '1497366216548-37526070297c'}?auto=format&fit=crop&q=80&w=100&h=100` : undefined
  };
});
