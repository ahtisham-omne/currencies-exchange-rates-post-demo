import React from "react";
import AppShell from "./layout/AppShell";
import TopBar from "./layout/TopBar";
import ModuleHomePage from "./layout/ModuleHomePage";
import type {
  ModuleCardItem,
  QuickActionItem,
  ActivityItem,
} from "./layout/ModuleHomePage";
import { MODULE_REGISTRY } from "../../config/module-registry";

/* ═══════════════════════════════════════════════════════════════
   BASE MODULE PAGE — Generic template driven by module-registry.
   Wraps AppShell + TopBar + ModuleHomePage.
   Each module page only supplies its data arrays.
   ═══════════════════════════════════════════════════════════════ */

export interface BaseModulePageProps {
  /** Key into MODULE_REGISTRY */
  moduleId: keyof typeof MODULE_REGISTRY;
  /** Module cards shown in the grid */
  cards: ModuleCardItem[];
  /** Quick-action shortcuts */
  actions: QuickActionItem[];
  /** Recent activity feed items */
  activity: ActivityItem[];
  /** Optional learn-more URL shown next to subtitle */
  learnMoreUrl?: string;
  /** Override grid column count (default 3) */
  gridCols?: 2 | 3 | 4;
  /** Enable drag-to-reorder (default true) */
  draggable?: boolean;
  /** Callback when "View All" is clicked on activity feed */
  onViewMoreActivity?: () => void;
  /** Extra actions rendered in the TopBar right slot */
  topBarActions?: React.ReactNode;
  /** Extra section below quick-actions / activity */
  bottomSection?: React.ReactNode;
}

export function BaseModulePage({
  moduleId,
  cards,
  actions,
  activity,
  learnMoreUrl,
  gridCols = 3,
  draggable = true,
  onViewMoreActivity,
  topBarActions,
  bottomSection,
}: BaseModulePageProps) {
  const config = MODULE_REGISTRY[moduleId];

  return (
    <AppShell>
      {/* Dynamic TopBar */}
      <TopBar title={config.title} showSearch actions={topBarActions} />

      {/* ModuleHomePage manages its own scroll + bg */}
      <ModuleHomePage
        pageTitle={config.title}
        pageSubtitle={config.subtitle}
        learnMoreUrl={learnMoreUrl}
        modules={cards}
        storageKey={`omnesoft:${config.id}:layout`}
        gridCols={gridCols}
        draggable={draggable}
        quickActions={actions}
        recentActivity={activity}
        onViewMoreActivity={onViewMoreActivity ?? (() => {})}
        bottomSection={bottomSection}
      />
    </AppShell>
  );
}

export default BaseModulePage;