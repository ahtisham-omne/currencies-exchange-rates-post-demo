import { Mail } from "lucide-react";
import { ComingSoonEmptyState } from "../shared/ComingSoonEmptyState";

/** Shared by the user detail and role detail pages. `subject` names the record
 *  so the copy reads correctly on both surfaces. */
export function CommunicationsTab({ subject = "user" }: { subject?: "user" | "role" }) {
  return (
    <ComingSoonEmptyState
      icon={Mail}
      title="Communications"
      description={`Internal and external communications for this ${subject} will appear here.`}
    />
  );
}
