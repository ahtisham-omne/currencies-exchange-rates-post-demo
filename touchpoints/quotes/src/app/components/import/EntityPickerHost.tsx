import { useMemo, useState } from "react";
import { ExternalLink, Plus } from "lucide-react";
import { toast } from "sonner";
import { BaseModal } from "@/app/components/shared/BaseModal";
import { SalesRepSelector, type SalesRepOption, type SelectedSalesRep } from "@/app/components/shared/SalesRepSelector";
import { PaymentTermsLibrary } from "@/app/components/quote-creation/PaymentTermsLibrary";
import { PaymentMethodSelectionModal } from "@/app/components/quote-creation/PaymentMethodSelectionModal";
import { SALES_REP_ROSTER } from "@/app/components/shared/salesRepRoster";
import { AddressSelectionModal } from "@/app/components/quote-creation/AddressSelectionModal";
import { PricingRulesLibrary } from "@/app/components/shared/PricingRulePresetModal";
import { ENTITY_META } from "./importSpec";
import { ResolveEntityDialog } from "./ResolveEntityDialog";
import type { EntityGap, EntityKind } from "./importModel";

/**
 * Which modal a cell opens.
 *
 * Every one of these entities already has a picker in this module, built for
 * the detail page: sales reps have the "Sales representatives" selector, terms
 * have the Payment Terms library, methods have their selection modal. Those
 * are the modals people already know, they carry the detail each record needs
 * (avatars, term descriptions, masked card numbers) and they are the ones a
 * change made anywhere else in the module goes through. So the importer opens
 * them, rather than a list of its own.
 *
 * What the importer adds is the one thing those modals have no reason to
 * carry: a route to CREATE the missing record in its own module, because a
 * legacy file routinely names something Omne has never heard of. That sits in
 * the modal's footer, next to its own actions.
 *
 * Entities with no module picker yet (item, pricing rule, unit) fall through
 * to the importer's own compact dialog, which already offers search,
 * near-matches and the same create route.
 */

export function EntityPickerHost({
  gap,
  customerName,
  onApply,
  onClose,
}: {
  gap: EntityGap;
  /** The row's customer, for the module modals that name it in their header. */
  customerName?: string;
  onApply: (replacement: string, scope: "all" | "one") => void;
  onClose: () => void;
}) {
  const meta = ENTITY_META[gap.entity];
  const current = gap.rawValue.trim();

  /* The create route the importer adds to a module modal's footer. */
  const CreateRoute = (
    <button
      type="button"
      onClick={() => {
        window.open(meta.createHref, "_blank", "noopener");
        toast.info(`Opening ${meta.module} to add a ${meta.noun}. This row stays failed until it exists.`);
      }}
      className="inline-flex items-center gap-1.5 h-9 px-3 rounded-lg border border-border bg-white text-[12.5px] text-slate-700 hover:bg-slate-50 hover:border-slate-300 transition-all cursor-pointer mr-auto"
      style={{ fontWeight: 500 }}
    >
      <Plus className="w-3.5 h-3.5" />
      Create in {meta.module}
      <ExternalLink className="w-3 h-3 opacity-60" />
    </button>
  );

  /* ── Sales rep: the module's own "Sales representatives" selector ── */
  if (gap.entity === "user") return <RepPicker current={current} createRoute={CreateRoute} onApply={onApply} onClose={onClose} />;

  /* ── Payment terms: the module's library, which carries its own
       "Create New" in the header, so the importer adds nothing. ── */
  if (gap.entity === "paymentTerm") {
    return (
      <PaymentTermsLibrary
        isOpen
        onClose={onClose}
        customerName=""
        onSelect={(term) => { onApply(term.name, "one"); onClose(); }}
      />
    );
  }

  /* ── Payment method: the module's selection modal ── */
  if (gap.entity === "paymentMethod") {
    return (
      <PaymentMethodSelectionModal
        isOpen
        onClose={onClose}
        customerName=""
        onSelect={(method: { label?: string; name?: string }) => {
          onApply(method.label ?? method.name ?? "", "one");
          onClose();
        }}
      />
    );
  }


  /* ── Delivery location: the module's Ship To picker, which already lists
       partners with their locations and carries "+ Add location". ── */
  if (gap.entity === "location") {
    return (
      <AddressSelectionModal
        isOpen
        type="shipping"
        customerName={customerName ?? ""}
        currentCustomer={{ id: "import", name: customerName ?? "", type: "Customer", location: "" } as never}
        currentAddress={null}
        onClose={onClose}
        onSelect={(address: { label?: string; name?: string }, partner: { name?: string }) => {
          /* The column's notation is "Customer > Location". */
          const loc = address.label ?? address.name ?? "";
          onApply(partner?.name ? `${partner.name} > ${loc}` : loc, "one");
          onClose();
        }}
      />
    );
  }

  /* ── Pricing rule: the module's own rules library. ── */
  if (gap.entity === "pricingRule") {
    return (
      <PricingRulesLibrary
        isOpen
        onClose={onClose}
        customerName={customerName ?? ""}
        onApply={(rule: { name?: string }) => { onApply(rule?.name ?? "", "one"); onClose(); }}
      />
    );
  }

  /* Everything else still uses the importer's own picker, which carries its
     own create route already. */
  return <ResolveEntityDialog gap={gap} onApply={onApply} onClose={onClose} />;
}

