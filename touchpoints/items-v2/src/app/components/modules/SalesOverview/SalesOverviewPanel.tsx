// @ts-nocheck
// Sales tab orchestrator panel — owns the outer Partners panel + sub-tab strip
// (Sales Overview blue + Shipments teal) + conditional right-side CTA.
// Slice 1 wires the Sales Overview sub-tab body (KPI strip + table); the
// Shipments sub-tab body is passed in via the `shipmentsContent` render prop so
// Slice 2 can rebuild Shipments without touching this orchestrator.
import React, { useState } from "react";
import { TrendingUp, Truck, Plus } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../../ui/tabs";
import { SalesKpiStrip } from "./SalesKpiStrip";
import { SalesOverviewTable } from "./SalesOverviewTable";

interface SalesOverviewPanelProps {
  /** Existing Shipments sub-tab body — left untouched in Slice 1. */
  shipmentsContent: React.ReactNode;
  /** Optional: hook the Create Shipment CTA. Defaults to navigating to /shipments/new. */
  onCreateShipment?: () => void;
}

export function SalesOverviewPanel({ shipmentsContent, onCreateShipment }: SalesOverviewPanelProps) {
  const [activeSubTab, setActiveSubTab] = useState<"overview" | "shipments">("overview");

  const handleCreateShipment = () => {
    if (onCreateShipment) onCreateShipment();
    else window.location.href = "/shipments/new";
  };

  return (
    <Tabs value={activeSubTab} onValueChange={(v) => setActiveSubTab(v as "overview" | "shipments")} className="w-full">
      {/* Outer Partners panel wrapper */}
      <div className="border border-border rounded-xl bg-card overflow-clip flex flex-col">
        {/* Sub-tab strip — Partners segmented pill + right-side conditional CTA */}
        <div className="flex items-center justify-between gap-3 px-4 pt-2.5 pb-2 border-b border-border">
          {/* LEFT — segmented pill */}
          <TabsList className="inline-flex items-center rounded-lg bg-muted p-0.5 h-auto">
            {([
              { key: "overview",  label: "Sales Overview", icon: TrendingUp, color: "#1E40AF" },
              { key: "shipments", label: "Shipments",      icon: Truck,      color: "#0E7490" },
            ] as const).map((t) => (
              <TabsTrigger
                key={t.key}
                value={t.key}
                className="inline-flex items-center justify-center gap-1.5 px-4 py-1.5 rounded-md text-[13px] transition-all cursor-pointer text-slate-500 hover:text-slate-700 data-[state=active]:bg-white data-[state=active]:shadow-[0_1px_3px_rgba(0,0,0,0.08),0_1px_2px_rgba(0,0,0,0.04)] data-[state=active]:font-semibold"
                style={{ ['--active-color' as any]: t.color }}
              >
                <t.icon className="w-3.5 h-3.5" style={{ color: t.color }} />
                <span style={{ color: 'inherit' }}>{t.label}</span>
              </TabsTrigger>
            ))}
          </TabsList>

          {/* RIGHT — conditional: Sales Overview = nothing, Shipments = Create Shipment CTA */}
          <div className="flex items-center gap-2 shrink-0">
            {activeSubTab === "shipments" && (
              <button
                type="button"
                onClick={handleCreateShipment}
                className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg bg-primary hover:bg-[#0862D0] text-white text-[13px] shadow-sm transition-colors cursor-pointer"
                style={{ fontWeight: 600 }}
              >
                <Plus className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Create Shipment</span>
              </button>
            )}
          </div>
        </div>

        {/* Sales Overview sub-tab body — KPI strip + table */}
        <TabsContent value="overview" className="mt-0 focus-visible:outline-none">
          <SalesKpiStrip />
          <SalesOverviewTable />
        </TabsContent>

        {/* Shipments sub-tab body — passed in (Slice 2 will rebuild with Items-listing chrome) */}
        <TabsContent value="shipments" className="mt-0 focus-visible:outline-none">
          {shipmentsContent}
        </TabsContent>
      </div>
    </Tabs>
  );
}