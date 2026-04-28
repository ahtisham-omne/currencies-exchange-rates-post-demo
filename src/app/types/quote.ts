export type QuoteStatus = 
  | 'Draft' 
  | 'Sent to Customer' 
  | 'Unconfirmed SO' 
  | 'Confirmed SO' 
  | 'Cancelled' 
  | 'Archived'
  | 'Expired';

export type Priority = 'Urgent' | 'Medium' | 'Low';

export interface SalesRep {
  id: string;
  name: string;
  email: string;
  avatar?: string;
}

export interface Customer {
  id: string;
  name: string;
  logoUrl?: string;
  location?: {
    name: string;
    isPrimary: boolean;
  };
}

export interface PointOfContact {
  id: string;
  name: string;
  username?: string;
  email: string;
  phone?: string;
  isPrimary: boolean;
  role?: string;
}

export interface LineItem {
  id: string;
  productId: string;
  name: string;
  description: string;
  quantity: number;
  unitPrice: number;
  discount: number;
  total: number;
  image?: string;
  images?: string[];
  uom?: string;
}

export interface Adjustment {
  id: string;
  type: 'discount' | 'premium';
  amountType: '$' | '%';
  amount: number;
  label: string;
  internalNotes?: string;
}

export interface Quote {
  id: string;
  quoteNumber: string;
  version: number;
  customer: {
    id: string;
    name: string;
    logoUrl?: string;
    location?: {
      name: string;
      isPrimary: boolean;
    };
  };
  primaryPoC: PointOfContact;
  additionalPoCs?: PointOfContact[];
  status: QuoteStatus;
  totalValue: number;
  createdDate: Date;
  expiryDate: Date;
  salesRep: SalesRep;
  additionalSalesReps?: SalesRep[];
  priority: Priority;
  tags?: string[];
  description?: string;
  hasUnreadMessages: boolean;
  unreadMessageCount: number;
  daysInCurrentStage: number;
  respondBy?: Date;
  requestedDate?: Date;
  confirmationDate?: Date;
  lastUpdated: Date;
  winProbability?: number;
  cancellationReason?: string;
  items?: LineItem[];
  subtotal?: number;
  tax?: number;
  total?: number;
}

export interface ConfiguratorItem {
  id: string;
  name: string;
  quantity: number;
  unitPrice: number;
  total?: number;
  [key: string]: any;
}

export interface PaymentMethod {
  id: string;
  name: string;
  icon: 'Building' | 'CreditCard' | 'FileText' | 'Landmark';
}

export interface PaymentTerm {
  id: string;
  name: string;
  [key: string]: any;
}

export interface Contact {
  id: string;
  name: string;
  email: string;
  phone?: string;
  role?: string;
  isPrimary?: boolean;
}

export interface ColumnConfig {
  key: string;
  label: string;
  width: number;
  visible: boolean;
  sortable: boolean;
  alignment?: 'left' | 'center' | 'right';
}

export interface FilterConfig {
  statuses: QuoteStatus[];
  salesReps: string[];
  customers: string[];
  priorities: Priority[];
  dateRange?: { start: Date; end: Date };
  valueRange?: { min: number; max: number };
  tags: string[];
}

export interface SavedFilter {
  id: string;
  name: string;
  config: Partial<FilterConfig>;
}
