export interface PermissionRequestRow {
  id: string;
  requestedBy: string;
  requestedFor: string;
  reason: string;
  requestedOn: string;
  status: "Pending" | "Accepted" | "Rejected";
  /** Reviewer's full name (set when status moves to Accepted/Rejected). */
  reviewedBy?: string;
  /** Date the review decision was made (MM/DD/YYYY). */
  reviewedOn?: string;
}


/* ─── Per-user permission request data ─── */
/* The Account Owners (Eli 4, Nophil 5) have no requests: the role already
 * holds every permission, so there is nothing for them to request. */
const USER_PERMISSION_REQUESTS: Record<number, PermissionRequestRow[]> = {
  1: [
    { id: "upr-1-001", requestedBy: "Ahtisham Ahmad", requestedFor: "Purchase Orders", reason: "Need edit access to manage vendor procurement for warehouse restocking", requestedOn: "03/12/2026", status: "Pending" },
    { id: "upr-1-002", requestedBy: "Ahtisham Ahmad", requestedFor: "Inventory Movement", reason: "Requesting transfer management permissions for cross-warehouse operations", requestedOn: "03/05/2026", status: "Accepted" },
    { id: "upr-1-003", requestedBy: "Ahtisham Ahmad", requestedFor: "Cycle Count", reason: "Need access to perform quarterly inventory audits across all locations", requestedOn: "02/20/2026", status: "Accepted" },
    { id: "upr-1-004", requestedBy: "Ahtisham Ahmad", requestedFor: "Warehouse Locations", reason: "Require zone management access for new regional distribution center setup", requestedOn: "02/10/2026", status: "Rejected" },
    { id: "upr-1-005", requestedBy: "Ahtisham Ahmad", requestedFor: "Shipments", reason: "Need shipment tracking module for outbound logistics coordination", requestedOn: "01/28/2026", status: "Accepted" },
  ],
  2: [
    { id: "upr-2-001", requestedBy: "Faizan Khan", requestedFor: "Quality Inspections", reason: "Need full access to create and manage quality inspection checklists", requestedOn: "03/14/2026", status: "Pending" },
    { id: "upr-2-002", requestedBy: "Faizan Khan", requestedFor: "Non-Conformance Reports", reason: "Requesting NCR management for documenting production defects", requestedOn: "03/08/2026", status: "Pending" },
    { id: "upr-2-003", requestedBy: "Faizan Khan", requestedFor: "Item Library", reason: "View access needed to cross-reference product specs during QA review", requestedOn: "02/25/2026", status: "Accepted" },
    { id: "upr-2-004", requestedBy: "Faizan Khan", requestedFor: "Work Orders", reason: "Need read access to track manufacturing work orders under review", requestedOn: "02/12/2026", status: "Accepted" },
    { id: "upr-2-005", requestedBy: "Faizan Khan", requestedFor: "Users & Roles", reason: "Requesting admin permissions to assign QA team roles", requestedOn: "01/30/2026", status: "Rejected" },
    { id: "upr-2-006", requestedBy: "Faizan Khan", requestedFor: "Reports", reason: "Need custom report builder access for weekly QA summary dashboards", requestedOn: "01/15/2026", status: "Accepted" },
  ],
  3: [
    { id: "upr-3-001", requestedBy: "Areeb Tanveer", requestedFor: "Budget Management", reason: "Require budget approval authority for department annual planning", requestedOn: "03/10/2026", status: "Pending" },
    { id: "upr-3-002", requestedBy: "Areeb Tanveer", requestedFor: "Compliance Reports", reason: "Need access to generate compliance audit trail reports for regulators", requestedOn: "02/28/2026", status: "Accepted" },
    { id: "upr-3-003", requestedBy: "Areeb Tanveer", requestedFor: "Vendor Management", reason: "Requesting vendor onboarding permissions for new supplier negotiations", requestedOn: "02/15/2026", status: "Accepted" },
  ],
  6: [
    { id: "upr-6-001", requestedBy: "Irtaza Abid", requestedFor: "Data Warehouse", reason: "Need direct query access to data warehouse for advanced analytics pipelines", requestedOn: "03/15/2026", status: "Pending" },
    { id: "upr-6-002", requestedBy: "Irtaza Abid", requestedFor: "ETL Pipelines", reason: "Requesting pipeline management for automated data extraction workflows", requestedOn: "03/02/2026", status: "Pending" },
    { id: "upr-6-003", requestedBy: "Irtaza Abid", requestedFor: "Dashboard Builder", reason: "Need custom dashboard creation for executive KPI visualization", requestedOn: "02/16/2026", status: "Accepted" },
    { id: "upr-6-004", requestedBy: "Irtaza Abid", requestedFor: "API Integrations", reason: "Require API connector access to pull data from third-party platforms", requestedOn: "02/01/2026", status: "Accepted" },
    { id: "upr-6-005", requestedBy: "Irtaza Abid", requestedFor: "Data Catalog", reason: "Requesting catalog management to maintain metadata and data lineage", requestedOn: "01/18/2026", status: "Accepted" },
    { id: "upr-6-006", requestedBy: "Irtaza Abid", requestedFor: "User Segments", reason: "Need segmentation module for behavioral analytics reporting", requestedOn: "01/05/2026", status: "Rejected" },
    { id: "upr-6-007", requestedBy: "Irtaza Abid", requestedFor: "Exports", reason: "Requesting bulk export permissions for quarterly data archiving", requestedOn: "12/20/2025", status: "Accepted" },
    { id: "upr-6-008", requestedBy: "Irtaza Abid", requestedFor: "Schema Management", reason: "Need schema editor access for database table optimization", requestedOn: "12/08/2025", status: "Accepted" },
  ],
  7: [
    { id: "upr-7-001", requestedBy: "Muhammad Ghufran", requestedFor: "Partners", reason: "Need partner portal management for strategic alliance onboarding", requestedOn: "03/09/2026", status: "Accepted" },
    { id: "upr-7-002", requestedBy: "Muhammad Ghufran", requestedFor: "Contracts", reason: "Requesting contract management to handle client renewal agreements", requestedOn: "02/24/2026", status: "Pending" },
    { id: "upr-7-003", requestedBy: "Muhammad Ghufran", requestedFor: "Quotes", reason: "Need quoting module for generating custom client proposals", requestedOn: "02/10/2026", status: "Accepted" },
  ],
  8: [
    { id: "upr-8-001", requestedBy: "Aden Erickson", requestedFor: "Process Automation", reason: "Need workflow automation to design and deploy business process templates", requestedOn: "03/14/2026", status: "Pending" },
    { id: "upr-8-002", requestedBy: "Aden Erickson", requestedFor: "Requirements Tracker", reason: "Requesting requirements management for documenting stakeholder needs", requestedOn: "02/27/2026", status: "Accepted" },
    { id: "upr-8-003", requestedBy: "Aden Erickson", requestedFor: "Change Requests", reason: "Need change request module to log and track scope modifications", requestedOn: "02/14/2026", status: "Accepted" },
    { id: "upr-8-004", requestedBy: "Aden Erickson", requestedFor: "Reports", reason: "Custom report builder access for gap analysis documentation", requestedOn: "01/30/2026", status: "Accepted" },
    { id: "upr-8-005", requestedBy: "Aden Erickson", requestedFor: "Integrations", reason: "Need integration settings to connect third-party analysis tools", requestedOn: "01/15/2026", status: "Rejected" },
  ],
  9: [
    { id: "upr-9-001", requestedBy: "Nataly Carrillo", requestedFor: "Product Roadmap", reason: "Need roadmap planning module for quarterly feature prioritization", requestedOn: "03/16/2026", status: "Pending" },
    { id: "upr-9-002", requestedBy: "Nataly Carrillo", requestedFor: "Sprint Board", reason: "Requesting sprint management for backlog grooming and velocity tracking", requestedOn: "03/03/2026", status: "Accepted" },
    { id: "upr-9-003", requestedBy: "Nataly Carrillo", requestedFor: "User Feedback", reason: "Need feedback collection module for beta tester survey management", requestedOn: "02/19/2026", status: "Accepted" },
    { id: "upr-9-004", requestedBy: "Nataly Carrillo", requestedFor: "Release Notes", reason: "Requesting release management to publish changelog and announcements", requestedOn: "02/06/2026", status: "Pending" },
    { id: "upr-9-005", requestedBy: "Nataly Carrillo", requestedFor: "Analytics", reason: "Need product analytics dashboard for feature adoption metrics", requestedOn: "01/23/2026", status: "Accepted" },
    { id: "upr-9-006", requestedBy: "Nataly Carrillo", requestedFor: "Pricing Config", reason: "Requesting pricing module access for tier comparison analysis", requestedOn: "01/08/2026", status: "Rejected" },
  ],
  10: [
    { id: "upr-10-001", requestedBy: "Kassandra Gillespie", requestedFor: "General Ledger", reason: "Need GL module for month-end journal entry management", requestedOn: "03/12/2026", status: "Accepted" },
    { id: "upr-10-002", requestedBy: "Kassandra Gillespie", requestedFor: "Tax Filing", reason: "Requesting tax module for quarterly filing preparation and submissions", requestedOn: "02/26/2026", status: "Pending" },
    { id: "upr-10-003", requestedBy: "Kassandra Gillespie", requestedFor: "Investment Portfolio", reason: "Need portfolio tracking for corporate treasury investment management", requestedOn: "02/11/2026", status: "Accepted" },
  ],
};

