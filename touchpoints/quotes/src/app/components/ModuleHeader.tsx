import { FileText, Plus, Clock } from 'lucide-react';

interface ModuleHeaderProps {
  activeTab: 'quotes' | 'activity_log';
  onTabChange: (tab: 'quotes' | 'activity_log') => void;
  onCreateQuote: () => void;
}

export function ModuleHeader({ activeTab, onTabChange, onCreateQuote }: ModuleHeaderProps) {
  return (
    <div className="bg-card border-b border-border shrink-0" style={{ fontFamily: 'Inter, system-ui, sans-serif' }}>
      {/* Title Row — SO-style: icon + title + description + create button */}
      <div className="flex items-center justify-between -mx-0 px-6 lg:px-8 pt-3.5 pb-3.5">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: "#EDF4FF" }}>
            <FileText className="w-4 h-4" style={{ color: "#0A77FF" }} />
          </div>
          <div>
            <h1 className="font-bold text-[20px] text-foreground" style={{ margin: 0, lineHeight: 1.2 }}>Quotes</h1>
            <p className="text-xs text-muted-foreground" style={{ marginTop: 1 }}>
              Manage and track sales quotes — from creation and approval to conversion — all in one place.
            </p>
          </div>
        </div>

        {/* Create Button — SO-style */}
        <button
          onClick={onCreateQuote}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-[13px] bg-primary text-primary-foreground hover:bg-primary/90 shrink-0 transition-colors cursor-pointer"
          style={{ fontWeight: 600 }}
        >
          <Plus className="w-4 h-4" strokeWidth={2.5} />
          Create New Quote
        </button>
      </div>

      {/* Tabs */}
      <div className="px-6 lg:px-8 flex items-center gap-6">
        <button
          onClick={() => onTabChange('quotes')}
          className={`relative pb-2.5 pt-0.5 text-[13px] border-none bg-transparent cursor-pointer transition-colors ${
            activeTab === 'quotes' ? 'text-[#0A77FF]' : 'text-muted-foreground hover:text-foreground'
          }`}
          style={{ fontWeight: 500 }}
        >
          Quotes
          {activeTab === 'quotes' && (
            <div className="absolute bottom-[-1px] left-0 right-0 h-[2px] bg-[#0A77FF] rounded-t-sm" />
          )}
        </button>
        <button
          onClick={() => onTabChange('activity_log')}
          className={`relative pb-2.5 pt-0.5 text-[13px] border-none bg-transparent cursor-pointer transition-colors flex items-center gap-1.5 ${
            activeTab === 'activity_log' ? 'text-[#0A77FF]' : 'text-muted-foreground hover:text-foreground'
          }`}
          style={{ fontWeight: 500 }}
        >
          <Clock className="w-3.5 h-3.5" />
          Activity Log
          {activeTab === 'activity_log' && (
            <div className="absolute bottom-[-1px] left-0 right-0 h-[2px] bg-[#0A77FF] rounded-t-sm" />
          )}
        </button>
      </div>
    </div>
  );
}
