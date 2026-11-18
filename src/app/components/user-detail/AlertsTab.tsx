import { BellOff, Info } from "lucide-react";
import type { UserDetail } from "../../data/user-detail-data";
import { AlertsModuleGrid } from "../alerts/AlertsModuleGridV2";
import { ACCOUNT_ALERTS_NOTE } from "../../data/predefined-roles";

/* Standing account-level alerts notice. Rendered flush between the toolbar and
   the module cards, in the same slot and blue state as the "on by default"
   strip on Create Role step 2. */
const ACCOUNT_ALERTS_BANNER = (
  <div
    className="shrink-0 flex items-center gap-2.5 px-4 py-2.5"
    style={{
      backgroundColor: "#F5F9FF",
      borderBottom: "1px solid #DBEAFE",
      color: "#475569",
    }}
    role="status"
  >
    <Info className="w-4 h-4 shrink-0" style={{ color: "#0A77FF" }} aria-hidden />
    <span className="flex-1 min-w-0 text-[12.5px] leading-snug" style={{ fontWeight: 500 }}>
      {ACCOUNT_ALERTS_NOTE}
    </span>
  </div>
);

interface Props {
  user: UserDetail;
  /** Archived users have no active alerts and all toggles are removed. */
  archived?: boolean;
}

export function AlertsTab({ user, archived = false }: Props) {
  if (archived) {
    return (
      <div className="flex flex-col flex-1 min-h-0 items-center justify-center text-center px-6 py-20">
        <div
          className="w-12 h-12 rounded-full flex items-center justify-center mb-4"
          style={{ backgroundColor: "#F1F5F9" }}
        >
          <BellOff className="w-6 h-6" style={{ color: "#94A3B8" }} />
        </div>
        <p className="text-[14px] mb-1" style={{ fontWeight: 600, color: "#334155" }}>
          No Active Alerts While Archived
        </p>
        <p className="text-[12.5px] max-w-[360px] leading-relaxed" style={{ color: "#64748B" }}>
          Alert subscriptions are disabled for archived users. They are restored when the user is unarchived.
        </p>
      </div>
    );
  }
  return (
    <div className="flex flex-col flex-1 min-h-0">
      <AlertsModuleGrid
        scopeKey={`user-${user.id}`}
        subjectName={user.fullName}
        headerBanner={ACCOUNT_ALERTS_BANNER}
      />
    </div>
  );
}
