/**
 * /supply-chain — Supply Chain module overview.
 *
 * ssr: false because SupplyChainOverviewScreen uses react-dnd (HTML5Backend)
 * for drag-reorderable module cards and localStorage for saved layout.
 */
import { createFileRoute, useNavigate } from "@tanstack/react-router";

import { SupplyChainOverviewScreen } from "@/app/components/SupplyChainOverviewScreen";
import { Layout, type AppView } from "@/app/components/Layout";

export const Route = createFileRoute("/supply-chain")({
  ssr: false,
  component: SupplyChainRoute,
});

function SupplyChainRoute() {
  const navigate = useNavigate();

  const onNavigate = (view: AppView) => {
    if (view === "rma") {
      void navigate({ to: "/rma" });
      return;
    }
    // Other supply-chain views not implemented yet — stay on the page.
  };

  return (
    <Layout activeView="supply-chain" onViewChange={onNavigate}>
      <SupplyChainOverviewScreen onNavigate={onNavigate} />
    </Layout>
  );
}
