import { Archive, UserPlus, FileDown, Printer, X } from 'lucide-react';

interface BulkActionsToolbarProps {
  selectedCount: number;
  onArchive: () => void;
  onAssignRep: () => void;
  onExportCSV: () => void;
  onPrint: () => void;
  onClearSelection: () => void;
}

export function BulkActionsToolbar({
  selectedCount,
  onArchive,
  onAssignRep,
  onExportCSV,
  onPrint,
  onClearSelection,
}: BulkActionsToolbarProps) {
  if (selectedCount === 0) return null;

  return (
    <div 
      className="flex items-center gap-3 h-12 px-4 bg-white border border-[#E5E7EB] rounded shadow-lg"
      style={{ borderRadius: '8px', whiteSpace: 'nowrap' }}
    >
      {/* Selection Count */}
      <div className="flex items-center gap-2 pr-3 border-r border-[#E5E7EB]">
        <span className="text-[13px] font-medium text-[#374151]" style={{ fontWeight: 500 }}>
          {selectedCount} quote{selectedCount !== 1 ? 's' : ''} selected
        </span>
      </div>

      {/* Action Buttons */}
      <div className="flex items-center gap-1">
        <BulkActionButton
          icon={<Archive className="w-4 h-4" />}
          label="Archive"
          onClick={onArchive}
        />
        <BulkActionButton
          icon={<UserPlus className="w-4 h-4" />}
          label="Assign Rep"
          onClick={onAssignRep}
        />
        <BulkActionButton
          icon={<FileDown className="w-4 h-4" />}
          label="Export CSV"
          onClick={onExportCSV}
        />
        <BulkActionButton
          icon={<Printer className="w-4 h-4" />}
          label="Print"
          onClick={onPrint}
        />
      </div>

      {/* Divider */}
      <div className="w-px h-6 bg-[#E5E7EB] ml-1" />

      {/* Close Button */}
      <button
        onClick={onClearSelection}
        className="flex items-center justify-center w-8 h-8 text-[#6B7280] hover:bg-[#F3F4F6] rounded transition-colors"
        style={{ borderRadius: '6px' }}
        title="Clear selection"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}

interface BulkActionButtonProps {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
}

function BulkActionButton({ icon, label, onClick }: BulkActionButtonProps) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-1.5 h-9 px-3 text-[#374151] hover:bg-[#F9FAFB] rounded transition-colors"
      style={{ borderRadius: '6px' }}
    >
      {icon}
      <span className="text-[13px] font-medium" style={{ fontWeight: 500 }}>{label}</span>
    </button>
  );
}