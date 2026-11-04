import { useState } from 'react';
import { Plus, Search, Filter, Download, MoreVertical } from 'lucide-react';
import { Button } from '@/app/components/ui/button';
import { Input } from '@/app/components/ui/input';
import { Badge } from '@/app/components/ui/badge';
import { Checkbox } from '@/app/components/ui/checkbox';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/app/components/ui/table';
import { toast } from 'sonner';
import { VIMoneyCell } from '@/app/components/currency/VIMoneyCell';

interface Payment {
  id: string;
  paymentNumber: string;
  vendor: string;
  paymentDate: string;
  paymentMethod: string;
  amount: number;
  appliedAmount: number;
  unappliedAmount: number;
  status: 'Pending' | 'Processed' | 'Cleared' | 'Voided';
}

const mockPayments: Payment[] = [
  {
    id: '1',
    paymentNumber: 'PMT-2024-001',
    vendor: 'Acme Supplies Co.',
    paymentDate: 'Jan 15, 2024',
    paymentMethod: 'ACH',
    amount: 5000,
    appliedAmount: 5000,
    unappliedAmount: 0,
    status: 'Cleared'
  },
  {
    id: '2',
    paymentNumber: 'PMT-2024-002',
    vendor: 'Premier Automotive',
    paymentDate: 'Jan 16, 2024',
    paymentMethod: 'Check',
    amount: 3500,
    appliedAmount: 3500,
    unappliedAmount: 0,
    status: 'Processed'
  },
  {
    id: '3',
    paymentNumber: 'PMT-2024-003',
    vendor: 'Tech Components Inc.',
    paymentDate: 'Jan 16, 2024',
    paymentMethod: 'Wire',
    amount: 10000,
    appliedAmount: 8500,
    unappliedAmount: 1500,
    status: 'Processed'
  }
];

export function PaymentsScreen() {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedPayments, setSelectedPayments] = useState<string[]>([]);

  const toggleSelectPayment = (id: string) => {
    if (selectedPayments.includes(id)) {
      setSelectedPayments(selectedPayments.filter(paymentId => paymentId !== id));
    } else {
      setSelectedPayments([...selectedPayments, id]);
    }
  };

  const handleRecordPayment = () => {
    toast.info('Record Payment', {
      description: 'Opening payment entry form...'
    });
  };

  const handleExport = () => {
    toast.success('Exporting payments', {
      description: 'Download will begin shortly...'
    });
  };

  const handleApplyToInvoice = (paymentId: string) => {
    const payment = mockPayments.find(p => p.id === paymentId);
    if (payment && payment.unappliedAmount > 0) {
      toast.info('Apply to invoice', {
        description: `$${payment.unappliedAmount.toLocaleString()} available to apply`
      });
    } else {
      toast.error('No unapplied funds', {
        description: 'This payment has been fully applied.'
      });
    }
  };

  return (
    <div className="h-full flex flex-col">
      {/* Breadcrumb */}
      <div className="px-6 py-4 border-b border-gray-200 bg-white">
        <div className="flex items-center gap-2 text-sm text-gray-600">
          <span>Accounting</span>
          <span>/</span>
          <span className="text-gray-900 font-medium">Payments</span>
        </div>
      </div>

      {/* Header */}
      <div className="px-6 py-6 bg-white border-b border-gray-200">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900 mb-1">Vendor Payments</h1>
            <p className="text-sm text-gray-600">
              Record and track vendor payments with invoice application
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={handleExport}>
              <Download className="w-4 h-4 mr-2" />
              Export
            </Button>
            <Button size="sm" onClick={handleRecordPayment} className="bg-blue-600 hover:bg-blue-700">
              <Plus className="w-4 h-4 mr-2" />
              Record Payment
            </Button>
          </div>
        </div>

        {/* Search */}
        <div className="flex gap-3">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <Input
              placeholder="Search by payment #, vendor, or invoice..."
              className="pl-10"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <Button variant="outline" size="sm">
            <Filter className="w-4 h-4 mr-2" />
            Filters
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="px-6 py-4 bg-gray-50 border-b border-gray-200">
        <div className="grid grid-cols-4 gap-4">
          <div className="bg-white rounded-lg p-4 border border-gray-200">
            <div className="text-sm text-gray-600 mb-1">Total Payments</div>
            <VIMoneyCell value={18500} currency="PKR" className="text-2xl font-semibold text-gray-900" />
          </div>
          <div className="bg-white rounded-lg p-4 border border-gray-200">
            <div className="text-sm text-gray-600 mb-1">Applied to Invoices</div>
            <VIMoneyCell value={17000} currency="PKR" className="text-2xl font-semibold text-blue-600" />
          </div>
          <div className="bg-white rounded-lg p-4 border border-gray-200">
            <div className="text-sm text-gray-600 mb-1">Unapplied Funds</div>
            <VIMoneyCell value={1500} currency="PKR" className="text-2xl font-semibold text-orange-600" />
          </div>
          <div className="bg-white rounded-lg p-4 border border-gray-200">
            <div className="text-sm text-gray-600 mb-1">Pending Payments</div>
            <div className="text-2xl font-semibold text-gray-900">0</div>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto bg-white">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-12">
                <Checkbox />
              </TableHead>
              <TableHead>PAYMENT #</TableHead>
              <TableHead>VENDOR</TableHead>
              <TableHead>DATE</TableHead>
              <TableHead>METHOD</TableHead>
              <TableHead className="text-right">AMOUNT</TableHead>
              <TableHead className="text-right">APPLIED</TableHead>
              <TableHead className="text-right">UNAPPLIED</TableHead>
              <TableHead>STATUS</TableHead>
              <TableHead className="w-12"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {mockPayments.map((payment) => (
              <TableRow key={payment.id}>
                <TableCell>
                  <Checkbox
                    checked={selectedPayments.includes(payment.id)}
                    onCheckedChange={() => toggleSelectPayment(payment.id)}
                  />
                </TableCell>
                <TableCell className="font-medium">{payment.paymentNumber}</TableCell>
                <TableCell>{payment.vendor}</TableCell>
                <TableCell>{payment.paymentDate}</TableCell>
                <TableCell>
                  <Badge variant="outline" className="text-xs">
                    {payment.paymentMethod}
                  </Badge>
                </TableCell>
                <TableCell className="text-right font-medium">
                  <VIMoneyCell value={payment.amount} currency="USD" />
                </TableCell>
                <TableCell className="text-right text-blue-600">
                  <VIMoneyCell value={payment.appliedAmount} currency="USD" />
                </TableCell>
                <TableCell className="text-right">
                  {payment.unappliedAmount > 0 ? (
                    <VIMoneyCell value={payment.unappliedAmount} currency="USD" className="text-orange-600 font-medium" />
                  ) : (
                    <span className="text-gray-400">—</span>
                  )}
                </TableCell>
                <TableCell>
                  <Badge
                    variant="secondary"
                    className={
                      payment.status === 'Cleared'
                        ? 'bg-green-100 text-green-700'
                        : payment.status === 'Processed'
                        ? 'bg-blue-100 text-blue-700'
                        : payment.status === 'Pending'
                        ? 'bg-yellow-100 text-yellow-700'
                        : 'bg-gray-100 text-gray-700'
                    }
                  >
                    {payment.status}
                  </Badge>
                </TableCell>
                <TableCell>
                  <Button variant="ghost" size="sm">
                    <MoreVertical className="w-4 h-4" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
