import { workforceUserRows } from "./workforce-users";

/* ─── Types ─── */
export type UserStatus = "Active" | "Inactive" | "Invite Sent" | "Invite Expired" | "Pending Setup" | "Archived";
export type LicenseType = "Field User" | "Full Access" | "No License";

export interface UserRow {
  id: number;
  fullName: string;
  /** Role names (lowercase), DERIVED at module load by
   *  `uac-derived.syncLegacyFields()` from the canonical `USER_ROLE_IDS` map.
   *  Seeded as `[]` here on purpose; do not hand-edit, change `USER_ROLE_IDS`. */
  assignedRoles: string[];
  license: LicenseType;
  email: string;
  phone: string;
  lastLogon: string;
  status: UserStatus;
  invitedBy: string;
  invitedOn: string;
  inviteAcceptedOn: string;
  avatarUrl?: string;
  /** Who originally created this user record (manually added or sent invite).
   *  Used by Me Mode + the "Created by you" indicator. */
  createdBy?: string;
  /** Who last edited this user's profile / roles / license / permissions. */
  lastEditedBy?: string;
}

/* ─── Mock Data ─── */
export const users: UserRow[] = [
  {
    id: 1, fullName: "Ahtisham Ahmad",
    assignedRoles: [],
    license: "Full Access", email: "aahmad@omnesoft.com", lastLogon: "07/19/2025 - 13:10",
    status: "Active", invitedBy: "Andrea Davis", invitedOn: "01/16/2025", inviteAcceptedOn: "07/19/2025 - 13:10",
    phone: "+1 (218) 239-4950",
    createdBy: "Abdullah Malik",
  },
  {
    id: 2, fullName: "Faizan Khan",
    assignedRoles: [],
    license: "Full Access", email: "faizan.khan@omne.com", lastLogon: "10/28/2025 - 10:00",
    status: "Active", invitedBy: "Taylor Dimas", invitedOn: "01/23/2025", inviteAcceptedOn: "10/28/2025 - 10:05",
    phone: "+1 (235) 270-9887",
  },
  {
    id: 3, fullName: "Areeb Tanveer",
    assignedRoles: [],
    license: "Full Access", email: "shrapnull@yahoo.ca", lastLogon: "11/05/2025 - 15:10",
    status: "Active", invitedBy: "Dana Johansen", invitedOn: "02/23/2025", inviteAcceptedOn: "11/05/2025 - 15:10",
    phone: "+1 (252) 301-4824",
    createdBy: "Andrea Davis",
    lastEditedBy: "Abdullah Malik",
  },
  {
    id: 4, fullName: "Eli Rosenbloom",
    assignedRoles: [],
    license: "Full Access", email: "erosenbloom@omnesoft.com", lastLogon: "10/25/2025 - 08:20",
    status: "Active", invitedBy: "Autumn Myers", invitedOn: "02/23/2025", inviteAcceptedOn: "10/25/2025 - 08:20",
    phone: "+1 (269) 332-9761",
  },
  {
    id: 5, fullName: "Nophil Anwer",
    assignedRoles: [],
    license: "Full Access", email: "nanwer@omnesoft.com", lastLogon: "02/28/2025 - 14:00",
    status: "Active", invitedBy: "Abdullah Malik", invitedOn: "02/23/2025", inviteAcceptedOn: "02/28/2025 - 14:00",
    phone: "+1 (286) 363-4698",
  },
  {
    id: 6, fullName: "Irtaza Abid",
    assignedRoles: [],
    license: "Full Access", email: "shrapnul@live.com", lastLogon: "01/22/2025 - 07:45",
    status: "Inactive", invitedBy: "Taylor Dimas", invitedOn: "02/23/2025", inviteAcceptedOn: "01/22/2025 - 07:45",
    phone: "+1 (303) 394-9635",
  },
  {
    id: 7, fullName: "Muhammad Ghufran",
    assignedRoles: [],
    license: "Full Access", email: "vlefevre@gmail.com", lastLogon: "05/25/2025 - 09:55",
    status: "Active", invitedBy: "Dana Johansen", invitedOn: "02/23/2025", inviteAcceptedOn: "05/25/2025 - 09:55",
    phone: "+1 (320) 425-4572",
    createdBy: "Abdullah Malik", lastEditedBy: "Abdullah Malik",
  },
  {
    id: 8, fullName: "Aden Erickson",
    assignedRoles: [],
    license: "Full Access", email: "wildixon@aol.com", lastLogon: "04/25/2025 - 11:50",
    status: "Active", invitedBy: "Andrea Davis", invitedOn: "02/23/2025", inviteAcceptedOn: "04/25/2025 - 11:50",
    phone: "+1 (337) 456-9509",
    lastEditedBy: "Abdullah Malik",
  },
  {
    id: 9, fullName: "Nataly Carrillo",
    assignedRoles: [],
    license: "Full Access", email: "valdez@comcast.net", lastLogon: "-",
    status: "Invite Sent", invitedBy: "Dana Johansen", invitedOn: "02/23/2025", inviteAcceptedOn: "-",
    phone: "+1 (354) 487-4446",
  },
  {
    id: 10, fullName: "Kassandra Gillespie",
    assignedRoles: [],
    license: "Full Access", email: "sjava@mac.com", lastLogon: "06/01/2025 - 08:30",
    status: "Active", invitedBy: "Taylor Dimas", invitedOn: "02/23/2025", inviteAcceptedOn: "06/01/2025 - 08:30",
    phone: "+1 (371) 518-9383",
  },
  {
    id: 11, fullName: "Derek Vega", createdBy: "Taylor Dimas",
    assignedRoles: [],
    license: "Full Access", email: "pkilab@yahoo.com", lastLogon: "08/14/2025 - 15:00",
    status: "Active", invitedBy: "Andrea Davis", invitedOn: "02/23/2025", inviteAcceptedOn: "08/14/2025 - 15:00",
    phone: "+1 (388) 549-4320",
  },
  {
    id: 12, fullName: "Malachi Riggs",
    assignedRoles: [],
    license: "Full Access", email: "sopwith@msn.com", lastLogon: "02/18/2025 - 19:30",
    status: "Active", invitedBy: "Andrea Davis", invitedOn: "02/23/2025", inviteAcceptedOn: "02/18/2025 - 19:30",
    phone: "+1 (405) 580-9257",
  },
  {
    id: 13, fullName: "Fabian Fry",
    assignedRoles: [],
    license: "Full Access", email: "tkrotchko@verizon.net", lastLogon: "07/04/2025 - 12:50",
    status: "Active", invitedBy: "Taylor Dimas", invitedOn: "02/23/2025", inviteAcceptedOn: "07/04/2025 - 12:50",
    phone: "+1 (422) 611-4194",
  },
  {
    id: 14, fullName: "Heather Rowland",
    assignedRoles: [],
    license: "Full Access", email: "flavell@aol.com", lastLogon: "09/22/2025 - 13:00",
    status: "Active", invitedBy: "Andrea Davis", invitedOn: "02/23/2025", inviteAcceptedOn: "09/22/2025 - 13:00",
    phone: "+1 (439) 642-9131",
  },
  {
    id: 15, fullName: "Arely Kent",
    assignedRoles: [],
    license: "Full Access", email: "eidac@mac.com", lastLogon: "08/30/2025 - 14:25",
    status: "Active", invitedBy: "Autumn Myers", invitedOn: "02/23/2025", inviteAcceptedOn: "08/30/2025 - 14:25",
    phone: "+1 (456) 673-4068",
  },
  {
    id: 16, fullName: "Saniya Mcconnell",
    assignedRoles: [],
    license: "Full Access", email: "smpeters@hotmail.com", lastLogon: "07/12/2025 - 16:40",
    status: "Active", invitedBy: "Andrea Davis", invitedOn: "02/23/2025", inviteAcceptedOn: "07/12/2025 - 16:40",
    phone: "+1 (473) 704-9005",
  },
  {
    id: 17, fullName: "Brenda Robbins",
    assignedRoles: [],
    license: "Field User", email: "aardo@yahoo.com", lastLogon: "11/01/2025 - 11:45",
    status: "Active", invitedBy: "Autumn Myers", invitedOn: "02/23/2025", inviteAcceptedOn: "11/01/2025 - 11:45",
    phone: "+1 (490) 735-3942",
  },
  {
    id: 18, fullName: "Jayvon Mccall",
    assignedRoles: [],
    license: "No License", email: "gerlo@att.net", lastLogon: "04/08/2025 - 16:15",
    status: "Inactive", invitedBy: "Taylor Dimas", invitedOn: "02/23/2025", inviteAcceptedOn: "04/08/2025 - 16:15",
    phone: "+1 (507) 766-8879",
  },
  {
    id: 19, fullName: "Dawson Davila",
    assignedRoles: [],
    license: "Full Access", email: "afeldspar@me.com", lastLogon: "02/10/2025 - 19:10",
    status: "Active", invitedBy: "Andrea Davis", invitedOn: "02/23/2025", inviteAcceptedOn: "02/10/2025 - 19:10",
    phone: "+1 (524) 797-3816",
  },
  {
    id: 20, fullName: "Priya Sharma",
    assignedRoles: [],
    license: "Full Access", email: "priya.sharma@omne.com", lastLogon: "03/02/2026 - 09:15",
    status: "Active", invitedBy: "Dana Johansen", invitedOn: "03/15/2025", inviteAcceptedOn: "03/18/2025 - 10:00",
    phone: "+1 (541) 828-8753",
  },
  {
    id: 21, fullName: "Marcus Chen",
    assignedRoles: [],
    license: "Full Access", email: "mchen@omnesoft.com", lastLogon: "03/08/2026 - 14:30",
    status: "Active", invitedBy: "Taylor Dimas", invitedOn: "04/01/2025", inviteAcceptedOn: "04/03/2025 - 08:45",
    phone: "+1 (558) 859-3690",
  },
  {
    id: 22, fullName: "Lena Okafor",
    assignedRoles: [],
    license: "Full Access", email: "lena.okafor@omne.com", lastLogon: "02/28/2026 - 11:20",
    status: "Active", invitedBy: "Autumn Myers", invitedOn: "05/10/2025", inviteAcceptedOn: "05/12/2025 - 09:30",
    phone: "+1 (575) 890-8627",
  },
  {
    id: 23, fullName: "Tomás Rivera",
    assignedRoles: [],
    license: "Full Access", email: "trivera@omnesoft.com", lastLogon: "03/05/2026 - 16:00",
    status: "Active", invitedBy: "Andrea Davis", invitedOn: "04/20/2025", inviteAcceptedOn: "04/22/2025 - 14:15",
    phone: "+1 (592) 921-3564",
  },
  {
    id: 24, fullName: "Aisha Patel",
    assignedRoles: [],
    license: "Full Access", email: "apatel@omne.com", lastLogon: "01/15/2026 - 10:45",
    status: "Active", invitedBy: "Dana Johansen", invitedOn: "06/05/2025", inviteAcceptedOn: "06/08/2025 - 11:00",
    phone: "+1 (609) 952-8501",
  },
  {
    id: 25, fullName: "Jordan Blake",
    assignedRoles: [],
    license: "Field User", email: "jblake@omnesoft.com", lastLogon: "03/01/2026 - 08:50",
    status: "Active", invitedBy: "Taylor Dimas", invitedOn: "07/01/2025", inviteAcceptedOn: "07/03/2025 - 09:20",
    phone: "+1 (626) 983-3438",
  },
  {
    id: 26, fullName: "Yuki Tanaka",
    assignedRoles: [],
    license: "Full Access", email: "ytanaka@omne.com", lastLogon: "02/20/2026 - 13:30",
    status: "Active", invitedBy: "Andrea Davis", invitedOn: "07/15/2025", inviteAcceptedOn: "07/18/2025 - 10:10",
    phone: "+1 (643) 216-8375",
  },
  {
    id: 27, fullName: "Rafael Mendoza",
    assignedRoles: [],
    license: "Full Access", email: "rmendoza@omnesoft.com", lastLogon: "03/09/2026 - 07:30",
    status: "Inactive", invitedBy: "Autumn Myers", invitedOn: "08/01/2025", inviteAcceptedOn: "08/04/2025 - 08:00",
    phone: "+1 (660) 247-3312",
  },
  {
    id: 28, fullName: "Sophie Bergström",
    assignedRoles: [],
    license: "Full Access", email: "sbergstrom@omne.com", lastLogon: "03/07/2026 - 15:45",
    status: "Active", invitedBy: "Dana Johansen", invitedOn: "08/20/2025", inviteAcceptedOn: "08/22/2025 - 09:15",
    phone: "+1 (677) 278-8249",
  },
  {
    id: 29, fullName: "Kwame Asante",
    assignedRoles: [],
    license: "Full Access", email: "kasante@omnesoft.com", lastLogon: "-",
    status: "Invite Sent", invitedBy: "Taylor Dimas", invitedOn: "09/05/2025", inviteAcceptedOn: "-",
    phone: "+1 (694) 309-3186",
  },
  {
    id: 30, fullName: "Elena Volkov",
    assignedRoles: [],
    license: "Full Access", email: "evolkov@omne.com", lastLogon: "03/10/2026 - 10:20",
    status: "Active", invitedBy: "Andrea Davis", invitedOn: "09/15/2025", inviteAcceptedOn: "09/17/2025 - 11:30",
    phone: "+1 (711) 340-8123",
  },
  {
    id: 31, fullName: "Dante Morales",
    assignedRoles: [],
    license: "Full Access", email: "dmorales@omnesoft.com", lastLogon: "02/25/2026 - 14:10",
    status: "Inactive", invitedBy: "Autumn Myers", invitedOn: "10/01/2025", inviteAcceptedOn: "10/03/2025 - 08:45",
    phone: "+1 (728) 371-3060",
  },
  {
    id: 32, fullName: "Ingrid Larsen",
    assignedRoles: [],
    license: "Full Access", email: "ilarsen@omne.com", lastLogon: "03/03/2026 - 09:00",
    status: "Active", invitedBy: "Dana Johansen", invitedOn: "10/15/2025", inviteAcceptedOn: "10/18/2025 - 10:30",
    phone: "+1 (745) 402-7997",
  },
  {
    id: 33, fullName: "Tariq Hassan",
    assignedRoles: [],
    license: "Full Access", email: "thassan@omnesoft.com", lastLogon: "01/30/2026 - 17:20",
    status: "Inactive", invitedBy: "Taylor Dimas", invitedOn: "11/01/2025", inviteAcceptedOn: "11/04/2025 - 09:00",
    phone: "+1 (762) 433-2934",
  },
  {
    id: 34, fullName: "Camille Dubois",
    assignedRoles: [],
    license: "Full Access", email: "cdubois@omne.com", lastLogon: "03/06/2026 - 11:55",
    status: "Active", invitedBy: "Andrea Davis", invitedOn: "11/10/2025", inviteAcceptedOn: "11/12/2025 - 14:00",
    phone: "+1 (779) 464-7871",
  },
  {
    id: 35, fullName: "Oleg Petrov",
    assignedRoles: [],
    license: "Full Access", email: "opetrov@omnesoft.com", lastLogon: "02/18/2026 - 08:40",
    status: "Active", invitedBy: "Autumn Myers", invitedOn: "11/25/2025", inviteAcceptedOn: "11/27/2025 - 10:15",
    phone: "+1 (796) 495-2808",
  },
  {
    id: 36, fullName: "Maya Washington",
    assignedRoles: [],
    license: "Full Access", email: "mwashington@omne.com", lastLogon: "03/04/2026 - 13:30",
    status: "Active", invitedBy: "Dana Johansen", invitedOn: "12/01/2025", inviteAcceptedOn: "12/03/2025 - 09:45",
    phone: "+1 (813) 526-7745",
  },
  {
    id: 37, fullName: "Henrik Johansson",
    assignedRoles: [],
    license: "Full Access", email: "hjohansson@omnesoft.com", lastLogon: "02/22/2026 - 10:10",
    status: "Active", invitedBy: "Taylor Dimas", invitedOn: "12/15/2025", inviteAcceptedOn: "12/17/2025 - 08:30",
    phone: "+1 (830) 557-2682",
  },
  {
    id: 38, fullName: "Zara Hussain",
    assignedRoles: [],
    license: "Full Access", email: "zhussain@omne.com", lastLogon: "03/11/2026 - 09:00",
    status: "Active", invitedBy: "Andrea Davis", invitedOn: "01/05/2026", inviteAcceptedOn: "01/07/2026 - 11:20",
    phone: "+1 (847) 588-7619",
  },
  {
    id: 39, fullName: "Lucas Andersson",
    assignedRoles: [],
    license: "No License", email: "landersson@omnesoft.com", lastLogon: "02/12/2026 - 15:50",
    status: "Archived", invitedBy: "Autumn Myers", invitedOn: "01/15/2026", inviteAcceptedOn: "-",
    phone: "+1 (864) 619-2556",
  },
  {
    id: 40, fullName: "Nadia Kowalski",
    assignedRoles: [],
    license: "Full Access", email: "nkowalski@omne.com", lastLogon: "03/09/2026 - 12:15",
    status: "Active", invitedBy: "Dana Johansen", invitedOn: "01/25/2026", inviteAcceptedOn: "01/28/2026 - 09:00",
    phone: "+1 (881) 650-7493",
  },
  {
    id: 41, fullName: "Brandon Whitfield",
    assignedRoles: [],
    license: "Full Access", email: "bwhitfield@omnesoft.com", lastLogon: "-",
    status: "Pending Setup", invitedBy: "", invitedOn: "-", inviteAcceptedOn: "-",
    phone: "+1 (898) 681-2430",
    createdBy: "Andrea Davis",
  },
  {
    id: 42, fullName: "Mei-Ling Wu",
    assignedRoles: [],
    license: "Full Access", email: "mlwu@omne.com", lastLogon: "03/08/2026 - 08:20",
    status: "Active", invitedBy: "Andrea Davis", invitedOn: "02/10/2026", inviteAcceptedOn: "02/12/2026 - 09:30",
    phone: "+1 (915) 712-7367",
  },
  {
    id: 43, fullName: "Ivan Kovalenko",
    assignedRoles: [],
    license: "Field User", email: "ikovalenko@omnesoft.com", lastLogon: "-",
    status: "Pending Setup", invitedBy: "", invitedOn: "-", inviteAcceptedOn: "-",
    phone: "+1 (932) 743-2304",
    createdBy: "Taylor Dimas",
  },
  {
    id: 44, fullName: "Sienna Martinez",
    assignedRoles: [],
    license: "Full Access", email: "smartinez@omne.com", lastLogon: "03/10/2026 - 11:40",
    status: "Active", invitedBy: "Dana Johansen", invitedOn: "02/20/2026", inviteAcceptedOn: "02/22/2026 - 10:00",
    phone: "+1 (949) 774-7241",
  },
  {
    id: 45, fullName: "Oscar Nilsson",
    assignedRoles: [],
    license: "Field User", email: "onilsson@omnesoft.com", lastLogon: "03/05/2026 - 09:25",
    status: "Active", invitedBy: "Taylor Dimas", invitedOn: "02/25/2026", inviteAcceptedOn: "02/27/2026 - 11:00",
    phone: "+1 (966) 805-2178",
  },
  {
    id: 46, fullName: "Amara Osei",
    assignedRoles: [],
    license: "Full Access", email: "aosei@omne.com", lastLogon: "03/07/2026 - 13:15",
    status: "Active", invitedBy: "Andrea Davis", invitedOn: "03/01/2026", inviteAcceptedOn: "03/03/2026 - 09:45",
    phone: "+1 (983) 836-7115",
  },
  {
    id: 47, fullName: "Felix Gruber",
    assignedRoles: [],
    license: "No License", email: "fgruber@omnesoft.com", lastLogon: "-",
    status: "Pending Setup", invitedBy: "", invitedOn: "-", inviteAcceptedOn: "-",
    phone: "+1 (202) 867-2052",
    createdBy: "Dana Johansen",
  },
  {
    id: 48, fullName: "Leila Rahimi",
    assignedRoles: [],
    license: "Full Access", email: "lrahimi@omne.com", lastLogon: "03/11/2026 - 10:30",
    status: "Active", invitedBy: "Dana Johansen", invitedOn: "03/05/2026", inviteAcceptedOn: "03/07/2026 - 09:15",
    phone: "+1 (219) 898-6989",
  },
  {
    id: 49, fullName: "Connor O'Brien",
    assignedRoles: [],
    license: "Full Access", email: "cobrien@omnesoft.com", lastLogon: "-",
    status: "Invite Sent", invitedBy: "Taylor Dimas", invitedOn: "03/08/2026", inviteAcceptedOn: "-",
    phone: "+1 (236) 929-1926",
  },
  {
    id: 50, fullName: "Andrea Davis",
    assignedRoles: [],
    license: "Full Access", email: "adavis@omnesoft.com", lastLogon: "03/25/2026 - 09:00",
    status: "Active", invitedBy: "Dana Johansen", invitedOn: "12/10/2024", inviteAcceptedOn: "12/12/2024 - 08:30",
    phone: "+1 (253) 960-6863",
  },
  {
    id: 51, fullName: "Taylor Dimas",
    assignedRoles: [],
    license: "Full Access", email: "tdimas@omnesoft.com", lastLogon: "03/24/2026 - 14:20",
    status: "Active", invitedBy: "Andrea Davis", invitedOn: "01/05/2025", inviteAcceptedOn: "01/06/2025 - 10:00",
    phone: "+1 (270) 991-1800",
  },
  {
    id: 52, fullName: "Dana Johansen",
    assignedRoles: [],
    license: "Full Access", email: "djohansen@omnesoft.com", lastLogon: "03/23/2026 - 11:45",
    status: "Active", invitedBy: "Andrea Davis", invitedOn: "12/01/2024", inviteAcceptedOn: "12/03/2024 - 09:00",
    phone: "+1 (287) 224-6737",
  },
  {
    id: 53, fullName: "Autumn Myers",
    assignedRoles: [],
    license: "Full Access", email: "amyers@omnesoft.com", lastLogon: "03/22/2026 - 16:30",
    status: "Active", invitedBy: "Dana Johansen", invitedOn: "01/15/2025", inviteAcceptedOn: "01/16/2025 - 11:00",
    phone: "+1 (304) 255-1674",
  },
  /* ─── Test fixtures for inactive / no-license assignment warning modal ─── */
  {
    id: 54, fullName: "Sarah Chen",
    assignedRoles: [],
    license: "Full Access", email: "sarahchen@omnesoft.com", lastLogon: "01/10/2026 - 09:15",
    status: "Inactive", invitedBy: "Andrea Davis", invitedOn: "06/01/2025", inviteAcceptedOn: "06/03/2025 - 10:00",
    phone: "+1 (321) 286-6611",
  },
  {
    id: 55, fullName: "Miguel Torres",
    assignedRoles: [],
    license: "No License", email: "mtorres@omnesoft.com", lastLogon: "03/12/2026 - 14:22",
    status: "Active", invitedBy: "Taylor Dimas", invitedOn: "07/12/2025", inviteAcceptedOn: "07/14/2025 - 09:30",
    phone: "+1 (338) 317-1548",
  },
  {
    id: 56, fullName: "Anna Kowalski",
    assignedRoles: [],
    license: "No License", email: "akowalski@omnesoft.com", lastLogon: "12/05/2025 - 11:00",
    status: "Inactive", invitedBy: "Dana Johansen", invitedOn: "08/01/2025", inviteAcceptedOn: "08/03/2025 - 10:30",
    phone: "+1 (355) 348-6485",
  },
  /* ─── Invite Expired fixtures ─── */
  {
    id: 57, fullName: "Priya Nair",
    assignedRoles: [],
    license: "Full Access", email: "pnair@omnesoft.com", lastLogon: "-",
    status: "Invite Expired", invitedBy: "Taylor Dimas", invitedOn: "05/02/2026", inviteAcceptedOn: "-",
    phone: "+1 (372) 441-2208",
  },
  {
    id: 58, fullName: "Marcus Bennett",
    assignedRoles: [],
    license: "Field User", email: "mbennett@omnesoft.com", lastLogon: "-",
    status: "Invite Expired", invitedBy: "Dana Johansen", invitedOn: "04/18/2026", inviteAcceptedOn: "-",
    phone: "+1 (389) 552-7741",
  },
  {
    id: 59, fullName: "Sofia Russo",
    assignedRoles: [],
    license: "Full Access", email: "srusso@omnesoft.com", lastLogon: "-",
    status: "Invite Expired", invitedBy: "Andrea Davis", invitedOn: "05/10/2026", inviteAcceptedOn: "-",
    phone: "+1 (401) 663-9015",
  },
  /* ─── People operations: runs the shift schedules and the HR side of the
   *  plant roster in Calendars and Shift Management (13 Nov 2026). ─── */
  {
    id: 60, fullName: "Fatima Masood",
    assignedRoles: [],
    license: "Full Access", email: "fmasood@omnesoft.com", lastLogon: "11/13/2026 - 09:05",
    status: "Active", invitedBy: "Andrea Davis", invitedOn: "08/04/2025", inviteAcceptedOn: "08/05/2025 - 09:10",
    phone: "+1 (312) 555-0187",
    createdBy: "Andrea Davis",
  },
  /* ─── The plant workforce: 243 users across five warehouses, shared with
   *  Calendars and Shift Management. See workforce-users.ts. ─── */
  ...workforceUserRows(),
];