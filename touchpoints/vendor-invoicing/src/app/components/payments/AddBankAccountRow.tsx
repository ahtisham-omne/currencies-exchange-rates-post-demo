import { Plus } from 'lucide-react';
import { toast } from 'sonner';

/** "Add a bank account", the last row of a pay-from list (27 Nov 2026,
 *  Mahreen 7d). Bank accounts are set up in Cash Management, so it says so
 *  in the app's toast; there's no flow to add one here. */
export function AddBankAccountRow({ onClick }: { onClick?: () => void }) {
  return (
    <button
      type="button"
      onClick={() => {
        onClick?.();
        toast.info('Bank accounts are added in Cash Management', {
          description: 'Add the account there, and it lists here to pay from.',
        });
      }}
      className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-md text-left text-[12px] text-primary hover:bg-primary/[0.04] transition-colors cursor-pointer"
      style={{ fontWeight: 600 }}
    >
      <span className="w-6 h-6 rounded-md bg-primary/[0.08] flex items-center justify-center shrink-0">
        <Plus className="w-3.5 h-3.5" />
      </span>
      Add a bank account
    </button>
  );
}