/** Entities that route to a module modal rather than the importer's own. */
export const MODULE_PICKER_ENTITIES: EntityKind[] = [
  "user", "paymentTerm", "paymentMethod", "location", "pricingRule",
];

function RepPicker({
  current, createRoute, onApply, onClose,
}: {
  current: string;
  createRoute: React.ReactNode;
  onApply: (replacement: string, scope: "all" | "one") => void;
  onClose: () => void;
}) {
  const available: SalesRepOption[] = useMemo(
    () => SALES_REP_ROSTER.map((r) => ({
      id: r.id, name: r.name, initials: r.initials, isCurrentUser: !!r.isCurrentUser, isCustomerDefault: false,
    })),
    [],
  );
  /* The cell holds one rep, by the identifier the file used (a name or an
     email), so the picker opens on whoever that resolves to. */
  const initial = useMemo(() => {
    const match = SALES_REP_ROSTER.find(
      (r) => r.name.toLowerCase() === current.toLowerCase() || r.email.toLowerCase() === current.toLowerCase(),
    );
    return match ? [{ id: match.id, name: match.name, initials: match.initials, isPrimary: true }] : [];
  }, [current]);
  const [selected, setSelected] = useState<SelectedSalesRep[]>(initial as SelectedSalesRep[]);

  const commit = () => {
    const primary = selected.find((r) => r.isPrimary) ?? selected[0];
    if (primary) {
      /* The column matches on the identifier the module stores, which is the
         rep's email in the roster. */
      const rep = SALES_REP_ROSTER.find((r) => r.id === primary.id);
      onApply(rep?.email ?? primary.name, "one");
    }
    onClose();
  };

  return (
    <BaseModal
      isOpen
      onClose={onClose}
      title="Sales representatives"
      width="md"
      zIndex={12500}
      bodyClassName="p-0"
      footer={
        <>
          {createRoute}
          <button
            type="button"
            onClick={onClose}
            className="inline-flex items-center justify-center px-4 h-9 rounded-lg border border-border bg-white text-[13px] text-slate-500 hover:text-foreground transition-colors cursor-pointer"
            style={{ fontWeight: 500 }}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={commit}
            disabled={selected.length === 0}
            className="inline-flex items-center justify-center px-4 h-9 rounded-lg bg-primary hover:bg-primary/90 text-white text-[13px] shadow-sm transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            style={{ fontWeight: 600 }}
          >
            Done
          </button>
        </>
      }
    >
      <SalesRepSelector
        availableReps={available}
        selectedReps={selected}
        onSelectedRepsChange={setSelected}
        renderDropdownOnly
        fullWidth
      />
    </BaseModal>
  );
}
