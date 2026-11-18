/**
 * /rma — Vendor Returns list.
 *
 * SSR is disabled for this whole subtree (`ssr: false`) because the RMA
 * surface uses browser-only APIs — react-dnd's HTML5Backend for KPI card
 * drag-reorder, localStorage for saved view state, and portals for the
 * detail overlays. Rendering client-only keeps the port simple and matches
 * how the source app (Vite SPA) rendered these screens.
 */
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";

import { RMAListScreen } from "@/app/components/RMAListScreen";
import { RMACreationFlow } from "@/app/components/RMACreationFlow";
import type { RMARowActionId } from "@/app/components/RMADataTable";
import { useRMAContext } from "@/app/rma-context";
import { Layout, type AppView } from "@/app/components/Layout";

export const Route = createFileRoute("/rma")({
  ssr: false,
  component: RMARoute,
});

function RMARoute() {
  const navigate = useNavigate();
  const { rmas, currentUser, addRMAs } = useRMAContext();
  const [showCreate, setShowCreate] = useState(false);
  // Archiving takes an RMA off the working list; the record itself stays
  // reachable by direct link.
  // Archived returns reach the list now. It hides them until the Status
  // filter asks for them by name; dropping them here left the filter counting
  // rows that could never appear, and a return nobody could find again.
  const visibleRMAs = rmas;

  const onViewRMA = (id: string) => {
    const rma = rmas.find((r) => r.id === id);
    if (rma) {
      void navigate({
        to: "/rma/$rmaNumber",
        params: { rmaNumber: encodeURIComponent(rma.rmaNumber) },
      });
    }
  };

  const onRowAction = (_actionId: RMARowActionId, rmaId: string) => {
    const rma = rmas.find((r) => r.id === rmaId);
    if (!rma) return;
    // Row actions that need confirmation modals live on the detail
    // page; row-level tap just deep-links there.
    void navigate({
      to: "/rma/$rmaNumber",
      params: { rmaNumber: encodeURIComponent(rma.rmaNumber) },
    });
  };

  // Only RMA is wired up in this port; every other view surfaces as
  // "Coming soon" in the sidebar and never fires onViewChange with a
  // routable target. The rma case is a no-op (we're already here).
  const onViewChange = (view: AppView) => {
    if (view === "rma") return;
    if (view === "supply-chain") {
      void navigate({ to: "/supply-chain" });
      return;
    }
    void navigate({ to: "/" });
  };

  return (
    <Layout activeView="rma" onViewChange={onViewChange}>
      <RMAListScreen
        rmas={visibleRMAs}
        onCreateRMA={() => setShowCreate(true)}
        onViewRMA={onViewRMA}
        onRowAction={onRowAction}
      />
      {showCreate && (
        <RMACreationFlow
          onClose={() => setShowCreate(false)}
          currentUser={currentUser}
          existingRMAs={rmas}
          onCreated={(created) => {
            const first = created[0];
            if (!first) return;
            addRMAs(created);
            setShowCreate(false);
            // A return sent back to each vendor site saves as one draft per
            // site. This tab lands on the first; the rest open alongside it so
            // the sites can be worked in parallel rather than hunted for on
            // the list. Still inside the confirm click, so the browser treats
            // the extra tabs as user-opened.
            created.slice(1).forEach((rma) => {
              window.open(
                `/rma/${encodeURIComponent(rma.rmaNumber)}`,
                "_blank",
                "noopener",
              );
            });
            void navigate({
              to: "/rma/$rmaNumber",
              params: { rmaNumber: encodeURIComponent(first.rmaNumber) },
            });
          }}
        />
      )}
    </Layout>
  );
}
