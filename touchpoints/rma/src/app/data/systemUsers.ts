// Mirrored from
// partner-management-module/src/app/components/vendors/partnerConstants.tsx
// so the SearchableUserPicker can be ported as-is. Keep this list in sync
// with the partner module's SYSTEM_USERS / SYSTEM_ROLES so both flows
// surface the same recipient roster.

export type LicenseType = "Full Access" | "Field User" | "Read Only";
export type UserStatus = "Active" | "Disabled";

export interface SystemUser {
  id: string;
  name: string;
  email: string;
  role: string;
  department: string;
  avatarColor: string;
  licenseType: LicenseType;
  status: UserStatus;
}

export const SYSTEM_USERS: SystemUser[] = [
  { id: "U-001", name: "Sarah Johnson", email: "sjohnson@company.com", role: "Procurement Manager", department: "Procurement", avatarColor: "hsl(var(--primary))", licenseType: "Full Access", status: "Active" },
  { id: "U-002", name: "Michael Torres", email: "mtorres@company.com", role: "Finance Director", department: "Finance", avatarColor: "hsl(var(--violet))", licenseType: "Full Access", status: "Active" },
  { id: "U-003", name: "Emily Chen", email: "echen@company.com", role: "Supply Chain Lead", department: "Supply Chain", avatarColor: "hsl(var(--success))", licenseType: "Full Access", status: "Active" },
  { id: "U-004", name: "David Kim", email: "dkim@company.com", role: "Account Manager", department: "Sales", avatarColor: "hsl(var(--warning))", licenseType: "Full Access", status: "Active" },
  { id: "U-005", name: "Rachel Adams", email: "radams@company.com", role: "CFO", department: "Finance", avatarColor: "hsl(var(--destructive))", licenseType: "Full Access", status: "Active" },
  { id: "U-006", name: "James Wilson", email: "jwilson@company.com", role: "Buyer", department: "Procurement", avatarColor: "hsl(var(--primary))", licenseType: "Full Access", status: "Active" },
  { id: "U-007", name: "Lisa Park", email: "lpark@company.com", role: "Operations Manager", department: "Operations", avatarColor: "hsl(var(--violet))", licenseType: "Full Access", status: "Active" },
  { id: "U-008", name: "Robert Garcia", email: "rgarcia@company.com", role: "Warehouse Lead", department: "Logistics", avatarColor: "hsl(var(--success))", licenseType: "Field User", status: "Active" },
  { id: "U-009", name: "Amanda Foster", email: "afoster@company.com", role: "Compliance Officer", department: "Legal", avatarColor: "hsl(var(--warning))", licenseType: "Full Access", status: "Active" },
  { id: "U-010", name: "Kevin Wright", email: "kwright@company.com", role: "AP Specialist", department: "Finance", avatarColor: "hsl(var(--primary))", licenseType: "Full Access", status: "Disabled" },
  { id: "U-011", name: "Maria Rodriguez", email: "mrodriguez@company.com", role: "Category Manager", department: "Procurement", avatarColor: "hsl(var(--violet))", licenseType: "Full Access", status: "Active" },
  { id: "U-012", name: "Chris Taylor", email: "ctaylor@company.com", role: "IT Admin", department: "IT", avatarColor: "hsl(var(--success))", licenseType: "Full Access", status: "Active" },
  { id: "U-013", name: "Jessica Lee", email: "jlee@company.com", role: "VP Procurement", department: "Procurement", avatarColor: "hsl(var(--destructive))", licenseType: "Full Access", status: "Active" },
  { id: "U-014", name: "Andrew Scott", email: "ascott@company.com", role: "Inventory Analyst", department: "Supply Chain", avatarColor: "hsl(var(--warning))", licenseType: "Field User", status: "Active" },
  { id: "U-015", name: "Nicole Brown", email: "nbrown@company.com", role: "Controller", department: "Finance", avatarColor: "hsl(var(--primary))", licenseType: "Full Access", status: "Active" },
  { id: "U-016", name: "Thomas Miller", email: "tmiller@company.com", role: "Sourcing Specialist", department: "Procurement", avatarColor: "hsl(var(--violet))", licenseType: "Read Only", status: "Active" },
  { id: "U-017", name: "Stephanie White", email: "swhite@company.com", role: "Risk Analyst", department: "Finance", avatarColor: "hsl(var(--success))", licenseType: "Full Access", status: "Active" },
  { id: "U-018", name: "Daniel Harris", email: "dharris@company.com", role: "Logistics Coordinator", department: "Logistics", avatarColor: "hsl(var(--warning))", licenseType: "Field User", status: "Disabled" },
  { id: "U-019", name: "Karen Martinez", email: "kmartinez@company.com", role: "Quality Manager", department: "Operations", avatarColor: "hsl(var(--primary))", licenseType: "Full Access", status: "Active" },
  { id: "U-020", name: "Brian Clark", email: "bclark@company.com", role: "Accounts Payable Manager", department: "Finance", avatarColor: "hsl(var(--destructive))", licenseType: "Full Access", status: "Active" },
];

