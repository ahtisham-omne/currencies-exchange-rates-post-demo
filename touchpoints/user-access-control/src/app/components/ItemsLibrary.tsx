import { Box, Plus, Upload, Download } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "./shared/PageHeader";

export function ItemsLibrary() {
  return (
    <div className="w-full font-['Inter',sans-serif] flex flex-col h-full min-h-0">
      <PageHeader
        icon={Box}
        title="Items Library"
        subtitle="Centralized master data for all items, SKUs, and variants."
        actions={
          <>
            <button
              type="button"
              className="inline-flex items-center gap-1.5 h-9 px-3.5 text-[13px] rounded-lg border border-[#E2E8F0] bg-white text-slate-700 shadow-sm hover:bg-slate-50 transition-all duration-200 cursor-pointer"
              style={{ fontWeight: 500 }}
              onClick={() => toast.info("Import is coming soon")}
            >
              <Upload className="w-3.5 h-3.5 text-slate-400" />
              Import
            </button>
            <button
              type="button"
              className="inline-flex items-center gap-1.5 h-9 px-3.5 text-[13px] rounded-lg border border-[#E2E8F0] bg-white text-slate-700 shadow-sm hover:bg-slate-50 transition-all duration-200 cursor-pointer"
              style={{ fontWeight: 500 }}
              onClick={() => toast.info("Export is coming soon")}
            >
              <Download className="w-3.5 h-3.5 text-slate-400" />
              Export
            </button>
            <button
              type="button"
              className="inline-flex items-center gap-1.5 h-9 px-4 text-[13px] rounded-lg text-white shadow-sm transition-all duration-200 cursor-pointer hover:bg-[#0862D0]"
              style={{ backgroundColor: "#007FFF", fontWeight: 600 }}
              onClick={() => toast.info("Create New Item is coming soon")}
            >
              <Plus className="w-3.5 h-3.5" />
              Create New Item
            </button>
          </>
        }
      />

      {/* Content Area */}
      <div className="px-6 lg:px-8 py-6 flex-1 min-h-0 flex items-center justify-center">
        <p className="text-sm text-muted-foreground">Items Listing appears here</p>
      </div>
    </div>
  );
}
