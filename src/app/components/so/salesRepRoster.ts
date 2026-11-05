/* Shared sales-rep roster. Single source of truth for the SO
   creation modal (CreateSOModal) and the detail sidebar
   (SOSidebar's SalesRepPickerModal) so a rep picked during creation
   reads as already assigned in the detail sidebar.

   Previously the two surfaces kept their own roster constants and the
   "you" rep was different — CreateSOModal marked Yahya Naveed as the
   current user while SOSidebar marked Sarah Chen. After a fresh
   create the sidebar saw a name that wasn't in its roster and the
   picker had no way to render the rep as checked. */

export interface RosterRep {
  id: string;
  name: string;
  initials: string;
  /** True for the rep that represents the logged-in user. */
  isYou?: boolean;
  /** True for the rep that's the customer's default — used as the
   *  picker hint. Real product would pull this off the partner record. */
  isCustomerDefault?: boolean;
}

export const SO_SALES_REP_ROSTER: RosterRep[] = [
  { id: 'rep-yn', name: 'Yahya Naveed',    initials: 'YN', isYou: true },
  { id: 'rep-sc', name: 'Sarah Chen',      initials: 'SC' },
  { id: 'rep-mj', name: 'Mike Johnson',    initials: 'MJ' },
  { id: 'rep-ew', name: 'Emily Williams',  initials: 'EW' },
  { id: 'rep-dc', name: 'David Chen',      initials: 'DC' },
  { id: 'rep-sl', name: 'Sarah Lindquist', initials: 'SL' },
  { id: 'rep-mt', name: 'Michael Tran',    initials: 'MT' },
  { id: 'rep-er', name: 'Emily Rios',      initials: 'ER' },
  { id: 'rep-rn', name: 'Robert Navarro',  initials: 'RN' },
  { id: 'rep-ac', name: 'Amanda Chen',     initials: 'AC' },
  { id: 'rep-jm', name: 'Jessica Mbeki',   initials: 'JM' },
];

export const SO_CURRENT_USER_REP: RosterRep =
  SO_SALES_REP_ROSTER.find((r) => r.isYou) ?? SO_SALES_REP_ROSTER[0];