export interface SystemRole {
  id: string;
  name: string;
  description: string;
  department: string;
  userCount: number;
  color: string;
  licenseType: LicenseType;
  status: UserStatus;
  activeUsers: number;
}

const ROLE_DESCRIPTIONS: Record<string, string> = {
  "Procurement Manager": "Manages vendor relationships, purchase orders, and procurement workflows.",
  "Finance Director": "Oversees financial operations, budgets, and fiscal strategy.",
  "Supply Chain Lead": "Coordinates supply chain logistics and vendor fulfillment.",
  "Account Manager": "Manages client accounts and commercial relationships.",
  "CFO": "Chief Financial Officer, executive financial oversight.",
  "Buyer": "Handles day-to-day purchasing and order placement.",
  "Operations Manager": "Manages operational processes and team productivity.",
  "Warehouse Lead": "Oversees warehouse operations, inventory, and shipping.",
  "Compliance Officer": "Ensures regulatory compliance and risk mitigation.",
  "AP Specialist": "Handles accounts payable processing and invoice management.",
  "Category Manager": "Manages product categories and vendor negotiations.",
  "IT Admin": "Administers system access, integrations, and IT infrastructure.",
  "VP Procurement": "Vice President of Procurement, strategic sourcing leadership.",
  "Inventory Analyst": "Analyzes inventory levels, forecasts, and stock optimization.",
  "Controller": "Oversees accounting operations and financial reporting.",
  "Sourcing Specialist": "Identifies and evaluates new vendor sources.",
  "Risk Analyst": "Assesses financial and operational risk exposure.",
  "Logistics Coordinator": "Coordinates shipping, freight, and delivery schedules.",
  "Quality Manager": "Manages quality assurance and inspection processes.",
  "Accounts Payable Manager": "Manages AP team and payment processing workflows.",
};

export const SYSTEM_ROLES: SystemRole[] = (() => {
  const roleMap = new Map<string, { department: string; count: number; color: string; licenseTypes: Set<LicenseType>; activeCount: number; hasDisabled: boolean }>();
  SYSTEM_USERS.forEach((u) => {
    const existing = roleMap.get(u.role);
    if (existing) {
      existing.count++;
      existing.licenseTypes.add(u.licenseType);
      if (u.status === "Active") existing.activeCount++;
      if (u.status === "Disabled") existing.hasDisabled = true;
    } else {
      roleMap.set(u.role, { department: u.department, count: 1, color: u.avatarColor, licenseTypes: new Set([u.licenseType]), activeCount: u.status === "Active" ? 1 : 0, hasDisabled: u.status === "Disabled" });
    }
  });
  return Array.from(roleMap.entries()).map(([name, data], i) => ({
    id: `R-${String(i + 1).padStart(3, "0")}`,
    name,
    description: ROLE_DESCRIPTIONS[name] || "",
    department: data.department,
    userCount: data.count,
    color: data.color,
    licenseType: data.licenseTypes.has("Full Access") ? "Full Access" : data.licenseTypes.has("Field User") ? "Field User" : "Read Only",
    status: (data.activeCount > 0 ? "Active" : "Disabled") as UserStatus,
    activeUsers: data.activeCount,
  }));
})();
