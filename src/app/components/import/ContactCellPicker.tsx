import { useMemo } from "react";
import { RecipientsSelectionModal, type PoC } from "@/app/components/quote-creation/RecipientsSelectionModal";
import { MOCK_CUSTOMERS, MOCK_CONTACTS } from "@/app/components/quote-creation/Step1CustomerSelection";

/**
 * Contacts, on the module's "Select Point of Contact" modal.
 *
 * That modal is the module's answer to this exact question: it scopes to the
 * customer's contacts, carries title, company, phone and email, has the
 * primary flag, the department filters, Added Contacts, and its own Create
 * New. The importer has no business rebuilding any of that, so it hands the
 * modal the row's customer and takes back what was picked.
 *
 * Which value lands depends on the column. Primary Contact holds one name, so
 * the primary of the selection lands. Secondary Contacts is a list column, so
 * every other selected contact lands, pipe-separated, in the template's own
 * notation.
 */
export function ContactCellPicker({
  customerName,
  value,
  multiple,
  onCommit,
  onClose,
}: {
  customerName: string;
  value: string;
  /** True for the Secondary Contacts column. */
  multiple: boolean;
  onCommit: (next: string) => void;
  onClose: () => void;
}) {
  const customer = useMemo(
    () => MOCK_CUSTOMERS.find((c: { name: string }) => c.name.toLowerCase() === customerName.trim().toLowerCase()),
    [customerName],
  );

  /* The customer's own contacts, in the shape the modal expects. */
  const customerPocs = useMemo(() => {
    const own = (MOCK_CONTACTS as Array<{ id: string; name: string; email: string; phone?: string; title?: string; department?: string; customerName?: string }>)
      .filter((c) => !customer || c.customerName === customer.name);
    return own.slice(0, 60).map((c, i) => ({
      id: c.id,
      name: c.name,
      email: c.email,
      phone: c.phone ?? "",
      role: c.title ?? "",
      department: c.department ?? "",
      isPrimary: i === 0,
    }));
  }, [customer]);

  /* Pre-select whatever the file already named. */
  const wanted = value.split("|").map((v) => v.trim().toLowerCase()).filter(Boolean);
  const preselected = customerPocs.filter((c) => wanted.includes(c.name.toLowerCase()));

  return (
    <RecipientsSelectionModal
      isOpen
      onClose={onClose}
      currentCustomerId={customer?.id ?? "import"}
      currentCustomerName={customerName || ""}
      customerPocs={customerPocs as never}
      selectedRecipients={preselected as unknown as PoC[]}
      primaryPoCId={preselected[0]?.id}
      onSelect={(recipients: PoC[], primaryPoCId: string) => {
        if (recipients.length === 0) { onClose(); return; }
        if (!multiple) {
          const primary = recipients.find((r) => r.id === primaryPoCId) ?? recipients[0];
          onCommit(primary.name);
        } else {
          /* The primary belongs to the Primary Contact column, so the list
             column takes everyone else. */
          const rest = recipients.filter((r) => r.id !== primaryPoCId);
          onCommit((rest.length ? rest : recipients).map((r) => r.name).join("|"));
        }
        onClose();
      }}
    />
  );
}
