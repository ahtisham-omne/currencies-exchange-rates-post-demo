import { useState, useEffect } from 'react';
import { Ban, Undo2, ArrowLeftRight } from 'lucide-react';
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
import { Label } from '@/app/components/ui/label';

// Payments flavor of InvoiceReasonDialog — Void / Unapply both mutate
// posted financial records, so they require a written reason that lands
// in the payment history (same PRD §1.7.4 pattern as invoices).
export type PaymentReasonAction = 'void' | 'unapply' | 'reverse';

interface PaymentReasonDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  action: PaymentReasonAction | null;
  /** Number of payments the action applies to (bulk or single). */
  count: number;
  onConfirm: (reason: string) => void;
}

const ACTION_CONFIG: Record<PaymentReasonAction, {
  title: string;
  description: string;
  placeholder: string;
  actionText: string;
  destructive: boolean;
  icon: React.ComponentType<{ className?: string }>;
  iconBg: string;
  iconColor: string;
}> = {
  void: {
    title: 'Void Payment',
    description:
      'Please provide a reason for voiding this payment. Any applied amounts will be released back to the invoices, and voided payments cannot be reopened.',
    placeholder: 'Reason for voiding (required)…',
    actionText: 'Void Payment',
    destructive: true,
    icon: Ban,
    iconBg: 'bg-rose-50',
    iconColor: 'text-rose-600',
  },
  unapply: {
    title: 'Unapply Funds',
    description:
      'Provide the reason for unapplying this payment from its invoices. The funds return to Unapplied and the linked invoices revert to their prior balance.',
    placeholder: 'Reason for unapplying (required)…',
    actionText: 'Unapply Funds',
    destructive: false,
    icon: Undo2,
    iconBg: 'bg-amber-50',
    iconColor: 'text-amber-600',
  },
  reverse: {
    title: 'Mark as Reversed',
    description:
      'This payment completed but the funds were returned (for example a bounced or failed transfer). Note why, then re-pay the related invoices or write the amount off. The linked invoices reopen as unpaid.',
    placeholder: 'Reason for the reversal (required)…',
    actionText: 'Mark as Reversed',
    destructive: true,
    icon: ArrowLeftRight,
    iconBg: 'bg-rose-50',
    iconColor: 'text-rose-600',
  },
};

export function PaymentReasonDialog({
  open,
  onOpenChange,
  action,
  count,
  onConfirm,
}: PaymentReasonDialogProps) {
  const [reason, setReason] = useState('');

  // Reset reason whenever the dialog is reopened for a new action
  useEffect(() => {
    if (open) setReason('');
  }, [open, action]);

  if (!action) return null;

  const config = ACTION_CONFIG[action];
  const Icon = config.icon;
  const trimmed = reason.trim();
  const disabled = trimmed.length === 0;

  const titleSuffix = count > 1 ? `s (${count})` : '';

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="max-w-md">
        <AlertDialogHeader>
          <div className="flex items-start gap-3">
            <div className={`p-2.5 ${config.iconBg} rounded-lg shrink-0`}>
              <Icon className={`w-5 h-5 ${config.iconColor}`} />
            </div>
            <div className="flex-1 min-w-0">
              <AlertDialogTitle className="text-lg" style={{ fontWeight: 600 }}>
                {config.title}
                {titleSuffix}
              </AlertDialogTitle>
              <AlertDialogDescription className="mt-1 text-sm text-muted-foreground">
                {config.description}
              </AlertDialogDescription>
            </div>
          </div>
        </AlertDialogHeader>

        <div className="space-y-2 py-2">
          <Label
            htmlFor="payment-reason"
            className="text-xs text-foreground"
            style={{ fontWeight: 500 }}
          >
            Reason <span className="text-rose-500">*</span>
          </Label>
          <textarea
            id="payment-reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder={config.placeholder}
            rows={4}
            className="w-full text-sm rounded-md border border-border bg-white px-3 py-2 outline-none focus:border-primary/40 focus:ring-2 focus:ring-primary/10 placeholder:text-muted-foreground/50 resize-none"
            autoFocus
          />
        </div>

        <AlertDialogFooter>
          <AlertDialogCancel className="h-9 text-sm">Back</AlertDialogCancel>
          <AlertDialogAction
            disabled={disabled}
            onClick={(e) => {
              if (disabled) {
                e.preventDefault();
                return;
              }
              onConfirm(trimmed);
            }}
            className={`h-9 text-sm ${
              config.destructive
                ? 'bg-rose-600 hover:bg-rose-700 text-white'
                : 'bg-primary hover:bg-primary/90 text-primary-foreground'
            } disabled:opacity-50 disabled:cursor-not-allowed`}
          >
            {config.actionText}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
