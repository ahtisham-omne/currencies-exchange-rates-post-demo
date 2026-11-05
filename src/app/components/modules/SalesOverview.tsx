// @ts-nocheck
// Backward-compat shim — preserves the standalone Sales Overview route.
// Slice 1 extracted the visual into SalesOverview/{SalesKpiStrip,SalesOverviewTable}.
// The SalesOverviewPanel orchestrator (sub-tab strip + outer panel + conditional CTA)
// is used by the Item Detail Sales tab.
import React from "react";
import { SalesKpiStrip } from "./SalesOverview/SalesKpiStrip";
import { SalesOverviewTable } from "./SalesOverview/SalesOverviewTable";

/**
 * SalesOverview — flat combinator (KPI strip + table) for the standalone
 * /sales-overview route. Item Detail uses SalesOverviewPanel instead.
 */
export const SalesOverview: React.FC = () => (
  <div className="space-y-6">
    <div className="border border-border rounded-xl bg-card overflow-clip flex flex-col">
      <SalesKpiStrip />
      <SalesOverviewTable />
    </div>
  </div>
);
