import { AlertCircle, CheckCircle, XCircle } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/app/components/ui/alert-dialog';
import { Invoice } from '@/app/data/mockInvoices';
import { VIMoneyCell } from '@/app/components/currency/VIMoneyCell';

interface BulkActionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  actionType: 'approve' | 'post' | 'void' | 'hold' | 'export' | null;
  selectedInvoices?: Invoice[];
  selectedCount?: number;
  onConfirm: () => void;
}

export function BulkActionDialog({
  open,
  onOpenChange,
  actionType,
  selectedInvoices,
  onConfirm
}: BulkActionDialogProps) {
  if (!actionType) return null;

  const getActionConfig = () => {
    switch (actionType) {
      case 'approve':
        return {
          title: 'Approve Invoices',
          description: 'Are you sure you want to approve the selected invoices?',
          icon: CheckCircle,
          iconColor: 'text-green-600',
          iconBg: 'bg-green-50',
          actionText: 'Approve',
          actionVariant: 'default' as const,
          warningText: 'Only invoices with "Pending Approval" or "Matched" status can be approved.',
        };
      case 'post':
        return {
          title: 'Post Invoices',
          description: 'Are you sure you want to post the selected invoices to the general ledger?',
          icon: CheckCircle,
          iconColor: 'text-blue-600',
          iconBg: 'bg-blue-50',
          actionText: 'Post',
          actionVariant: 'default' as const,
          warningText: 'Only approved invoices can be posted. This action will create GL entries.',
        };
      case 'void':
        return {
          title: 'Void Invoices',
          description: 'Are you sure you want to void the selected invoices?',
          icon: XCircle,
          iconColor: 'text-red-600',
          iconBg: 'bg-red-50',
          actionText: 'Void',
          actionVariant: 'destructive' as const,
          warningText: 'This action cannot be undone. Void invoices will be removed from AP balance.',
        };
      case 'hold':
        return {
          title: 'Place on Payment Hold',
          description: 'Are you sure you want to place the selected invoices on payment hold?',
          icon: AlertCircle,
          iconColor: 'text-yellow-600',
          iconBg: 'bg-yellow-50',
          actionText: 'Place on Hold',
          actionVariant: 'default' as const,
          warningText: 'Invoices on hold will not be included in payment runs.',
        };
      case 'export':
        return {
          title: 'Export Invoices',
          description: 'Export the selected invoices to Excel/CSV?',
          icon: CheckCircle,
          iconColor: 'text-blue-600',
          iconBg: 'bg-blue-50',
          actionText: 'Export',
          actionVariant: 'default' as const,
          warningText: 'The export will include all invoice details and line items.',
        };
      default:
        return null;
    }
  };

  const config = getActionConfig();
  if (!config) return null;

  const Icon = config.icon;
  const totalAmount = selectedInvoices.reduce((sum, inv) => sum + inv.amount, 0);

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="max-w-md">
        <AlertDialogHeader>
          <div className="flex items-start gap-4">
            <div className={`p-2.5 ${config.iconBg} rounded-lg`}>
              <Icon className={`w-6 h-6 ${config.iconColor}`} />
            </div>
            <div className="flex-1">
              <AlertDialogTitle className="text-lg font-semibold">
                {config.title}
              </AlertDialogTitle>
              <AlertDialogDescription className="mt-2 text-sm text-gray-600">
                {config.description}
              </AlertDialogDescription>
            </div>
          </div>
        </AlertDialogHeader>
        
        <div className="space-y-3 py-4">
          {/* Selected invoices summary */}
          <div className="bg-gray-50 rounded-lg p-3 border border-gray-200">
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div>
                <div className="text-xs text-gray-500 mb-0.5">Invoices Selected</div>
                <div className="font-semibold text-gray-900">{selectedInvoices.length}</div>
              </div>
              <div>
                <div className="text-xs text-gray-500 mb-0.5">Total Amount</div>
                <VIMoneyCell value={totalAmount} currency="PKR" className="font-semibold text-gray-900" />
              </div>
            </div>
          </div>

          {/* Status breakdown */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
            <div className="flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" />
              <p className="text-xs text-blue-900">{config.warningText}</p>
            </div>
          </div>
        </div>

        <AlertDialogFooter>
          <AlertDialogCancel className="h-9 text-sm">Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={onConfirm}
            className={`h-9 text-sm ${
              config.actionVariant === 'destructive'
                ? 'bg-red-600 hover:bg-red-700'
                : 'bg-blue-600 hover:bg-blue-700'
            }`}
          >
            {config.actionText}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
