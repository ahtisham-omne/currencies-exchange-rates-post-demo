/* CreateLocationModal — thin adapter that mounts the verbatim
 * CreatePartnerLocationModal (ported from Partner Management) and adapts
 * its payload to the existing `CreatedLocationPayload` consumed by the
 * Quote/SO LocationSelectionModal wire-ups. */
import { useState } from "react";
import { toast } from "sonner";
import { CreatePartnerLocationModal } from "./CreatePartnerLocationModal";
import StateTransitionOverlay from "../../shared/StateTransitionOverlay";

export interface CreatedLocationPayload {
  name: string;
  phone: string;
  email: string;
  address: {
    street: string;
    city: string;
    state: string;
    zip: string;
    cityState: string;
    full: string;
  };
}

interface CreateLocationModalProps {
  open: boolean;
  onOpenChange: (next: boolean) => void;
  customerName?: string;
  onCreated: (payload: CreatedLocationPayload) => void;
}

function parseAddress(full: string): CreatedLocationPayload["address"] {
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

export function CreateLocationModal({ open, onOpenChange, onCreated }: CreateLocationModalProps) {
  const [pendingPayload, setPendingPayload] = useState<CreatedLocationPayload | null>(null);

  return (
    <>
      <CreatePartnerLocationModal
        open={open}
        onOpenChange={onOpenChange}
        onLocationCreated={(data) => {
          const name = String((data as Record<string, unknown>).locationName || "").trim();
          const phone = String((data as Record<string, unknown>).phone || "").trim();
          const email = String((data as Record<string, unknown>).email || "").trim();
          const addressRaw = String((data as Record<string, unknown>).address || "").trim();
          const payload: CreatedLocationPayload = { name, phone, email, address: parseAddress(addressRaw) };
          onOpenChange(false);
          setPendingPayload(payload);
        }}
      />
      <StateTransitionOverlay
        isActive={pendingPayload !== null}
        heading="Adding location"
        fromLabel="New record"
        toLabel={pendingPayload?.name || "Location"}
        tone="success"
        meta="Saving location details"
        duration={1600}
        onComplete={() => {
          if (pendingPayload) {
            onCreated(pendingPayload);
            toast.success(`${pendingPayload.name || "Location"} added`);
          }
          setPendingPayload(null);
        }}
      />
    </>
  );
}
