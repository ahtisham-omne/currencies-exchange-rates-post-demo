/* Shared sales-rep roster. Single source of truth for the creation
   modal (Step2Configuration) and the details sidebar (RightSidebar)
   so a rep selected during creation lands on the same id in the
   detail sidebar's modal and reads as already checked.

   Previously the two surfaces kept their own roster constants and the
   ids drifted: `rep1` meant Yahya Naveed in the creation modal but
   Sarah Chen in the sidebar, so a newly-created quote's primary rep
   showed up as "Unassigned" + nothing checked in the picker. */

export interface RosterRep {
  id: string;
  name: string;
  initials: string;
  email: string;
  /** True for the rep that represents the logged-in user. The
   *  creation modal defaults the primary selection to this rep. */
  isCurrentUser?: boolean;
}

export const SALES_REP_ROSTER: RosterRep[] = [
  { id: 'rep-yn', name: 'Yahya Naveed',    initials: 'YN', email: 'yahya.naveed@pioneer.com',   isCurrentUser: true },
  { id: 'rep-sm', name: 'Sarah Mitchell',  initials: 'SM', email: 'sarah.mitchell@pioneer.com' },
  { id: 'rep-mj', name: 'Mike Johnson',    initials: 'MJ', email: 'mike.johnson@pioneer.com' },
  { id: 'rep-ew', name: 'Emily Williams',  initials: 'EW', email: 'emily.williams@pioneer.com' },
  { id: 'rep-dc', name: 'David Chen',      initials: 'DC', email: 'david.chen@pioneer.com' },
  { id: 'rep-er', name: 'Emily Rodriguez', initials: 'ER', email: 'emily.rodriguez@pioneer.com' },
];

export const CURRENT_USER_REP: RosterRep =
  SALES_REP_ROSTER.find((r) => r.isCurrentUser) ?? SALES_REP_ROSTER[0];

/** Look up a roster entry by id with a current-user fallback so
 *  callers can resolve a stored quote rep into an avatar/initials
 *  source without inventing data. */
export function findRosterRep(id?: string, name?: string): RosterRep | undefined {
  if (id) {
    const byId = SALES_REP_ROSTER.find((r) => r.id === id);
    if (byId) return byId;
  }
  if (name) {
    const byName = SALES_REP_ROSTER.find((r) => r.name.toLowerCase() === name.toLowerCase());
    if (byName) return byName;
  }
  return undefined;
}
