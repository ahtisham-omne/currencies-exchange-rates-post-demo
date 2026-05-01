import { useState, useMemo, Fragment } from 'react';
import { Search, Filter, ChevronDown, Package, Truck, Calendar, Building2, Eye, MoreHorizontal, Download, FileText, ArrowUpDown } from 'lucide-react';
import { Button } from '@/app/components/ui/button';
import { Input } from '@/app/components/ui/input';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/app/components/ui/dropdown-menu';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/app/components/ui/table';
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/app/components/ui/hover-card";
import { mockVendors, VendorGRN } from '@/app/data/mockVendors';
import { toast } from 'sonner';
import { VIMoneyCell } from '@/app/components/currency/VIMoneyCell';

export function ReceivingDocumentsScreen() {
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedGrns, setExpandedGrns] = useState<Set<string>>(new Set());

  // Flatten all GRNs from all vendors
  const allGrns = useMemo(() => {
    return mockVendors.flatMap(vendor => vendor.receivingDocuments);
  }, []);

  const filteredGrns = allGrns.filter(grn => {
    const query = searchQuery.toLowerCase();
    return (
      grn.grnNumber.toLowerCase().includes(query) ||
      grn.poNumber.toLowerCase().includes(query) ||
      grn.vendorName?.toLowerCase().includes(query) ||
      grn.status.toLowerCase().includes(query)
    );
  });

  const toggleExpand = (grnNumber: string) => {
    const newExpanded = new Set(expandedGrns);
    if (newExpanded.has(grnNumber)) {
      newExpanded.delete(grnNumber);
    } else {
      newExpanded.add(grnNumber);
    }
    setExpandedGrns(newExpanded);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Received': return 'bg-blue-50 text-blue-700 border-blue-100';
      case 'Inspected': return 'bg-purple-50 text-purple-700 border-purple-100';
      case 'Accepted': return 'bg-green-50 text-green-700 border-green-100';
      case 'Partially Invoiced': return 'bg-orange-50 text-orange-700 border-orange-100';
      case 'Fully Invoiced': return 'bg-gray-50 text-gray-600 border-gray-200';
      default: return 'bg-gray-50 text-gray-600 border-gray-200';
    }
  };

  return (
    <div className="h-full flex flex-col overflow-hidden bg-[#fafafa]">
      {/* Header */}
      <div className="px-6 py-4 bg-white border-b border-gray-200">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-lg font-bold text-gray-900 flex items-center gap-2">
              <Truck className="w-5 h-5 text-blue-600" />
              Receiving Documents
            </h1>
            <p className="text-xs text-gray-500 mt-0.5">
              Track goods movements and monitor their invoicing status.
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" className="h-8 text-xs">
              <Download className="w-3.5 h-3.5 mr-1.5" />
              Export Log
            </Button>
            <Button size="sm" className="h-8 text-xs bg-gray-900 text-white hover:bg-black">
              Record Document
            </Button>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <Input
              placeholder="Search by Document #, PO #, or Vendor..."
              className="pl-9 h-9 text-sm border-gray-200"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <Button variant="outline" size="sm" className="h-9 text-sm gap-2">
            <Filter className="w-4 h-4" />
            Advanced Filters
          </Button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-6">
        <div className="bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden">
          <Table>
            <TableHeader className="bg-gray-900">
              <TableRow className="hover:bg-gray-900 border-b-0">
                <TableHead className="w-10"></TableHead>
                <TableHead className="text-[11px] font-bold text-gray-400 uppercase tracking-wider py-3">Document #</TableHead>
                <TableHead className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">Date</TableHead>
                <TableHead className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">PO Reference</TableHead>
                <TableHead className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">Vendor</TableHead>
                <TableHead className="text-[11px] font-bold text-gray-400 uppercase tracking-wider text-right">Items</TableHead>
                <TableHead className="text-[11px] font-bold text-gray-400 uppercase tracking-wider text-right">Received Qty</TableHead>
                <TableHead className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">Status</TableHead>
                <TableHead className="w-10"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredGrns.map((grn) => (
                <Fragment key={grn.grnNumber}>
                  <TableRow 
                    className={`cursor-pointer transition-colors ${expandedGrns.has(grn.grnNumber) ? 'bg-blue-50/30' : 'hover:bg-gray-50'}`}
                    onClick={() => toggleExpand(grn.grnNumber)}
                  >
                    <TableCell>
                      <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${expandedGrns.has(grn.grnNumber) ? '' : '-rotate-90'}`} />
                    </TableCell>
                    <TableCell className="font-semibold text-gray-900 text-sm">{grn.grnNumber}</TableCell>
                    <TableCell className="text-sm text-gray-600">
                      <div className="flex items-center gap-1.5">
                        <Calendar className="w-3.5 h-3.5 text-gray-400" />
                        {grn.grnDate}
                      </div>
                    </TableCell>
                    <TableCell className="text-sm">
                      <span className="px-2 py-0.5 bg-gray-100 text-gray-700 rounded text-[11px] font-medium border border-gray-200">
                        {grn.poNumber}
                      </span>
                    </TableCell>
                    <TableCell className="text-sm text-gray-900 font-medium">
                      <div className="flex items-center gap-2">
                        <Building2 className="w-3.5 h-3.5 text-gray-400" />
                        {grn.vendorName}
                      </div>
                    </TableCell>
                    <TableCell className="text-sm text-gray-600 text-right font-mono">{grn.items.length}</TableCell>
                    <TableCell className="text-sm font-semibold text-gray-900 text-right font-mono">{grn.receivedQty}</TableCell>
                    <TableCell>
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${getStatusColor(grn.status)} uppercase tracking-tight`}>
                        {grn.status}
                      </span>
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                          <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                            <MoreHorizontal className="w-4 h-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem>
                            <Eye className="w-4 h-4 mr-2" /> View Details
                          </DropdownMenuItem>
                          <DropdownMenuItem>
                            <FileText className="w-4 h-4 mr-2" /> View PO
                          </DropdownMenuItem>
                          <DropdownMenuItem>
                            <Download className="w-4 h-4 mr-2" /> Download Slip
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                  
                  {expandedGrns.has(grn.grnNumber) && (
                    <TableRow className="bg-gray-50/50 hover:bg-gray-50/50">
                      <TableCell colSpan={9} className="p-0">
                        <div className="px-14 py-4 border-l-4 border-blue-500">
                          <div className="bg-white border border-gray-200 rounded-lg overflow-hidden shadow-sm">
                            <Table>
                              <TableHeader className="bg-gray-50">
                                <TableRow className="hover:bg-gray-50">
                                  <TableHead className="text-[10px] font-bold text-gray-500 uppercase py-2">SKU</TableHead>
                                  <TableHead className="text-[10px] font-bold text-gray-500 uppercase">Description</TableHead>
                                  <TableHead className="text-[10px] font-bold text-gray-500 uppercase text-right">Received Qty</TableHead>
                                  {grn.status === 'Partially Invoiced' && (
                                    <>
                                      <TableHead className="text-[10px] font-bold text-green-600 uppercase text-right">Pre-Inv Qty</TableHead>
                                      <TableHead className="text-[10px] font-bold text-green-600 uppercase text-right">Pre-Inv Val</TableHead>
                                    </>
                                  )}
                                  <TableHead className="text-[10px] font-bold text-gray-500 uppercase">UOM</TableHead>
                                  <TableHead className="text-[10px] font-bold text-gray-500 uppercase text-right">Unit Price</TableHead>
                                  <TableHead className="text-[10px] font-bold text-gray-500 uppercase text-right">Total Price</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {grn.items.map((item) => (
                                  <TableRow key={item.id} className="hover:bg-gray-50/80">
                                    <TableCell className="text-xs font-mono font-medium text-blue-600">{item.sku}</TableCell>
                                    <TableCell className="text-xs text-gray-600">{item.description}</TableCell>
                                    <TableCell className="text-xs font-bold text-gray-900 text-right font-mono">{item.quantity}</TableCell>
                                    {grn.status === 'Partially Invoiced' && (
                                      <>
                                        <TableCell className="text-xs text-right">
                                          <div className="flex flex-col items-end">
                                            <span className="font-bold text-green-600 font-mono">{item.invoicedQty || 0}</span>
                                            {item.invoicedQty && item.invoicedQty > 0 && (
                                              <div className="flex flex-wrap justify-end gap-1 mt-0.5">
                                                <HoverCard openDelay={100}>
                                                  <HoverCardTrigger asChild>
                                                    <span className="text-[7px] bg-green-50 text-green-700 px-1 py-0 rounded border border-green-100 font-bold cursor-help">PINV-001</span>
                                                  </HoverCardTrigger>
                                                  <HoverCardContent side="top" className="w-64 p-3 bg-white border-green-100 shadow-xl rounded-xl z-[60]">
                                                    <div className="space-y-2">
                                                      <div className="flex items-center justify-between">
                                                        <span className="text-[9px] font-black text-green-600 uppercase tracking-widest">Pre-Invoice</span>
                                                        <span className="text-[9px] font-bold text-gray-400">2024-01-15</span>
                                                      </div>
                                                      <div className="flex items-center justify-between border-b border-gray-50 pb-1.5">
                                                        <span className="text-[11px] font-bold text-gray-900">PINV-001</span>
                                                        <VIMoneyCell value={item.unitPrice * (item.invoicedQty || 0)} currency="USD" className="text-[11px] font-black text-green-600" />
                                                      </div>
                                                      <p className="text-[9px] text-gray-500 font-medium leading-tight">Pre-billing record for partial quantities. Offsets against this receiving document.</p>
                                                    </div>
                                                  </HoverCardContent>
                                                </HoverCard>
                                                {item.invoicedQty > 20 && (
                                                  <HoverCard openDelay={100}>
                                                    <HoverCardTrigger asChild>
                                                      <span className="text-[7px] bg-green-50 text-green-700 px-1 py-0 rounded border border-green-100 font-bold cursor-help">PINV-002</span>
                                                    </HoverCardTrigger>
                                                    <HoverCardContent side="top" className="w-64 p-3 bg-white border-green-100 shadow-xl rounded-xl z-[60]">
                                                      <div className="space-y-2">
                                                        <div className="flex items-center justify-between">
                                                          <span className="text-[9px] font-black text-green-600 uppercase tracking-widest">Pre-Invoice</span>
                                                          <span className="text-[9px] font-bold text-gray-400">2024-02-01</span>
                                                        </div>
                                                        <div className="flex items-center justify-between border-b border-gray-50 pb-1.5">
                                                          <span className="text-[11px] font-bold text-gray-900">PINV-002</span>
                                                          <VIMoneyCell value={2400} currency="USD" className="text-[11px] font-black text-green-600" />
                                                        </div>
                                                        <p className="text-[9px] text-gray-500 font-medium leading-tight">Second billing record detected for this item. Offset logic applied.</p>
                                                      </div>
                                                    </HoverCardContent>
                                                  </HoverCard>
                                                )}
                                              </div>
                                            )}
                                          </div>
                                        </TableCell>
                                        <TableCell className="text-xs font-bold text-green-600 text-right font-mono">
                                          <VIMoneyCell value={(item.invoicedQty || 0) * item.unitPrice} currency="USD" />
                                        </TableCell>
                                      </>
                                    )}
                                    <TableCell className="text-xs text-gray-500">{item.uom}</TableCell>
                                    <TableCell className="text-xs text-gray-600 text-right font-mono"><VIMoneyCell value={item.unitPrice} currency="USD" /></TableCell>
                                    <TableCell className="text-xs font-semibold text-gray-900 text-right font-mono"><VIMoneyCell value={item.totalPrice} currency="USD" /></TableCell>
                                  </TableRow>
                                ))}
                              </TableBody>
                            </Table>
                          </div>
                        </div>
                      </TableCell>
                    </TableRow>
                  )}
                </Fragment>
              ))}
              
              {filteredGrns.length === 0 && (
                <TableRow>
                  <TableCell colSpan={9} className="h-40 text-center">
                    <div className="flex flex-col items-center justify-center text-gray-500">
                      <Package className="w-10 h-10 mb-2 opacity-20" />
                      <p className="text-sm">No receiving documents found matching your search.</p>
                      <Button variant="link" size="sm" onClick={() => setSearchQuery('')} className="text-blue-600">
                        Clear Search
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}
