/* Importer (user) dictionary shared by both the import history listing and the
 * import detail page. Keyed by the short codes carried on each completed-import
 * record so a listing row and its drill-down render the same identity. */
import { CURRENT_USER } from "../../data/current-user";
import { isNewTenant } from "../../data/tenant";
import { getInitials } from "../../lib/avatar";

export interface Importer {
  name: string;
  initials: string;
  bg: string;
  fg: string;
  role: string;
  email: string;
  phone: string;
}

export type ImporterKey = "sj" | "ac" | "ra" | "am";

export const IMPORTERS: Record<ImporterKey, Importer> = {
  sj: { name: "Sarah Johnson",  initials: "SJ", bg: "#EDF4FF", fg: "#0A77FF", role: "HR Manager",              email: "sjohnson@omnesoft.com", phone: "+1 555-0142" },
  ac: { name: "Alex Chen",      initials: "AC", bg: "#ECFDF5", fg: "#059669", role: "IT System Administrator", email: "achen@omnesoft.com", phone: "+1 555-0188" },
  ra: { name: "Rida Ahmad",     initials: "RA", bg: "#FEF3C7", fg: "#D97706", role: "People Operations Lead",  email: "rahmad@omnesoft.com", phone: "+1 555-0214" },
  am: { name: "Abdullah Malik", initials: "AM", bg: "#EDF4FF", fg: "#0A77FF", role: "Team Member",             email: "amalik@omnesoft.com", phone: "+1 555-0100" },
};

export function getImporter(key: string | undefined): Importer {
  /* The four above are the sample company's people. A company from
   * onboarding has no import history, so anything imported there was imported
   * by the person signed in, whatever key the wizard stamped on it. */
  if (isNewTenant()) {
    return {
      name: CURRENT_USER.name,
      initials: getInitials(CURRENT_USER.name),
      bg: IMPORTERS.am.bg,
      fg: IMPORTERS.am.fg,
      role: CURRENT_USER.jobTitle,
      email: CURRENT_USER.email,
      phone: CURRENT_USER.phone,
    };
  }
  if (key && key in IMPORTERS) return IMPORTERS[key as ImporterKey];
  return IMPORTERS.am;
}
