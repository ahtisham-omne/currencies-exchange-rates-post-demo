import { useState, useMemo } from 'react';
import { 
  ArrowLeft, 
  Maximize2, 
  Download, 
  MoreHorizontal, 
  FileText, 
  Link, 
  Edit, 
  Send, 
  Plus, 
  Calendar, 
  DollarSign, 
  Clock, 
  Building2, 
  Paperclip, 
  Package,
  FileCheck,
  Truck,
  ShieldCheck,
  History,
  ExternalLink,
  ChevronRight,
  Hash,
  CheckCircle2,
  AlertCircle,
  Globe,
  Layers,
  BarChart3,
  Receipt,
  Search,
  Printer,
  Copy,
  Eye,
  TrendingDown,
  CircleDot,
  Wallet,
  Flag,
  BookOpen
} from 'lucide-react';
import { Button } from '@/app/components/ui/button';
import { Badge } from '@/app/components/ui/badge';
import { Separator } from '@/app/components/ui/separator';
import { Invoice } from '@/app/data/mockInvoices';
import { mockVendors } from '@/app/data/mockVendors';
import { toast } from 'sonner';
import { ImageWithFallback } from './figma/ImageWithFallback';
import { VIMoneyCell } from '@/app/components/currency/VIMoneyCell';
import { InvoiceViewModeProvider, type InvoiceViewMode } from '@/app/components/currency/InvoiceViewModeContext';
import { VICurrencyHeaderControls } from '@/app/components/currency/VICurrencyHeaderControls';
import VICurrencyConfigModal from '@/app/components/currency/VICurrencyConfigModal';

interface InvoiceDetailScreenProps {
  invoiceId: string;
  onClose: () => void;
  invoices: Invoice[];
}

type TabType = 'overview' | 'items' | 'gl' | 'docs' | 'activity';

const statusColors: Record<string, { bg: string; text: string; dot: string }> = {
  'Pending Approval': { bg: 'bg-amber-50', text: 'text-amber-700', dot: 'bg-amber-400' },
  'Approved': { bg: 'bg-green-50', text: 'text-green-700', dot: 'bg-green-400' },
  'Partially Paid': { bg: 'bg-purple-50', text: 'text-purple-700', dot: 'bg-purple-400' },
  'Paid': { bg: 'bg-emerald-50', text: 'text-emerald-700', dot: 'bg-emerald-400' },
  'Exception': { bg: 'bg-red-50', text: 'text-red-700', dot: 'bg-red-400' },
  'Payment Hold': { bg: 'bg-red-50', text: 'text-red-700', dot: 'bg-red-400' },
  'Cancelled': { bg: 'bg-gray-100', text: 'text-gray-600', dot: 'bg-gray-400' },
};

