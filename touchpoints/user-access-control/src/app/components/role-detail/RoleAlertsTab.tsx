import type { RoleDetail } from "../../data/role-detail-data";
import { AlertsModuleGrid } from "../alerts/AlertsModuleGridV2";

interface Props {
  role: RoleDetail;
}

export function RoleAlertsTab({ role }: Props) {
  return (
    <div className="flex flex-col flex-1 min-h-0">
      <AlertsModuleGrid scopeKey={`role-${role.id}`} subjectName={role.roleName} roleName={role.roleName} />
    </div>
  );
}
