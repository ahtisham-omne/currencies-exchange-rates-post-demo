import { useState } from 'react';
import { Settings } from 'lucide-react';
import { ColumnConfig } from '@/app/types/quote';

interface ColumnConfiguratorProps {
  columns: ColumnConfig[];
  onColumnsChange: (columns: ColumnConfig[]) => void;
}

export function ColumnConfigurator({ columns, onColumnsChange }: ColumnConfiguratorProps) {
  const [isOpen, setIsOpen] = useState(false);

  const toggleColumn = (key: string) => {
    const newColumns = columns.map(col =>
      col.key === key ? { ...col, visible: !col.visible } : col
    );
    onColumnsChange(newColumns);
  };

  const visibleCount = columns.filter(col => col.visible).length;

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center justify-center w-10 h-10 bg-white border border-[#D1D5DB] hover:bg-[#F9FAFB] rounded-md transition-colors"
        style={{ borderRadius: '6px' }}
        aria-label="Configure columns"
      >
        <Settings className="w-5 h-5 text-[#6B7280]" />
      </button>

      {isOpen && (
        <>
          <div 
            className="fixed inset-0 z-10" 
            onClick={() => setIsOpen(false)}
          />
          <div className="absolute top-full right-0 mt-2 w-[280px] bg-white border border-[#E5E7EB] rounded-lg shadow-lg z-20 overflow-hidden">
            <div className="px-4 py-3 border-b border-[#E5E7EB]">
              <h3 className="text-[14px] font-medium text-[#374151]">Show/Hide Columns</h3>
              <p className="text-[12px] text-[#9CA3AF] mt-1">
                {visibleCount} of {columns.length} visible
              </p>
            </div>

            <div className="p-2 max-h-[400px] overflow-y-auto">
              {columns.map(column => (
                <label
                  key={column.key}
                  className="flex items-center gap-3 px-3 py-2 hover:bg-[#F9FAFB] rounded cursor-pointer transition-colors"
                >
                  <input
                    type="checkbox"
                    checked={column.visible}
                    onChange={() => toggleColumn(column.key)}
                    className="w-4 h-4 rounded border-[#D1D5DB] text-[#1B6EF3] focus:ring-[#1B6EF3] focus:ring-offset-0"
                    style={{ borderRadius: '4px' }}
                  />
                  <span className="text-[14px] text-[#374151] flex-1">{column.label}</span>
                </label>
              ))}
            </div>

            <div className="px-4 py-3 bg-[#F7F8F9] border-t border-[#E5E7EB]">
              <button
                onClick={() => {
                  const resetColumns = columns.map(col => ({ ...col, visible: true }));
                  onColumnsChange(resetColumns);
                }}
                className="w-full text-[14px] text-[#1B6EF3] hover:text-[#0D5ED7] font-medium"
              >
                Show All Columns
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