export function InvoiceDetailScreen({ invoiceId, onClose, invoices }: InvoiceDetailScreenProps) {
  const invoice = invoices.find(inv => inv.id === invoiceId);
  const [activeTab, setActiveTab] = useState<TabType>('overview');
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [viewMode, setViewMode] = useState<InvoiceViewMode>('base');
  const [currencyConfigOpen, setCurrencyConfigOpen] = useState(false);

  const vendorData = useMemo(() => {
    if (!invoice) return null;
    return mockVendors.find(v => v.vendorName === invoice.vendor) || mockVendors[0];
  }, [invoice]);

  if (!invoice) return null;

  const isPreInvoice = invoice.type === 'Pre-Invoice';
  const subtotal = invoice.amount * 0.92;
  const tax = invoice.amount * 0.06;
  const freight = invoice.amount * 0.02;
  const daysUntilDue = Math.ceil((new Date(invoice.dueDate).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
  const sc = statusColors[invoice.status] || statusColors['Pending Approval'];
  const paymentProgress = invoice.amount > 0 ? Math.round(((invoice.amount - invoice.outstandingBalance) / invoice.amount) * 100) : 0;

  const tabs: { id: TabType; label: string; icon: React.ReactNode }[] = [
    { id: 'overview', label: 'Overview', icon: <Layers className="w-3.5 h-3.5" /> },
    { id: 'items', label: 'Line Items', icon: <Package className="w-3.5 h-3.5" /> },
    { id: 'gl', label: 'GL Impact', icon: <BookOpen className="w-3.5 h-3.5" /> },
    { id: 'docs', label: 'Attachments', icon: <Paperclip className="w-3.5 h-3.5" /> },
    { id: 'activity', label: 'Activity', icon: <History className="w-3.5 h-3.5" /> },
  ];

  return (
    <InvoiceViewModeProvider value={viewMode}>
    <div className={`fixed inset-0 z-[60] flex items-center justify-center ${isFullScreen ? '' : 'bg-black/40 backdrop-blur-sm p-3'}`}>
      <div className={`bg-[#f8f9fb] flex flex-col transition-all duration-300 overflow-hidden shadow-2xl ${
        isFullScreen ? 'w-full h-full' : 'rounded-xl w-full max-w-[1360px] h-[94vh] border border-gray-200/60'
      }`}>
        
        {/* ━━━ TOP NAV BAR (Omne-style) ━━━ */}
        <div className="bg-white border-b border-gray-200 px-4 h-[46px] flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <div className="w-[22px] h-[22px] bg-[#2563eb] rounded-[5px] flex items-center justify-center">
                <span className="text-[10px] text-white" style={{ fontWeight: 700 }}>O</span>
              </div>
              <span className="text-[13px] text-gray-800" style={{ fontWeight: 600 }}>Omne</span>
            </div>
            <div className="flex items-center gap-1.5 text-[11px] text-gray-400">
              <span className="hover:text-gray-600 cursor-pointer">Accounting</span>
              <span>/</span>
              <span className="hover:text-gray-600 cursor-pointer">Invoices</span>
              <span>/</span>
              <span className="text-gray-700" style={{ fontWeight: 500 }}>Invoice Details</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1 bg-gray-50 border border-gray-200 rounded-lg px-2.5 py-1.5 w-[180px]">
              <Search className="w-3.5 h-3.5 text-gray-400" />
              <span className="text-[11px] text-gray-400">Search</span>
            </div>
            <div className="flex items-center gap-2 ml-2">
              <div className="text-right">
                <p className="text-[11px] text-gray-800 leading-none" style={{ fontWeight: 600 }}>Ahtisham Ahmad</p>
                <p className="text-[10px] text-gray-400 leading-none mt-0.5">Controller</p>
              </div>
              <div className="w-7 h-7 rounded-full bg-gray-200 border border-gray-200 overflow-hidden">
                <ImageWithFallback src="https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?auto=format&fit=crop&w=100&q=80" alt="User" className="w-full h-full object-cover" />
              </div>
            </div>
          </div>
        </div>

        {/* ━━━ HERO PROFILE CARD ━━━ */}
        <div className="bg-white border-b border-gray-200 px-6 py-4 shrink-0">
          <div className="flex items-start justify-between">
            <div className="flex items-start gap-4">
              <button onClick={onClose} className="mt-1 p-1.5 hover:bg-gray-100 rounded-lg transition-colors cursor-pointer text-gray-400">
                <ArrowLeft className="w-4 h-4" />
              </button>
              {/* Invoice Thumbnail */}
              <div className="w-[52px] h-[52px] rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center shadow-sm shrink-0">
                <FileText className="w-6 h-6 text-white" />
              </div>
              <div>
                <div className="flex items-center gap-2.5">
                  <h1 className="text-[16px] text-gray-900 tracking-tight" style={{ fontWeight: 700 }}>{invoice.invoiceNumber}</h1>
                </div>
                <p className="text-[12px] text-gray-500 mt-0.5">{invoice.vendor} &mdash; {invoice.description || 'Standard procurement invoice'}</p>
                <div className="flex items-center gap-2 mt-2">
                  <Badge className={`h-[20px] text-[10px] px-2 border-0 rounded-full ${sc.bg} ${sc.text}`} style={{ fontWeight: 600 }}>
                    {invoice.status}
                  </Badge>
                  <Badge className={`h-[20px] text-[10px] px-2 border-0 rounded-full ${isPreInvoice ? 'bg-amber-50 text-amber-700' : 'bg-sky-50 text-sky-700'}`} style={{ fontWeight: 600 }}>
                    {invoice.type}
                  </Badge>
                  <Badge className="h-[20px] text-[10px] px-2 border-0 rounded-full bg-gray-100 text-gray-500" style={{ fontWeight: 500 }}>
                    {isPreInvoice ? '2-Way Match' : '3-Way Match'}
                  </Badge>
                  {invoice.linkedPOs.length > 0 && (
                    <span className="text-[10px] text-gray-400" style={{ fontWeight: 500 }}>
                      {invoice.linkedPOs.length} PO{invoice.linkedPOs.length > 1 ? 's' : ''} linked
                    </span>
                  )}
                  {invoice.linkedGRNs.length > 0 && (
                    <span className="text-[10px] text-gray-400" style={{ fontWeight: 500 }}>
                      {invoice.linkedGRNs.length} GRN{invoice.linkedGRNs.length > 1 ? 's' : ''} linked
                    </span>
                  )}
                </div>
              </div>
            </div>
            <div className="flex flex-col items-end gap-2">
              <div className="flex items-center gap-2">
                <Button variant="ghost" size="icon" onClick={() => setIsFullScreen(!isFullScreen)} className="h-8 w-8 text-gray-400 hover:text-gray-600">
                  <Maximize2 className="w-4 h-4" />
                </Button>
                <Button className="h-8 bg-[#2563eb] hover:bg-blue-700 text-white text-[12px] px-4 rounded-lg gap-1.5" style={{ fontWeight: 600 }}>
                  <Edit className="w-3.5 h-3.5" /> Edit
                </Button>
                <Button variant="outline" size="icon" className="h-8 w-8 border-gray-200 text-gray-400">
                  <MoreHorizontal className="w-4 h-4" />
                </Button>
              </div>
              <VICurrencyHeaderControls
                invoice={invoice}
                viewMode={viewMode}
                onViewModeChange={setViewMode}
                onOpenConfig={() => setCurrencyConfigOpen(true)}
              />
            </div>
          </div>
        </div>

        {/* ━━━ KPI METRICS STRIP ━━━ */}
        <div className="bg-white border-b border-gray-200 px-6 py-3 shrink-0">
          <div className="flex items-center gap-0 divide-x divide-gray-100">
            <KpiMetric
              icon={<DollarSign className="w-4 h-4" />}
              iconColor="bg-emerald-50 text-emerald-600"
              label="Invoice Amount"
              value={<VIMoneyCell value={invoice.amount} invoice={invoice} />}
            />
            <KpiMetric
              icon={<TrendingDown className="w-4 h-4" />}
              iconColor="bg-blue-50 text-blue-600"
              label="Outstanding"
              value={<VIMoneyCell value={invoice.outstandingBalance} invoice={invoice} />}
            />
            <KpiMetric
              icon={<Clock className="w-4 h-4" />}
              iconColor="bg-orange-50 text-orange-600"
              label="Due Date"
              value={invoice.dueDate}
              sub={daysUntilDue > 0 ? `${daysUntilDue}d remaining` : 'Overdue'}
              subColor={daysUntilDue > 0 ? 'text-gray-400' : 'text-red-500'}
            />
            <KpiMetric
              icon={<Receipt className="w-4 h-4" />}
              iconColor="bg-violet-50 text-violet-600"
              label="Avg Cost"
              value={<VIMoneyCell value={subtotal / 12} invoice={invoice} />}
            />
            <KpiMetric
              icon={<BarChart3 className="w-4 h-4" />}
              iconColor="bg-sky-50 text-sky-600"
              label="Total Value"
              value={<VIMoneyCell value={invoice.amount} invoice={invoice} />}
            />
          </div>
        </div>

        {/* ━━━ TAB NAVIGATION ━━━ */}
        <div className="bg-white border-b border-gray-200 px-6 flex items-center shrink-0">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-1.5 px-3 py-2.5 text-[12px] border-b-2 transition-all cursor-pointer ${
                activeTab === tab.id
                  ? 'border-[#2563eb] text-[#2563eb]'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
              style={{ fontWeight: activeTab === tab.id ? 600 : 500 }}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>

        {/* ━━━ SCROLLABLE CONTENT BODY ━━━ */}
        <div className="flex-1 overflow-y-auto">
          <div className="p-6 max-w-[1300px] mx-auto pb-8">
            
            {/* ═══ OVERVIEW TAB ═══ */}
            {activeTab === 'overview' && (
              <div className="space-y-5">
                {/* TOP KPI CARDS ROW (like reference: Open Purchase Orders, etc.) */}
                <div className="grid grid-cols-4 gap-4">
                  <OverviewKpiCard
                    label="Payment Progress"
                    value={`${paymentProgress}%`}
                    status={paymentProgress === 100 ? 'Paid' : paymentProgress > 0 ? 'Partial' : 'Unpaid'}
                    statusColor={paymentProgress === 100 ? 'text-emerald-600' : paymentProgress > 0 ? 'text-blue-600' : 'text-gray-400'}
                    sub={<><VIMoneyCell value={invoice.amount - invoice.outstandingBalance} invoice={invoice} /> of <VIMoneyCell value={invoice.amount} invoice={invoice} /></>}
                  />
                  <OverviewKpiCard 
                    label="Invoice Terms" 
                    value={vendorData?.paymentTerms || 'Net 30'} 
                    status="Standard"
                    statusColor="text-emerald-600"
                    sub={`Due: ${invoice.dueDate}`}
                  />
                  <OverviewKpiCard 
                    label="Match Level" 
                    value={isPreInvoice ? '2-Way' : '3-Way'} 
                    status="Verified"
                    statusColor="text-emerald-600"
                    sub={isPreInvoice ? 'PO Match Only' : 'PO + GRN + Invoice'}
                    change={<CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />}
                  />
                  <OverviewKpiCard 
                    label="Days Until Due" 
                    value={String(Math.abs(daysUntilDue))} 
                    status={daysUntilDue > 0 ? 'On Track' : 'Overdue'}
                    statusColor={daysUntilDue > 0 ? 'text-emerald-600' : 'text-red-600'}
                    sub={daysUntilDue > 0 ? `Standard: ${vendorData?.paymentTerms || 'Net 30'}` : 'Immediate attention required'}
                  />
                </div>

                {/* MAIN CONTENT: 3-COLUMN GRID */}
                <div className="grid grid-cols-3 gap-4">
                  
                  {/* LEFT: Vendor / Primary Info Card (like "Primary Vendor" in reference) */}
                  <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                    <div className="px-4 py-2.5 border-b border-gray-100 flex items-center justify-between">
                      <span className="text-[11px] text-gray-500" style={{ fontWeight: 600 }}>Vendor Information</span>
                      <Badge className="bg-emerald-50 text-emerald-600 border-0 h-[18px] px-1.5 text-[9px] rounded-full" style={{ fontWeight: 600 }}>Active</Badge>
                    </div>
                    <div className="p-4">
                      <div className="flex items-center gap-3 mb-4">
                        <div className="w-9 h-9 rounded-lg bg-gray-100 border border-gray-200 flex items-center justify-center overflow-hidden">
                          <Building2 className="w-4 h-4 text-gray-400" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-[13px] text-gray-900 truncate" style={{ fontWeight: 600 }}>{invoice.vendor}</p>
                          <p className="text-[10px] text-gray-400">{vendorData?.vendorCode || 'V-01000'} &bull; {vendorData?.category || 'Seller (Items)'}</p>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-3 pt-3 border-t border-gray-100">
                        <div>
                          <p className="text-[10px] text-gray-400 mb-0.5">Payment Terms</p>
                          <p className="text-[13px] text-gray-900" style={{ fontWeight: 600 }}>{vendorData?.paymentTerms || 'Net 30'}</p>
                        </div>
                        <div>
                          <p className="text-[10px] text-gray-400 mb-0.5">Currency</p>
                          <p className="text-[13px] text-gray-900" style={{ fontWeight: 600 }}>{invoice.currency}</p>
                        </div>
                      </div>
                    </div>
                    <div className="px-4 pb-3 pt-1">
                      <button className="w-full text-center py-2 text-[11px] text-gray-500 hover:text-blue-600 border border-gray-100 rounded-lg hover:border-blue-200 transition-colors" style={{ fontWeight: 500 }}>
                        View Vendor Profile
                      </button>
                    </div>
                  </div>

                  {/* MIDDLE: Financial Summary (like "Top Customers" card in reference) */}
                  <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                    <div className="px-4 py-2.5 border-b border-gray-100">
                      <span className="text-[11px] text-gray-500" style={{ fontWeight: 600 }}>Financial Breakdown</span>
                    </div>
                    <div className="p-4 space-y-3">
                      <FinancialRow label="Items Subtotal" value={<VIMoneyCell value={subtotal} invoice={invoice} />} />
                      <FinancialRow label="Tax (6%)" value={<VIMoneyCell value={tax} invoice={invoice} />} />
                      <FinancialRow label="Freight" value={<VIMoneyCell value={freight} invoice={invoice} />} />
                      <Separator className="bg-gray-100" />
                      <div className="flex justify-between items-center pt-1">
                        <span className="text-[12px] text-gray-700" style={{ fontWeight: 600 }}>Total Amount</span>
                        <span className="text-[16px] text-gray-900" style={{ fontWeight: 700 }}><VIMoneyCell value={invoice.amount} invoice={invoice} /></span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-[11px] text-gray-400" style={{ fontWeight: 500 }}>Outstanding Balance</span>
                        <span className="text-[13px] text-blue-600" style={{ fontWeight: 600 }}><VIMoneyCell value={invoice.outstandingBalance} invoice={invoice} /></span>
                      </div>
                      {/* Payment Progress Bar */}
                      <div className="pt-2">
                        <div className="flex justify-between mb-1">
                          <span className="text-[10px] text-gray-400">Payment Progress</span>
                          <span className="text-[10px] text-gray-500" style={{ fontWeight: 600 }}>{paymentProgress}%</span>
                        </div>
                        <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-blue-500 rounded-full transition-all" 
                            style={{ width: `${paymentProgress}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* RIGHT: Linked Records + Metadata (like "Top Locations" card) */}
                  <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                    <div className="px-4 py-2.5 border-b border-gray-100">
                      <span className="text-[11px] text-gray-500" style={{ fontWeight: 600 }}>Linked Records</span>
                    </div>
                    <div className="p-4 space-y-2">
                      {invoice.linkedPOs.length > 0 ? invoice.linkedPOs.map((po, idx) => (
                        <LinkedRecord key={idx} label={po} type="Purchase Order" />
                      )) : (
                        <LinkedRecord label="No PO Linked" type="Purchase Order" muted />
                      )}
                      {invoice.linkedGRNs.length > 0 ? invoice.linkedGRNs.map((grn, idx) => (
                        <LinkedRecord key={idx} label={grn} type="Receiving Document" />
                      )) : (
                        <LinkedRecord label="No GRN Linked" type="Receiving Document" muted />
                      )}
                      <Separator className="bg-gray-100 my-2" />
                      <div className="space-y-2.5 pt-1">
                        <div className="flex justify-between items-center">
                          <span className="text-[10px] text-gray-400" style={{ fontWeight: 500 }}>Created By</span>
                          <span className="text-[11px] text-gray-700" style={{ fontWeight: 600 }}>Ahtisham Ahmad</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-[10px] text-gray-400" style={{ fontWeight: 500 }}>Created On</span>
                          <span className="text-[11px] text-gray-700" style={{ fontWeight: 500 }}>Feb 19, 2026</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-[10px] text-gray-400" style={{ fontWeight: 500 }}>A/P Account</span>
                          <span className="text-[11px] text-blue-600 font-mono" style={{ fontWeight: 600 }}>{invoice.apAccount}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* GENERAL INFORMATION ROW */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                    <div className="px-4 py-2.5 border-b border-gray-100 flex items-center justify-between">
                      <span className="text-[11px] text-gray-500" style={{ fontWeight: 600 }}>General Information</span>
                      <Badge className="bg-gray-50 text-gray-400 border-0 h-[18px] px-1.5 text-[9px] rounded-full" style={{ fontWeight: 500 }}>Master Data</Badge>
                    </div>
                    <div className="p-4">
                      <div className="grid grid-cols-2 gap-x-8 gap-y-4">
                        <InfoField label="Invoice ID" value={invoice.invoiceNumber} />
                        <InfoField label="Vendor Reference #" value={invoice.vendorInvoiceNumber || 'VEN-9210-X-40'} />
                        <InfoField label="Invoice Date" value={invoice.date} />
                        <InfoField label="Due Date" value={invoice.dueDate} />
                        <InfoField label="Invoice Type" value={invoice.type} />
                        <InfoField label="Currency" value={`${invoice.currency} (US Dollar)`} />
                        <InfoField label="A/P Account" value={invoice.apAccount} highlight />
                        <InfoField label="Posting Date" value={invoice.postingDate || invoice.date} />
                      </div>
                      {invoice.description && (
                        <div className="mt-4 pt-3 border-t border-gray-100">
                          <p className="text-[10px] text-gray-400 mb-1.5" style={{ fontWeight: 500 }}>Description / Memo</p>
                          <p className="text-[12px] text-gray-600 leading-relaxed bg-gray-50 p-3 rounded-lg border border-gray-100">
                            {invoice.description}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                    <div className="px-4 py-2.5 border-b border-gray-100">
                      <span className="text-[11px] text-gray-500" style={{ fontWeight: 600 }}>Logistics & Freight</span>
                    </div>
                    <div className="p-4">
                      <div className="grid grid-cols-2 gap-x-8 gap-y-4">
                        <InfoField label="Freight Carrier" value="FedEx Ground Express" />
                        <InfoField label="Tracking #" value="WB-9821037465-X" />
                        <InfoField label="Shipment Method" value="Direct-to-Warehouse" />
                        <InfoField label="Freight Cost" value={<VIMoneyCell value={freight} invoice={invoice} />} highlight />
                      </div>
                    </div>

                    {/* Alerts Section */}
                    <div className="px-4 pb-4 space-y-2.5 pt-2">
                      <div className="flex items-start gap-2.5 bg-amber-50/70 border border-amber-100 rounded-lg p-3">
                        <AlertCircle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                        <div>
                          <p className="text-[11px] text-amber-800" style={{ fontWeight: 600 }}>Split Logic Active</p>
                          <p className="text-[10px] text-amber-600 mt-0.5 leading-relaxed">System created parent/child records for partial receipt alignment.</p>
                        </div>
                      </div>
                      <div className="flex items-start gap-2.5 bg-emerald-50/70 border border-emerald-100 rounded-lg p-3">
                        <ShieldCheck className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                        <div>
                          <p className="text-[11px] text-emerald-800" style={{ fontWeight: 600 }}>Match Verified</p>
                          <p className="text-[10px] text-emerald-600 mt-0.5 leading-relaxed">Price and quantity variance within threshold (&plusmn;2%). Ready for posting.</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ═══ LINE ITEMS TAB ═══ */}
            {activeTab === 'items' && (
              <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse">
                    <thead className="bg-gray-50 border-b border-gray-200">
                      <tr>
                        <th className="px-4 py-3 text-left text-[10px] text-gray-500 w-[45%]" style={{ fontWeight: 600 }}>Item Description</th>
                        <th className="px-4 py-3 text-left text-[10px] text-gray-500" style={{ fontWeight: 600 }}>GL Account</th>
                        <th className="px-4 py-3 text-center text-[10px] text-gray-500" style={{ fontWeight: 600 }}>Qty</th>
                        <th className="px-4 py-3 text-right text-[10px] text-gray-500" style={{ fontWeight: 600 }}>Unit Price</th>
                        <th className="px-4 py-3 text-right text-[10px] text-gray-500" style={{ fontWeight: 600 }}>Amount</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {[1, 2, 3, 4, 5, 6].map((i) => (
                        <tr key={i} className="hover:bg-gray-50/50 transition-colors">
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-lg border border-gray-100 bg-gray-50 flex items-center justify-center shrink-0 overflow-hidden">
                                <ImageWithFallback src={`https://images.unsplash.com/photo-${1581000000000 + i * 5000}?auto=format&fit=crop&w=100&q=80`} alt="I" className="w-full h-full object-cover opacity-80" />
                              </div>
                              <div className="min-w-0">
                                <p className="text-[12px] text-gray-800 leading-none" style={{ fontWeight: 600 }}>Precision Component H{i}-XPR</p>
                                <div className="flex items-center gap-1.5 mt-1.5">
                                  <span className="text-[9px] text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded font-mono" style={{ fontWeight: 500 }}>SKU-902{i}</span>
                                  <span className="text-[9px] text-gray-400">PO-2024-001</span>
                                </div>
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <span className="text-[11px] font-mono text-gray-600 bg-gray-50 px-2 py-0.5 rounded border border-gray-100" style={{ fontWeight: 500 }}>1200-ASSETS</span>
                          </td>
                          <td className="px-4 py-3 text-center">
                            <p className="text-[12px] text-gray-800" style={{ fontWeight: 600 }}>{10 * i} EA</p>
                            <Badge className="mt-1 h-[16px] px-1.5 text-[8px] bg-emerald-50 text-emerald-600 border-0" style={{ fontWeight: 600 }}>Matched</Badge>
                          </td>
                          <td className="px-4 py-3 text-right">
                            <p className="text-[12px] text-gray-800" style={{ fontWeight: 600 }}><VIMoneyCell value={120} invoice={invoice} /></p>
                          </td>
                          <td className="px-4 py-3 text-right">
                            <p className="text-[13px] text-blue-600" style={{ fontWeight: 700 }}><VIMoneyCell value={120 * 10 * i} invoice={invoice} /></p>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="bg-gray-50 px-4 py-4 border-t border-gray-200 flex justify-end">
                  <div className="w-56 space-y-2">
                    <div className="flex justify-between items-center text-[11px]">
                      <span className="text-gray-400" style={{ fontWeight: 500 }}>Subtotal</span>
                      <span className="text-gray-700" style={{ fontWeight: 600 }}><VIMoneyCell value={subtotal} invoice={invoice} /></span>
                    </div>
                    <div className="flex justify-between items-center text-[11px]">
                      <span className="text-gray-400" style={{ fontWeight: 500 }}>Variance</span>
                      <span className="text-emerald-600" style={{ fontWeight: 600 }}>-<VIMoneyCell value={40} invoice={invoice} /></span>
                    </div>
                    <Separator className="bg-gray-200" />
                    <div className="flex justify-between items-center pt-1">
                      <span className="text-[12px] text-gray-700" style={{ fontWeight: 600 }}>Net Total</span>
                      <span className="text-[16px] text-gray-900" style={{ fontWeight: 700 }}><VIMoneyCell value={subtotal - 40} invoice={invoice} /></span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ═══ GL IMPACT TAB ═══ */}
            {activeTab === 'gl' && (
              <div className="max-w-3xl mx-auto space-y-5 pt-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <BookOpen className="w-4 h-4 text-blue-600" />
                    <h3 className="text-[13px] text-gray-800" style={{ fontWeight: 600 }}>Sub-Ledger Entries</h3>
                  </div>
                  <Badge className="bg-emerald-50 text-emerald-700 h-6 px-3 text-[10px] border-0 flex items-center gap-1.5 rounded-full" style={{ fontWeight: 600 }}>
                    <CheckCircle2 className="w-3.5 h-3.5" /> Balanced
                  </Badge>
                </div>
                
                <div className="space-y-3">
                  <LedgerCard title="Debit (DR)" account="1200 - Inventory Asset Material" amount={invoice.amount} invoice={invoice} color="emerald" />
                  <LedgerCard title="Credit (CR)" account="2100 - Accounts Payable (Trade)" amount={invoice.amount} invoice={invoice} color="blue" />
                  
                  <div className="bg-white border border-gray-200 border-dashed rounded-xl p-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-gray-50 flex items-center justify-center border border-gray-100">
                        <ShieldCheck className="w-4 h-4 text-emerald-500" />
                      </div>
                      <div>
                        <p className="text-[12px] text-gray-800" style={{ fontWeight: 600 }}>Journal Batch: JB-2026-X902</p>
                        <p className="text-[10px] text-gray-400 mt-0.5">Validated by Ahtisham Ahmad &bull; Feb 19, 10:30 AM</p>
                      </div>
                    </div>
                    <Button className="h-8 px-4 bg-gray-900 text-white text-[11px] rounded-lg hover:bg-black" style={{ fontWeight: 600 }}>Manual Re-balance</Button>
                  </div>
                </div>
              </div>
            )}

            {/* ═══ ATTACHMENTS TAB ═══ */}
            {activeTab === 'docs' && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {[
                  { name: 'VENDOR_INVOICE_92.pdf', type: 'Invoice', size: '2.4 MB', color: 'text-red-500' },
                  { name: 'RECEIVING_SUPPORT.pdf', type: 'GRN Ref', size: '1.1 MB', color: 'text-blue-500' },
                  { name: 'PACKING_SLIP_LOGS.pdf', type: 'Logistics', size: '890 KB', color: 'text-emerald-500' }
                ].map((doc, idx) => (
                  <div key={idx} className="bg-white border border-gray-200 rounded-xl p-4 flex flex-col group hover:border-blue-300 transition-all">
                    <div className="flex items-center justify-between mb-4">
                      <div className="w-10 h-10 rounded-lg bg-gray-50 flex items-center justify-center border border-gray-100 group-hover:bg-blue-50 transition-colors">
                        <FileText className={`w-5 h-5 ${doc.color}`} />
                      </div>
                      <Badge className="bg-gray-50 text-gray-400 border-0 h-[18px] px-1.5 text-[9px]" style={{ fontWeight: 500 }}>{doc.type}</Badge>
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-[12px] text-gray-800 truncate" style={{ fontWeight: 600 }}>{doc.name}</p>
                      <p className="text-[10px] text-gray-400 mt-1">{doc.size} &bull; Verified</p>
                    </div>
                    <div className="mt-4 flex gap-2">
                      <Button variant="outline" className="flex-1 h-8 text-[10px] border-gray-200 rounded-lg hover:bg-gray-50" style={{ fontWeight: 500 }}>
                        <Eye className="w-3 h-3 mr-1" /> View
                      </Button>
                      <Button variant="outline" size="icon" className="h-8 w-8 border-gray-200 text-gray-400 hover:text-blue-600 rounded-lg">
                        <Download className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>
                ))}
                <button className="h-full min-h-[160px] border border-dashed border-gray-200 bg-white text-gray-400 text-[11px] flex flex-col items-center justify-center gap-3 hover:bg-gray-50 hover:text-gray-600 transition-all rounded-xl cursor-pointer" style={{ fontWeight: 500 }}>
                  <div className="w-10 h-10 rounded-full bg-gray-50 border border-gray-100 flex items-center justify-center">
                    <Plus className="w-5 h-5" />
                  </div>
                  Attach Document
                </button>
              </div>
            )}

            {/* ═══ ACTIVITY TAB ═══ */}
            {activeTab === 'activity' && (
              <div className="max-w-2xl mx-auto py-4 space-y-0">
                <div className="relative pl-8 border-l-2 border-gray-100 space-y-8">
                  <TimelineEvent 
                    title="Document Created" 
                    user="Ahtisham Ahmad" 
                    time="Today, 10:30 AM" 
                    description="Vendor invoice committed to registry. 3-way match validation successful against PO-2024-001 and GRN-2024-001."
                    status="success"
                  />
                  <TimelineEvent 
                    title="Automated Split Triggered" 
                    user="SYSTEM" 
                    time="Today, 10:29 AM" 
                    description="System detected quantity mismatch on STEEL-001. Created Parent Pre-Invoice and Child Standard Invoice records."
                    status="alert"
                  />
                  <TimelineEvent 
                    title="Reference Locked" 
                    user="Ahtisham Ahmad" 
                    time="Jan 11, 04:15 PM" 
                    description="Vendor reference ID validated. Document state transitioned from Draft to Submitted."
                    status="default"
                  />
                </div>
              </div>
            )}

          </div>
        </div>

        {/* ━━━ FOOTER BAR ━━━ */}
        <div className="bg-white border-t border-gray-200 px-6 py-3 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-4">
            <button onClick={onClose} className="text-[11px] text-gray-400 hover:text-gray-700 transition-colors flex items-center gap-1.5 cursor-pointer" style={{ fontWeight: 500 }}>
              <ArrowLeft className="w-3.5 h-3.5" /> Back to Invoices
            </button>
            <div className="h-4 w-px bg-gray-200" />
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1.5 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-100">
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                <span className="text-[10px] text-emerald-700" style={{ fontWeight: 600 }}>Match Verified</span>
              </div>
              <div className="flex items-center gap-1.5 bg-blue-50 px-2.5 py-1 rounded-full border border-blue-100">
                <div className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                <span className="text-[10px] text-blue-700" style={{ fontWeight: 600 }}>Period: FEB-2026</span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" className="h-9 px-5 border-gray-200 text-gray-600 text-[11px] gap-1.5 bg-white hover:bg-gray-50 rounded-lg" style={{ fontWeight: 600 }}>
              <Flag className="w-3.5 h-3.5 text-red-400" /> Raise Exception
            </Button>
            <Button className="h-9 px-6 bg-gray-900 hover:bg-black text-white text-[11px] gap-1.5 shadow-sm rounded-lg" style={{ fontWeight: 600 }}>
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" /> Post to GL
            </Button>
          </div>
        </div>

      </div>
    </div>
    <VICurrencyConfigModal
      open={currencyConfigOpen}
      onOpenChange={setCurrencyConfigOpen}
      invoice={invoice}
    />
    </InvoiceViewModeProvider>
  );
}

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   HELPER COMPONENTS
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

function KpiMetric({ icon, iconColor, label, value, sub, subColor }: {
  icon: React.ReactNode; iconColor: string; label: string; value: React.ReactNode; sub?: string; subColor?: string
}) {
  return (
    <div className="flex items-center gap-3 flex-1 px-5 first:pl-0 last:pr-0">
      <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${iconColor}`}>
        {icon}
      </div>
      <div className="min-w-0">
        <p className="text-[10px] text-gray-400 leading-none mb-1" style={{ fontWeight: 500 }}>{label}</p>
        <p className="text-[15px] text-gray-900 leading-none tracking-tight" style={{ fontWeight: 700 }}>{value}</p>
        {sub && <p className={`text-[9px] mt-0.5 leading-none ${subColor || 'text-gray-400'}`}>{sub}</p>}
      </div>
    </div>
  );
}

function OverviewKpiCard({ label, value, status, statusColor, sub, change }: {
  label: string; value: string; status: string; statusColor: string; sub: React.ReactNode; change?: React.ReactNode;
}) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4">
      <p className="text-[11px] text-gray-500 mb-2" style={{ fontWeight: 500 }}>{label}</p>
      <div className="flex items-end justify-between">
        <div>
          <p className="text-[22px] text-gray-900 leading-none tracking-tight" style={{ fontWeight: 700 }}>{value}</p>
          <p className="text-[10px] text-gray-400 mt-1.5">{sub}</p>
        </div>
        <div className="flex items-center gap-1">
          {change}
          <span className={`text-[11px] ${statusColor}`} style={{ fontWeight: 600 }}>{status}</span>
        </div>
      </div>
    </div>
  );
}

function InfoField({ label, value, highlight }: { label: string; value: React.ReactNode; highlight?: boolean }) {
  return (
    <div>
      <p className="text-[10px] text-gray-400 mb-1" style={{ fontWeight: 500 }}>{label}</p>
      <p className={`text-[12px] ${highlight ? 'text-blue-600 font-mono bg-blue-50 px-1.5 py-0.5 rounded border border-blue-100 inline-block' : 'text-gray-800'}`} style={{ fontWeight: highlight ? 600 : 500 }}>
        {value}
      </p>
    </div>
  );
}

function FinancialRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex justify-between items-center">
      <span className="text-[11px] text-gray-400" style={{ fontWeight: 500 }}>{label}</span>
      <span className="text-[12px] text-gray-700" style={{ fontWeight: 600 }}>{value}</span>
    </div>
  );
}

function LinkedRecord({ label, type, muted }: { label: string; type: string; muted?: boolean }) {
  return (
    <div className={`flex items-center justify-between p-2.5 rounded-lg border transition-colors cursor-pointer ${
      muted ? 'bg-gray-50 border-gray-100 opacity-50' : 'bg-gray-50 border-gray-100 hover:bg-white hover:border-blue-200'
    }`}>
      <div className="flex items-center gap-2.5">
        <div className="w-6 h-6 rounded bg-white border border-gray-200 flex items-center justify-center">
          <Link className="w-3 h-3 text-blue-500" />
        </div>
        <div>
          <p className="text-[11px] text-gray-800 leading-none" style={{ fontWeight: 600 }}>{label}</p>
          <p className="text-[9px] text-gray-400 mt-0.5">{type}</p>
        </div>
      </div>
      {!muted && <ChevronRight className="w-3 h-3 text-gray-300" />}
    </div>
  );
}

function LedgerCard({ title, account, amount, invoice, color }: { title: string; account: string; amount: number; invoice: Invoice; color: 'emerald' | 'blue' }) {
  const colors = {
    emerald: { header: 'bg-emerald-50 border-emerald-100 text-emerald-700', dot: 'bg-emerald-500' },
    blue: { header: 'bg-blue-50 border-blue-100 text-blue-700', dot: 'bg-blue-500' }
  };
  const c = colors[color];

  return (
    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
      <div className={`${c.header} px-4 py-2 border-b flex items-center gap-2`}>
        <div className={`w-2 h-2 rounded-full ${c.dot}`} />
        <span className="text-[11px]" style={{ fontWeight: 600 }}>{title}</span>
      </div>
      <div className="px-4 py-3.5 flex justify-between items-center">
        <span className="text-[12px] font-mono text-gray-600" style={{ fontWeight: 500 }}>{account}</span>
        <span className="text-[14px] font-mono text-gray-900" style={{ fontWeight: 700 }}><VIMoneyCell value={amount} invoice={invoice} /></span>
      </div>
    </div>
  );
}

function TimelineEvent({ title, user, time, description, status }: { 
  title: string; user: string; time: string; description: string; status: 'success' | 'alert' | 'default' 
}) {
  const dotColor = status === 'success' ? 'bg-blue-500' : status === 'alert' ? 'bg-amber-500' : 'bg-gray-300';
  
  return (
    <div className="relative">
      <div className={`absolute -left-[37px] top-1 w-2.5 h-2.5 rounded-full border-2 border-white z-10 ${dotColor}`} />
      <div className="flex justify-between items-start mb-1.5">
        <p className="text-[12px] text-gray-800" style={{ fontWeight: 600 }}>{title}</p>
        <span className="text-[10px] text-gray-400 shrink-0 ml-4" style={{ fontWeight: 500 }}>{time}</span>
      </div>
      <p className="text-[11px] text-gray-500 leading-relaxed">{description}</p>
      <div className="mt-2.5 flex items-center gap-2">
        <Badge className="bg-gray-50 text-gray-500 border-0 h-[18px] px-2 text-[9px] rounded-full" style={{ fontWeight: 500 }}>{user}</Badge>
        <Badge className="bg-gray-50 text-gray-500 border-0 h-[18px] px-2 text-[9px] flex items-center gap-1 rounded-full" style={{ fontWeight: 500 }}>
          <History className="w-2.5 h-2.5" /> Log
        </Badge>
      </div>
    </div>
  );
}