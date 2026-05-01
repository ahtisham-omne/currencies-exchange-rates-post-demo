import { useState } from 'react';
import { X, ArrowLeft, Maximize2, FileText, Upload, CheckCircle, AlertTriangle, Info, ClipboardList, Users, Package, Lock } from 'lucide-react';
import { Button } from '@/app/components/ui/button';
import { Input } from '@/app/components/ui/input';
import { Checkbox } from '@/app/components/ui/checkbox';
import { Textarea } from '@/app/components/ui/textarea';

interface InvoiceCreationFromReceivingDocProps {
  onClose: () => void;
}

interface ReceivingDocument {
  id: string;
  receivingDocNumber: string;
  poNumber: string;
  status: string;
  receivingDate: string;
}

interface LineItem {
  id: string;
  description: string;
  ordered: number;
  received: number;
  invoiceQty: number;
  price: number;
  amount: number;
  matchStatus: 'match' | 'tolerance' | 'exception';
  selected: boolean;
}

export function InvoiceCreationFromGRN({ onClose }: InvoiceCreationFromReceivingDocProps) {
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [paymentHold, setPaymentHold] = useState(false);
  const [exceptionFlag, setExceptionFlag] = useState(false);
  const [holdReason, setHoldReason] = useState('');
  const [exceptionType, setExceptionType] = useState('');
  const [exceptionDescription, setExceptionDescription] = useState('');
  const [notifyStakeholders, setNotifyStakeholders] = useState({
    financeManager: false,
    apSupervisor: false,
    cfo: false,
    controller: false,
  });
  
  // Multiple Receiving Documents (5)
  const [receivingDocuments] = useState<ReceivingDocument[]>([
    { id: '1', receivingDocNumber: 'RD-2024-001', poNumber: 'PO-2024-001', status: '3-way-matched', receivingDate: '2024-01-15' },
    { id: '2', receivingDocNumber: 'RD-2024-015', poNumber: 'PO-2024-001', status: '3-way-matched', receivingDate: '2024-01-16' },
    { id: '3', receivingDocNumber: 'RD-2024-023', poNumber: 'PO-2024-002', status: '3-way-matched', receivingDate: '2024-01-17' },
    { id: '4', receivingDocNumber: 'RD-2024-034', poNumber: 'PO-2024-003', status: 'pending', receivingDate: '2024-01-18' },
    { id: '5', receivingDocNumber: 'RD-2024-041', poNumber: 'PO-2024-004', status: '3-way-matched', receivingDate: '2024-01-19' },
  ]);

  // Multiple Line Items (20)
  const [lineItems, setLineItems] = useState<LineItem[]>([
    { id: '1', description: 'Industrial Steel Pipes - Grade A', ordered: 100, received: 50, invoiceQty: 50, price: 50.00, amount: 2500.00, matchStatus: 'match', selected: true },
    { id: '2', description: 'Copper Fittings - Premium Quality', ordered: 200, received: 100, invoiceQty: 100, price: 25.00, amount: 2500.00, matchStatus: 'match', selected: true },
    { id: '3', description: 'PVC Pipes - Industrial Grade', ordered: 150, received: 150, invoiceQty: 150, price: 15.00, amount: 2250.00, matchStatus: 'match', selected: true },
    { id: '4', description: 'Brass Valves - 2 inch', ordered: 75, received: 75, invoiceQty: 75, price: 45.00, amount: 3375.00, matchStatus: 'match', selected: true },
    { id: '5', description: 'Stainless Steel Fasteners Set', ordered: 500, received: 480, invoiceQty: 480, price: 2.50, amount: 1200.00, matchStatus: 'tolerance', selected: true },
    { id: '6', description: 'Rubber Gaskets - Assorted Sizes', ordered: 300, received: 300, invoiceQty: 300, price: 3.75, amount: 1125.00, matchStatus: 'match', selected: true },
    { id: '7', description: 'Galvanized Steel Sheets', ordered: 50, received: 50, invoiceQty: 50, price: 120.00, amount: 6000.00, matchStatus: 'match', selected: true },
    { id: '8', description: 'Welding Electrodes - E7018', ordered: 200, received: 200, invoiceQty: 200, price: 8.50, amount: 1700.00, matchStatus: 'match', selected: true },
    { id: '9', description: 'Safety Gloves - Industrial', ordered: 100, received: 95, invoiceQty: 95, price: 12.00, amount: 1140.00, matchStatus: 'tolerance', selected: true },
    { id: '10', description: 'Hydraulic Hoses - 1/2 inch', ordered: 80, received: 80, invoiceQty: 80, price: 35.00, amount: 2800.00, matchStatus: 'match', selected: true },
    { id: '11', description: 'Aluminum Sheets - 4x8 ft', ordered: 40, received: 40, invoiceQty: 40, price: 95.00, amount: 3800.00, matchStatus: 'match', selected: true },
    { id: '12', description: 'Ball Bearings - Precision Grade', ordered: 250, received: 250, invoiceQty: 250, price: 18.00, amount: 4500.00, matchStatus: 'match', selected: true },
    { id: '13', description: 'Thread Sealant Tape - PTFE', ordered: 500, received: 500, invoiceQty: 500, price: 1.25, amount: 625.00, matchStatus: 'match', selected: true },
    { id: '14', description: 'Industrial Lubricant - 5L', ordered: 60, received: 60, invoiceQty: 60, price: 42.00, amount: 2520.00, matchStatus: 'match', selected: true },
    { id: '15', description: 'Carbon Steel Bolts M12', ordered: 1000, received: 1000, invoiceQty: 1000, price: 0.85, amount: 850.00, matchStatus: 'match', selected: true },
    { id: '16', description: 'Wire Rope - 6mm Diameter', ordered: 100, received: 100, invoiceQty: 100, price: 22.00, amount: 2200.00, matchStatus: 'match', selected: true },
    { id: '17', description: 'Pneumatic Cylinders - 63mm', ordered: 25, received: 25, invoiceQty: 25, price: 185.00, amount: 4625.00, matchStatus: 'match', selected: true },
    { id: '18', description: 'Electric Motors - 3HP', ordered: 15, received: 14, invoiceQty: 14, price: 425.00, amount: 5950.00, matchStatus: 'tolerance', selected: true },
    { id: '19', description: 'Control Panels - Custom', ordered: 10, received: 10, invoiceQty: 10, price: 850.00, amount: 8500.00, matchStatus: 'match', selected: true },
    { id: '20', description: 'Pressure Gauges - Digital', ordered: 30, received: 30, invoiceQty: 30, price: 95.00, amount: 2850.00, matchStatus: 'match', selected: true },
  ]);

  const [formData, setFormData] = useState({
    vendorInvoiceNumber: 'INV-XXXX',
    vendorInvoiceDate: '2026-01-26',
    postingDate: '2024-01-18',
    dueDate: '2026-02-25',
    paymentTerms: 'Net 30',
    currency: 'USD',
    exchangeRate: '1.00',
  });

  const toggleFullScreen = () => {
    setIsFullScreen(!isFullScreen);
  };

  const handleToggleLineItem = (id: string) => {
    setLineItems(lineItems.map(item => 
      item.id === id ? { ...item, selected: !item.selected } : item
    ));
  };

  const handleSelectAll = () => {
    const allSelected = lineItems.every(item => item.selected);
    setLineItems(lineItems.map(item => ({ ...item, selected: !allSelected })));
  };

  const handleQuantityChange = (id: string, newQty: number) => {
    setLineItems(lineItems.map(item => 
      item.id === id ? { 
        ...item, 
        invoiceQty: newQty,
        amount: newQty * item.price 
      } : item
    ));
  };

  const handleSubmit = () => {
    console.log('Submitting invoice for reconciliation');
    console.log('Form Data:', formData);
    console.log('Selected Line Items:', lineItems.filter(item => item.selected));
    console.log('Payment Hold:', paymentHold, holdReason);
    console.log('Exception Flag:', exceptionFlag, exceptionType, exceptionDescription);
    console.log('Notify Stakeholders:', notifyStakeholders);
  };

  const handleSaveDraft = () => {
    console.log('Saving invoice as draft');
  };

  const handleUploadPDF = () => {
    console.log('Uploading vendor invoice PDF');
  };

  const handleAttachDocument = (type: 'hold' | 'exception') => {
    console.log(`Attaching supporting document for ${type}`);
  };

  // Calculate totals
  const selectedItems = lineItems.filter(item => item.selected);
  const subtotal = selectedItems.reduce((sum, item) => sum + item.amount, 0);
  const taxRate = 0.08;
  const tax = subtotal * taxRate;
  const total = subtotal + tax;

  // Calculate match statistics
  const matchCount = selectedItems.filter(item => item.matchStatus === 'match').length;
  const toleranceCount = selectedItems.filter(item => item.matchStatus === 'tolerance').length;
  const exceptionCount = selectedItems.filter(item => item.matchStatus === 'exception').length;

  // Count unique POs and GRNs
  const uniquePOs = new Set(receivingDocuments.map(doc => doc.poNumber)).size;
  const uniqueGRNs = receivingDocuments.length;

  // Compute posting date from latest receiving date across all selected receiving documents
  const latestReceivingDate = receivingDocuments
    .map(doc => doc.receivingDate)
    .sort((a, b) => new Date(b).getTime() - new Date(a).getTime())[0] || '';

  // Format the posting date for display (DD/MM/YYYY)
  const formatDateForDisplay = (dateStr: string) => {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    const dd = String(d.getDate()).padStart(2, '0');
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const yyyy = d.getFullYear();
    return `${dd}/${mm}/${yyyy}`;
  };

  // Find which receiving doc has the latest date (for helper text)
  const latestReceivingDoc = receivingDocuments
    .sort((a, b) => new Date(b.receivingDate).getTime() - new Date(a.receivingDate).getTime())[0];

  return (
    <div className={`fixed inset-0 z-50 flex items-center justify-center ${isFullScreen ? '' : 'bg-black/40 backdrop-blur-sm p-4'}`}>
      <div className={`bg-white flex flex-col transition-all duration-300 ${
        isFullScreen 
          ? 'w-full h-full' 
          : 'rounded-xl shadow-2xl w-full max-w-7xl h-[95vh]'
      }`}>
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 bg-white">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="sm" onClick={onClose} className="h-9 w-9 p-0 hover:bg-gray-100">
              <ArrowLeft className="w-4 h-4" />
            </Button>
            <div className="h-8 w-px bg-gray-300"></div>
            <div>
              <h1 className="text-xl font-bold text-gray-900">Create Vendor Invoice from Receiving Documents</h1>
              <p className="text-xs text-gray-500 mt-0.5">Step 3: Review 3-way matching & submit</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={toggleFullScreen} className="h-9 px-3 text-sm hover:bg-gray-100">
              <Maximize2 className="w-4 h-4 mr-1.5" />
              {isFullScreen ? 'Exit' : 'Full View'}
            </Button>
            <Button variant="ghost" size="sm" onClick={onClose} className="h-9 w-9 p-0 hover:bg-red-50 hover:text-red-600">
              <X className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Content - Vertical Layout */}
        <div className="flex-1 overflow-y-auto bg-gray-50">
          <div className="max-w-7xl mx-auto p-6 space-y-5">
            {/* Header Summary Section */}
            <div className="grid grid-cols-2 gap-4">
              {/* Left - Receiving Documents */}
              <div className="space-y-3">
                {receivingDocuments.slice(0, 3).map((doc) => (
                  <div key={doc.id} className={`rounded-lg p-3 border-2 ${
                    doc.status === '3-way-matched' 
                      ? 'bg-blue-50 border-blue-200' 
                      : 'bg-gray-50 border-gray-200'
                  }`}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 bg-blue-100 rounded-lg flex items-center justify-center">
                          <ClipboardList className="w-4 h-4 text-blue-600" />
                        </div>
                        <div>
                          <div className="text-sm font-bold text-gray-900">Receiving Document</div>
                          <div className="text-xs text-gray-500">{doc.receivingDocNumber} • PO: {doc.poNumber}</div>
                        </div>
                      </div>
                      {doc.status === '3-way-matched' && (
                        <div className="flex items-center gap-1.5 px-2.5 py-1 bg-green-100 text-green-700 rounded-lg">
                          <CheckCircle className="w-3.5 h-3.5" />
                          <span className="text-xs font-semibold">3-Way Matched</span>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
                
                {receivingDocuments.length > 3 && (
                  <div className="text-center py-2 bg-gray-100 rounded-lg border border-gray-200">
                    <span className="text-xs text-gray-600 font-semibold">+ {receivingDocuments.length - 3} more documents</span>
                  </div>
                )}
              </div>

              {/* Right - Final Invoice Summary */}
              <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
                <div className="flex items-center gap-2 mb-3">
                  <FileText className="w-5 h-5 text-green-700" />
                  <span className="text-base font-bold text-green-900">Final Vendor Invoice</span>
                </div>
                <div className="text-xs text-gray-600 mb-3">Linked to {uniqueGRNs} Receiving Document{uniqueGRNs > 1 ? 's' : ''}</div>
                
                {/* Match Status Badges */}
                <div className="flex items-center gap-2 flex-wrap">
                  <div className="flex items-center gap-1.5 px-3 py-1.5 bg-green-100 text-green-700 rounded-md">
                    <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                    <span className="text-xs font-bold">{matchCount} Match</span>
                  </div>
                  <div className="flex items-center gap-1.5 px-3 py-1.5 bg-yellow-100 text-yellow-700 rounded-md">
                    <div className="w-2 h-2 bg-yellow-500 rounded-full"></div>
                    <span className="text-xs font-bold">{toleranceCount} Tolerance</span>
                  </div>
                  <div className="flex items-center gap-1.5 px-3 py-1.5 bg-red-100 text-red-700 rounded-md">
                    <div className="w-2 h-2 bg-red-500 rounded-full"></div>
                    <span className="text-xs font-bold">{exceptionCount} Exception</span>
                  </div>
                </div>

                {/* Document Stats */}
                <div className="mt-3 pt-3 border-t border-gray-200">
                  <div className="flex items-center gap-4 text-xs text-gray-500">
                    <div className="flex items-center gap-1">
                      <span className="font-semibold">PO:</span>
                      <span className="font-bold text-gray-900">{uniquePOs}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <span className="font-semibold">Documents:</span>
                      <span className="font-bold text-gray-900">{uniqueGRNs}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <span className="font-semibold">Lines:</span>
                      <span className="font-bold text-gray-900">{selectedItems.length}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Line Items Table - Scrollable */}
            <div className="bg-white border border-gray-200 rounded-lg shadow-sm">
              <div className="border-b border-gray-200 bg-gray-50 px-5 py-3">
                <h3 className="text-base font-bold text-gray-900">Invoice Line Items</h3>
              </div>
              
              <div className="overflow-x-auto" style={{ maxHeight: '400px', overflowY: 'auto' }}>
                <table className="w-full">
                  <thead className="bg-gray-50 border-b border-gray-200 sticky top-0">
                    <tr>
                      <th className="px-4 py-3 text-left">
                        <Checkbox checked={lineItems.every(item => item.selected)} onCheckedChange={handleSelectAll} />
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase">Item</th>
                      <th className="px-4 py-3 text-center text-xs font-bold text-gray-700 uppercase">ORD</th>
                      <th className="px-4 py-3 text-center text-xs font-bold text-gray-700 uppercase">RCVD</th>
                      <th className="px-4 py-3 text-center text-xs font-bold text-gray-700 uppercase">INV QTY</th>
                      <th className="px-4 py-3 text-right text-xs font-bold text-gray-700 uppercase">Price</th>
                      <th className="px-4 py-3 text-right text-xs font-bold text-gray-700 uppercase">AP AMT</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {lineItems.map((item) => (
                      <tr key={item.id} className={`hover:bg-gray-50 transition-colors cursor-pointer ${item.selected ? 'bg-white' : 'bg-gray-50 opacity-60'}`}>
                        <td className="px-4 py-3">
                          <Checkbox 
                            checked={item.selected}
                            onCheckedChange={() => handleToggleLineItem(item.id)}
                          />
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-900 font-medium">{item.description}</td>
                        <td className="px-4 py-3 text-center text-sm text-gray-700">{item.ordered}</td>
                        <td className="px-4 py-3 text-center">
                          <span className={`inline-flex items-center justify-center px-3 py-1 rounded-md text-sm font-bold ${
                            item.matchStatus === 'match' 
                              ? 'bg-green-100 text-green-700' 
                              : item.matchStatus === 'tolerance'
                              ? 'bg-yellow-100 text-yellow-700'
                              : 'bg-red-100 text-red-700'
                          }`}>
                            {item.received}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <input
                            type="number"
                            value={item.invoiceQty}
                            onChange={(e) => handleQuantityChange(item.id, parseInt(e.target.value) || 0)}
                            className="w-20 px-2 py-1.5 text-sm text-center font-semibold border-2 border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                            disabled={!item.selected}
                          />
                        </td>
                        <td className="px-4 py-3 text-right text-sm text-gray-700">$ {item.price.toFixed(2)}</td>
                        <td className="px-4 py-3 text-right text-base font-bold text-blue-600">${item.amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Table Footer with Totals */}
              <div className="border-t border-gray-200 bg-gray-50 px-5 py-3">
                <div className="flex items-center justify-between">
                  <div className="text-sm text-gray-600">
                    <span className="font-semibold">{selectedItems.length}</span> of {lineItems.length} items selected
                  </div>
                  <div className="flex items-center gap-6">
                    <div className="text-sm">
                      <span className="text-gray-600">Subtotal: </span>
                      <span className="font-bold text-gray-900">${subtotal.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
                    </div>
                    <div className="text-sm">
                      <span className="text-gray-600">Tax: </span>
                      <span className="font-bold text-gray-900">${tax.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
                    </div>
                    <div className="text-lg">
                      <span className="text-gray-900 font-bold">Total: </span>
                      <span className="font-bold text-blue-600">${total.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Form Fields Section */}
            <div className="grid grid-cols-3 gap-4">
              {/* Invoice Details */}
              <div className="bg-white border border-gray-200 rounded-lg shadow-sm p-5">
                <h3 className="text-sm font-bold text-gray-900 mb-4">Invoice Details</h3>
                <div className="space-y-3">
                  <div>
                    <label className="text-xs font-semibold text-gray-700 uppercase mb-1.5 block">Vendor Invoice #</label>
                    <Input
                      value={formData.vendorInvoiceNumber}
                      onChange={(e) => setFormData({ ...formData, vendorInvoiceNumber: e.target.value })}
                      className="text-sm"
                      placeholder="INV-XXXX"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-gray-700 uppercase mb-1.5 block">Vendor Inv. Date</label>
                    <Input
                      type="date"
                      value={formData.vendorInvoiceDate}
                      onChange={(e) => setFormData({ ...formData, vendorInvoiceDate: e.target.value })}
                      className="text-sm"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-gray-700 uppercase mb-1.5 flex items-center gap-1.5">
                      Posting date
                      <Lock className="w-3 h-3 text-gray-400" />
                    </label>
                    <Input
                      type="text"
                      value={formatDateForDisplay(latestReceivingDate)}
                      readOnly
                      disabled
                      className="text-sm bg-gray-50 border-gray-200 text-gray-700 cursor-not-allowed"
                    />
                    <p className="text-[10px] text-gray-400 mt-1 font-medium">
                      Auto-filled from receiving document{receivingDocuments.length > 1 ? ` (latest: ${latestReceivingDoc?.receivingDocNumber})` : ''} (per company settings).
                    </p>
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-gray-700 uppercase mb-1.5 block">Due Date</label>
                    <Input
                      type="date"
                      value={formData.dueDate}
                      onChange={(e) => setFormData({ ...formData, dueDate: e.target.value })}
                      className="text-sm"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-gray-700 uppercase mb-1.5 block">Payment Terms</label>
                    <Input
                      value={formData.paymentTerms}
                      onChange={(e) => setFormData({ ...formData, paymentTerms: e.target.value })}
                      className="text-sm"
                      placeholder="e.g., Net 30"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-xs font-semibold text-gray-700 uppercase mb-1.5 block">Currency</label>
                      <Input
                        value={formData.currency}
                        onChange={(e) => setFormData({ ...formData, currency: e.target.value })}
                        className="text-sm"
                        placeholder="USD"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-gray-700 uppercase mb-1.5 block">Exchange Rate</label>
                      <Input
                        value={formData.exchangeRate}
                        onChange={(e) => setFormData({ ...formData, exchangeRate: e.target.value })}
                        className="text-sm"
                        placeholder="1.00"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Payment Hold */}
              <div className={`bg-white border-2 rounded-lg shadow-sm overflow-hidden transition-all ${paymentHold ? 'border-orange-300' : 'border-gray-200'}`}>
                <div className="p-5">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <AlertTriangle className={`w-5 h-5 ${paymentHold ? 'text-orange-600' : 'text-gray-600'}`} />
                      <span className="text-sm font-bold text-gray-900">Payment Hold</span>
                    </div>
                    <button
                      onClick={() => setPaymentHold(!paymentHold)}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${paymentHold ? 'bg-orange-600' : 'bg-gray-200'}`}
                    >
                      <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${paymentHold ? 'translate-x-6' : 'translate-x-1'}`} />
                    </button>
                  </div>
                  <p className="text-xs text-gray-500 mb-3">Block payment while allowing approval & posting</p>
                  
                  {paymentHold && (
                    <div className="space-y-3 pt-3 border-t border-orange-200">
                      <div>
                        <label className="text-xs font-semibold text-gray-700 uppercase mb-1.5 block">Hold Reason *</label>
                        <Textarea
                          value={holdReason}
                          onChange={(e) => setHoldReason(e.target.value)}
                          className="text-sm min-h-[60px] resize-none"
                          placeholder="Enter reason for hold"
                        />
                      </div>
                      <div>
                        <label className="text-xs font-semibold text-gray-700 uppercase mb-1.5 flex items-center gap-1.5">
                          <FileText className="w-3 h-3" />
                          Supporting Documents
                        </label>
                        <Button 
                          variant="outline" 
                          size="sm" 
                          className="w-full h-9 text-xs"
                          onClick={() => handleAttachDocument('hold')}
                        >
                          <Upload className="w-3 h-3 mr-1.5" />
                          Attach Document
                        </Button>
                      </div>
                      <div>
                        <label className="text-xs font-semibold text-gray-700 uppercase mb-1.5 flex items-center gap-1.5">
                          <Users className="w-3 h-3" />
                          Notify Stakeholders
                        </label>
                        <div className="space-y-1.5">
                          <label className="flex items-center gap-2 cursor-pointer">
                            <Checkbox
                              checked={notifyStakeholders.financeManager}
                              onCheckedChange={(checked) => setNotifyStakeholders({ ...notifyStakeholders, financeManager: checked as boolean })}
                            />
                            <span className="text-xs text-gray-700">Finance Manager</span>
                          </label>
                          <label className="flex items-center gap-2 cursor-pointer">
                            <Checkbox
                              checked={notifyStakeholders.apSupervisor}
                              onCheckedChange={(checked) => setNotifyStakeholders({ ...notifyStakeholders, apSupervisor: checked as boolean })}
                            />
                            <span className="text-xs text-gray-700">AP Supervisor</span>
                          </label>
                          <label className="flex items-center gap-2 cursor-pointer">
                            <Checkbox
                              checked={notifyStakeholders.cfo}
                              onCheckedChange={(checked) => setNotifyStakeholders({ ...notifyStakeholders, cfo: checked as boolean })}
                            />
                            <span className="text-xs text-gray-700">CFO</span>
                          </label>
                          <label className="flex items-center gap-2 cursor-pointer">
                            <Checkbox
                              checked={notifyStakeholders.controller}
                              onCheckedChange={(checked) => setNotifyStakeholders({ ...notifyStakeholders, controller: checked as boolean })}
                            />
                            <span className="text-xs text-gray-700">Controller</span>
                          </label>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Exception Flag */}
              <div className={`bg-white border-2 rounded-lg shadow-sm overflow-hidden transition-all ${exceptionFlag ? 'border-red-300' : 'border-gray-200'}`}>
                <div className="p-5">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <AlertTriangle className={`w-5 h-5 ${exceptionFlag ? 'text-red-600' : 'text-gray-600'}`} />
                      <span className="text-sm font-bold text-gray-900">Exception Flag</span>
                    </div>
                    <button
                      onClick={() => setExceptionFlag(!exceptionFlag)}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${exceptionFlag ? 'bg-red-600' : 'bg-gray-200'}`}
                    >
                      <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${exceptionFlag ? 'translate-x-6' : 'translate-x-1'}`} />
                    </button>
                  </div>
                  <p className="text-xs text-gray-500 mb-3">Route to Exception Queue for review</p>
                  
                  {exceptionFlag && (
                    <div className="space-y-3 pt-3 border-t border-red-200">
                      <div>
                        <label className="text-xs font-semibold text-gray-700 uppercase mb-1.5 block">Exception Type *</label>
                        <select 
                          value={exceptionType}
                          onChange={(e) => setExceptionType(e.target.value)}
                          className="w-full h-9 px-3 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500"
                        >
                          <option value="">Select type...</option>
                          <option value="quantity-mismatch">Quantity Mismatch</option>
                          <option value="price-variance">Price Variance</option>
                          <option value="duplicate-invoice">Duplicate Invoice</option>
                          <option value="missing-po">Missing PO</option>
                          <option value="other">Other</option>
                        </select>
                      </div>
                      <div>
                        <label className="text-xs font-semibold text-gray-700 uppercase mb-1.5 block">Description *</label>
                        <Textarea
                          value={exceptionDescription}
                          onChange={(e) => setExceptionDescription(e.target.value)}
                          className="text-sm min-h-[60px] resize-none"
                          placeholder="Describe exception..."
                        />
                      </div>
                      <div>
                        <label className="text-xs font-semibold text-gray-700 uppercase mb-1.5 flex items-center gap-1.5">
                          <FileText className="w-3 h-3" />
                          Supporting Documents
                        </label>
                        <Button 
                          variant="outline" 
                          size="sm" 
                          className="w-full h-9 text-xs"
                          onClick={() => handleAttachDocument('exception')}
                        >
                          <Upload className="w-3 h-3 mr-1.5" />
                          Attach Document
                        </Button>
                      </div>
                      <div>
                        <label className="text-xs font-semibold text-gray-700 uppercase mb-1.5 flex items-center gap-1.5">
                          <Users className="w-3 h-3" />
                          Notify Stakeholders
                        </label>
                        <div className="space-y-1.5">
                          <label className="flex items-center gap-2 cursor-pointer">
                            <Checkbox
                              checked={notifyStakeholders.financeManager}
                              onCheckedChange={(checked) => setNotifyStakeholders({ ...notifyStakeholders, financeManager: checked as boolean })}
                            />
                            <span className="text-xs text-gray-700">Finance Manager</span>
                          </label>
                          <label className="flex items-center gap-2 cursor-pointer">
                            <Checkbox
                              checked={notifyStakeholders.apSupervisor}
                              onCheckedChange={(checked) => setNotifyStakeholders({ ...notifyStakeholders, apSupervisor: checked as boolean })}
                            />
                            <span className="text-xs text-gray-700">AP Supervisor</span>
                          </label>
                          <label className="flex items-center gap-2 cursor-pointer">
                            <Checkbox
                              checked={notifyStakeholders.cfo}
                              onCheckedChange={(checked) => setNotifyStakeholders({ ...notifyStakeholders, cfo: checked as boolean })}
                            />
                            <span className="text-xs text-gray-700">CFO</span>
                          </label>
                          <label className="flex items-center gap-2 cursor-pointer">
                            <Checkbox
                              checked={notifyStakeholders.controller}
                              onCheckedChange={(checked) => setNotifyStakeholders({ ...notifyStakeholders, controller: checked as boolean })}
                            />
                            <span className="text-xs text-gray-700">Controller</span>
                          </label>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Attachment & Actions Row */}
            <div className="grid grid-cols-3 gap-4">
              {/* Vendor Invoice Attachment */}
              <div className="bg-white border border-gray-200 rounded-lg shadow-sm p-5">
                <label className="text-xs font-semibold text-gray-700 uppercase mb-3 block">Vendor Invoice Attachment *</label>
                <button 
                  onClick={handleUploadPDF}
                  className="w-full h-32 border-2 border-dashed border-gray-300 rounded-lg flex items-center justify-center bg-gray-50 hover:bg-gray-100 transition-colors cursor-pointer"
                >
                  <div className="text-center">
                    <Upload className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                    <p className="text-sm text-gray-500 font-medium">Drag & drop or click to upload</p>
                    <p className="text-xs text-gray-400 mt-1">PDF, JPG, PNG up to 10MB</p>
                  </div>
                </button>
              </div>

              {/* GL Impact */}
              <div className="bg-white border border-gray-200 rounded-lg shadow-sm p-5">
                <h3 className="text-xs font-semibold text-gray-700 uppercase mb-3">GL Impact</h3>
                <div className="space-y-2">
                  <div className="flex items-center gap-2 p-3 bg-green-50 border border-green-200 rounded-lg">
                    <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                    <span className="text-xs font-semibold text-green-700 flex-1">AP Liability</span>
                    <span className="px-2 py-0.5 bg-green-100 text-green-700 text-xs font-bold rounded">CR</span>
                    <span className="text-sm font-bold text-green-900">${total.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
                  </div>
                </div>
                
                {/* Info Message */}
                <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                  <div className="flex items-start gap-2">
                    <Info className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" />
                    <div className="text-xs text-blue-700">
                      <span className="font-semibold">Next:</span> Invoice will enter reconciliation queue for validation before posting to GL.
                    </div>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="bg-white border border-gray-200 rounded-lg shadow-sm p-5">
                <h3 className="text-xs font-semibold text-gray-700 uppercase mb-3">Actions</h3>
                <div className="space-y-3">
                  <Button 
                    onClick={handleSubmit}
                    className="w-full h-12 bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm"
                  >
                    Submit for Reconciliation
                  </Button>
                  <Button 
                    onClick={handleSaveDraft}
                    variant="outline"
                    className="w-full h-12 font-semibold text-sm"
                  >
                    Save as Draft
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}