/* ─── Default: generate a small number of requests for users without explicit data ─── */
const DEFAULT_MODULES = [
  "Item Library", "Purchase Orders", "Sales Orders", "Warehouse Locations",
  "Inventory Movement", "Receiving", "Shipments", "Reports",
  "Cycle Count", "Partners", "Quotes", "Contracts",
];

const DEFAULT_REASONS = [
  "Requesting view access for cross-department collaboration",
  "Need edit permissions to support daily operational tasks",
  "Require module access for upcoming project deliverables",
  "Requesting approval authority for time-sensitive workflows",
  "Need export permissions for quarterly compliance reporting",
];

const DEFAULT_STATUSES: ("Accepted" | "Pending" | "Rejected")[] = [
  "Accepted", "Pending", "Accepted", "Rejected", "Pending", "Accepted",
];

const DEFAULT_DATES = [
  "03/10/2026", "02/28/2026", "02/15/2026",
  "02/01/2026", "01/18/2026", "01/05/2026",
];

function generateDefaultRequests(userId: number, userName: string): PermissionRequestRow[] {
  // Use userId as a seed for deterministic pseudo-random selection
  const count = 2 + (userId % 4); // 2-5 requests per user
  const requests: PermissionRequestRow[] = [];
  for (let i = 0; i < count; i++) {
    const modIdx = (userId * 3 + i * 7) % DEFAULT_MODULES.length;
    const reasonIdx = (userId * 2 + i * 5) % DEFAULT_REASONS.length;
    const statusIdx = (userId + i * 3) % DEFAULT_STATUSES.length;
    const dateIdx = i % DEFAULT_DATES.length;
    requests.push({
      id: `upr-${userId}-gen-${i + 1}`,
      requestedBy: userName,
      requestedFor: DEFAULT_MODULES[modIdx],
      reason: DEFAULT_REASONS[reasonIdx],
      requestedOn: DEFAULT_DATES[dateIdx],
      status: DEFAULT_STATUSES[statusIdx],
    });
  }
  return requests;
}

/* ─── Public accessor ─── */
import { users } from "./users-data";
import { isNewTenant } from "./tenant";

export function getUserPermissionRequests(userId: number): PermissionRequestRow[] {
  /* All of these are made up; nobody in a company from onboarding has asked
   * for anything yet. */
  if (isNewTenant()) return [];
  if (USER_PERMISSION_REQUESTS[userId]) {
    return USER_PERMISSION_REQUESTS[userId];
  }
  const user = users.find((u) => u.id === userId);
  if (!user) return [];
  return generateDefaultRequests(userId, user.fullName);
}
