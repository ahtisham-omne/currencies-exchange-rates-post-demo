// @ts-nocheck
import { useMemo } from "react";
import { toast } from "sonner";
import { SearchOverlay } from "@/app/components/so/SearchOverlayQuoteStyle";
import { MOCK_CUSTOMERS } from "@/app/components/so/CreateSOModal";
import { ENTITY_META } from "./importSpec";
import type { EntityKind } from "./importModel";

/**
 * Customer resolution, on the module's own search overlay.
 *
 * The importer used to pick a customer from a plain list it drew itself.
 * That was a second, worse customer picker: the module already has one,
 * the overlay behind the change-customer flow, and it searches customers,
 * their locations and their points of contact together, which is exactly
 * the lookup someone fixing an imported customer name needs.
 *
 * So this is a thin adapter, not a new picker. It hands the existing
 * overlay the module's customer and contact data and translates whatever
 * the user picks back into the cell value the file needs:
 *
 *   · a customer  → the customer name
 *   · a location  → "Customer > Location", the template's own notation
 *   · a contact   → the contact's own customer, since a contact identifies
 *                   a customer unambiguously
 *
 * The overlay's built-in "Create new" is wired to the create-in-module
 * touchpoint, so that affordance comes for free rather than being
 * reinvented in a footer.
 */

export function CustomerResolveOverlay({
  open,
  entity,
  onPick,
  onClose,
}: {
  open: boolean;
  /** customer, location or contact. Anything else uses the list dialog. */
  entity: EntityKind;
  onPick: (value: string) => void;
  onClose: () => void;
}) {
  const { customers, contacts } = useMemo(() => {
    const customers = MOCK_CUSTOMERS.map((c) => ({
      id: c.id,
      name: c.name,
      logo: c.initials,
      status: "Active" as const,
      locations: (c.locations || []).map((l) => ({
        id: l.id,
        name: l.name,
        city: l.city,
        address: l.address,
        isDefault: !!l.isDefault,
      })),
    }));
    const contacts = MOCK_CUSTOMERS.flatMap((c) =>
      (c.pocs || []).map((p) => {
        const loc = c.locations?.find((l) => l.id === p.locationId) || c.locations?.[0];
        return {
          id: p.id,
          name: p.name,
          initials: p.initials || (p.name || "").split(" ").map((w) => w[0]).join("").slice(0, 2),
          email: p.email || "",
          phone: p.phone || "",
          mobile: p.mobile || "",
          extension: p.extension || "",
          title: p.role || p.title || "",
          department: p.department || "",
          customerId: c.id,
          customerName: c.name,
          customerLogo: c.initials,
          locationId: loc?.id ?? "",
          locationName: loc?.name ?? "",
          locationCity: loc?.city ?? "",
          locationAddress: loc?.address ?? c.address ?? "",
          isPrimary: !!p.isPrimary,
          status: "Active" as const,
        };
      }),
    );
    return { customers, contacts };
  }, []);

  if (!open) return null;
  const meta = ENTITY_META[entity];

  return (
    <SearchOverlay
      isOpen={open}
      onClose={onClose}
      customers={customers}
      contacts={contacts}
      currentCustomerName=""
      onSelectCustomer={(c) => onPick(c.name)}
      /* A location resolves to the template's own "Customer > Location"
         notation, so the value round-trips through the parser. */
      onSelectLocation={(c, l) => onPick(entity === "location" ? `${c.name} > ${l.name}` : c.name)}
      /* Picking a contact identifies its customer, which is what the
         customer column needs; the contact column takes the name. */
      onSelectContact={(c, p) => onPick(entity === "contact" ? p.name : c.name)}
      onAddNew={(tab, query) => {
        window.open(meta.createHref, "_blank", "noopener");
        toast.info(
          `Opening ${meta.module} to create "${query || "a new record"}". These records stay failed until it exists, then finish them from Company Setup, Data Imports.`,
        );
        onClose();
      }}
    />
  );
}
