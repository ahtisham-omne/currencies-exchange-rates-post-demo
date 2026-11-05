/* CreateCustomerModal — thin adapter that mounts the verbatim
 * CreatePartnerModal (ported from Partner Management) and translates its
 * payload into the Quote/SO callers' existing `CreatedCustomerPayload`
 * shape, so wire-ups like Step1CustomerSelection / CreateSOModal don't
 * have to change. The heavy lifting lives in CreatePartnerModal. */
import { useState } from "react";
import { toast } from "sonner";
import { CreatePartnerModal } from "./CreatePartnerModal";
import StateTransitionOverlay from "../../shared/StateTransitionOverlay";

export interface CreatedCustomerPayload {
  name: string;
  phone: string;
  website: string;
  logoLetter: string;
  defaultAddress: {
    street: string;
    city: string;
    state: string;
    zip: string;
    cityState: string;
    full: string;
  };
}

interface CreateCustomerModalProps {
  open: boolean;
  onOpenChange: (next: boolean) => void;
  onCreated: (payload: CreatedCustomerPayload) => void;
  /** Optional pre-populated name — wired through to CreatePartnerModal's
   *  internal name field on every open. */
  seedName?: string;
  /** Customers already on the parent list — used to flag duplicates.
   *  Includes id + optional subtitle so the multi-match picker can
   *  disambiguate by location/address. */
  existingCustomers?: { id: string; name: string; subtitle?: string; logo?: string }[];
  /** Fired when the user picks "Use existing customer" on the duplicate prompt. */
  onUseExisting?: (existingId: string, existingName: string) => void;
}

/** Attempt to split a one-line address into street / city / state / zip.
 *  Partner Management's AddressAutocomplete returns the formatted single
 *  string, but Quote/SO consumers historically expected parts. We do a
 *  best-effort split and leave the un-parseable bits in `street`. */
function parseAddress(full: string): CreatedCustomerPayload["defaultAddress"] {
  const trimmed = (full || "").trim();
  if (!trimmed) {
    return { street: "", city: "", state: "", zip: "", cityState: "", full: "" };
  }
  const parts = trimmed.split(",").map((p) => p.trim()).filter(Boolean);
  if (parts.length >= 3) {
    const stateZip = parts[parts.length - 1];
    const city = parts[parts.length - 2];
    const street = parts.slice(0, parts.length - 2).join(", ");
    const stateZipMatch = stateZip.match(/^(\S+)\s+(\S+)$/);
    const state = stateZipMatch ? stateZipMatch[1] : stateZip;
    const zip = stateZipMatch ? stateZipMatch[2] : "";
    return {
      street,
      city,
      state,
      zip,
      cityState: `${city}, ${state}`,
      full: trimmed,
    };
  }
  return { street: trimmed, city: "", state: "", zip: "", cityState: "", full: trimmed };
}

export function CreateCustomerModal({ open, onOpenChange, onCreated, seedName, existingCustomers, onUseExisting }: CreateCustomerModalProps) {
  const [pendingPayload, setPendingPayload] = useState<CreatedCustomerPayload | null>(null);

  return (
    <>
      <CreatePartnerModal
        open={open}
        onOpenChange={onOpenChange}
        seedName={seedName}
        customerOnly
        existingCustomers={existingCustomers}
        onUseExistingCustomer={(id, name) => onUseExisting?.(id, name)}
        onPartnerCreated={(data) => {
          const name = String((data as Record<string, unknown>).partnerName || "").trim();
          const phone = String((data as Record<string, unknown>).partnerPhone || "").trim();
          const website = String((data as Record<string, unknown>).website || "").trim();
          const addressRaw = String((data as Record<string, unknown>).address || "").trim();
          const payload: CreatedCustomerPayload = {
            name,
            phone,
            website,
            logoLetter: (name[0] || "A").toUpperCase(),
            defaultAddress: parseAddress(addressRaw),
          };
          onOpenChange(false);
          setPendingPayload(payload);
        }}
      />
      <StateTransitionOverlay
        isActive={pendingPayload !== null}
        heading="Adding customer"
        fromLabel="New record"
        toLabel={pendingPayload?.name || "Customer"}
        tone="success"
        meta="Saving customer details"
        duration={1600}
        onComplete={() => {
          if (pendingPayload) {
            onCreated(pendingPayload);
            toast.success(`${pendingPayload.name || "Customer"} added`);
          }
          setPendingPayload(null);
        }}
      />
    </>
  );
}
