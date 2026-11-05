/**
 * POC Directory data — ports the canonical `CONTACT_DICTIONARY` shape from
 * the Partners app (`Partners/.../partnerConstants.tsx:1184-1440`) so the
 * PO Detail page can render the same All-POCs table users see in Partners'
 * vendor detail / Point of Contact tab.
 *
 * Differences vs. the Partners source:
 *   - Dataset is a hand-curated ~30 rows instead of the 500 generated there.
 *     A PO Detail picker doesn't need the full directory; this size keeps
 *     the modal fast and the search responsive without paging.
 *   - Enrichment is the same deterministic-hash pattern so a given contact
 *     always gets the same role / phones / emails / linked_partners /
 *     linked_entities / created_by / created_on across sessions.
 *
 * Kept in sync with Partners' field set — change one, change the other.
 */

import type { ComponentType } from "react";
import { ShoppingCart, Receipt, ClipboardList } from "lucide-react";

/* ─── Sub-types ─── */
export interface ContactPhone {
  id: string;
  type: "Office" | "Mobile" | "Landline" | "Fax" | "Other";
  code: string;
  number: string;
  ext: string;
}

export interface ContactEmail {
  id: string;
  type: "Work" | "Personal" | "Secondary" | "Other";
  address: string;
}

export interface ContactSocial {
  id: string;
  type: "LinkedIn" | "Twitter / X" | "Website" | "Skype" | "WhatsApp" | "Other";
  url: string;
}

export interface ContactPerson {
  id: string;
  name: string;
  company: string;
  department: string;
  phone: string;
  phoneExt: string;
  secondaryPhone: string;
  secondaryPhoneExt: string;
  email: string;
  avatarColor: string;
  role?: string;
  phones?: ContactPhone[];
  emails?: ContactEmail[];
  socials?: ContactSocial[];
  departments?: string[];
  companies?: string[];
  profileImage?: string;
}

export interface LinkedEntityRef {
  id: string;
  entityType: "Purchase Order" | "Sales Order" | "Quote";
  refNo: string;
  href: string;
}

/** Output of `enrichContacts` — original `ContactPerson` plus the derived
 *  fields the All POCs table needs. */
export interface EnrichedContact extends ContactPerson {
  status: "active" | "inactive";
  linkedPartners: string[];
  linkedEntities: LinkedEntityRef[];
  createdByName: string;
  createdByInitials: string;
  createdOn: string;
}

/* ─── Linked-entity type meta — same palette Partners uses on the table
 *  so the 2-letter PO/SO/QT chips read identically across both apps. ─── */
export const ENTITY_TYPE_META: Record<
  LinkedEntityRef["entityType"],
  { icon: ComponentType<{ className?: string; style?: React.CSSProperties }>; color: string; bg: string; border: string; code: string }
> = {
  "Purchase Order": { icon: ShoppingCart, color: "hsl(var(--primary))", bg: "hsl(var(--accent))", border: "#BFDBFE", code: "PO" },
  "Sales Order": { icon: Receipt, color: "hsl(var(--success))", bg: "#ECFDF5", border: "#A7F3D0", code: "SO" },
  "Quote": { icon: ClipboardList, color: "hsl(var(--violet))", bg: "#F5F3FF", border: "#DDD6FE", code: "QT" },
};
const ENTITY_TYPE_KEYS: LinkedEntityRef["entityType"][] = ["Purchase Order", "Sales Order", "Quote"];

/* ─── Curated CONTACT_DICTIONARY — subset of the 500-row Partners set with
 *  recognizable names matching what users see in the partners app. Keeping
 *  this hand-managed avoids pulling generator code into the PO Detail
 *  bundle. ─── */
const RAW: ContactPerson[] = [
  { id: "C-001", name: "Issac Archer",       company: "Service-Provider",              department: "Sales",                    phone: "(419) 548-1532", phoneExt: "",    secondaryPhone: "(523) 314-3233", secondaryPhoneExt: "123",  email: "issacarcher@toyota.technical.com",   avatarColor: "hsl(var(--primary))" },
  { id: "C-002", name: "Braelyn Lowe",       company: "Administrative and Support",    department: "Supply Chain Management",  phone: "(390) 412-9029", phoneExt: "",    secondaryPhone: "(928) 630-9272", secondaryPhoneExt: "789",  email: "braelynlowe@toyota.technical.com",  avatarColor: "hsl(var(--violet))" },
  { id: "C-003", name: "Leah Wilkins",       company: "Gasoline Stations",             department: "Finance",                  phone: "(404) 296-5888", phoneExt: "",    secondaryPhone: "(326) 419-3996", secondaryPhoneExt: "456",  email: "leahwilkins@toyota.technical.com",  avatarColor: "hsl(var(--primary))" },
  { id: "C-004", name: "Jamya House",        company: "Furniture and Furnishings",     department: "Sales",                    phone: "(277) 891-7540", phoneExt: "",    secondaryPhone: "(537) 547-6401", secondaryPhoneExt: "3515", email: "mrdvt@hotmail.com",                  avatarColor: "hsl(var(--success))" },
  { id: "C-005", name: "Peyton Ellison",     company: "Manufacturing",                 department: "Supply Chain Management",  phone: "(578) 277-4989", phoneExt: "",    secondaryPhone: "(704) 443-1841", secondaryPhoneExt: "3515", email: "bester@me.com",                       avatarColor: "hsl(var(--warning))" },
  { id: "C-006", name: "Jimena Morrow",      company: "Real Estate",                   department: "Finance",                  phone: "(472) 605-8134", phoneExt: "",    secondaryPhone: "(710) 263-0555", secondaryPhoneExt: "3515", email: "carreras@gmail.com",                  avatarColor: "hsl(var(--violet))" },
  { id: "C-007", name: "Jackson Mahoney",    company: "Health Services",               department: "Supply Chain Management",  phone: "(678) 333-6085", phoneExt: "",    secondaryPhone: "(858) 577-3477", secondaryPhoneExt: "3515", email: "salesgeek@hotmail.com",               avatarColor: "hsl(var(--primary))" },
  { id: "C-008", name: "Kelvin Levy",        company: "Health and Personal Care",      department: "Sales",                    phone: "(632) 362-5257", phoneExt: "",    secondaryPhone: "(309) 645-6861", secondaryPhoneExt: "3515", email: "sopwith@msn.com",                     avatarColor: "hsl(var(--success))" },
  { id: "C-009", name: "Jesse Donovan",      company: "Gasoline Stations",             department: "Finance",                  phone: "(858) 577-3477", phoneExt: "",    secondaryPhone: "(566) 237-4687", secondaryPhoneExt: "3515", email: "lstaf@me.com",                        avatarColor: "hsl(var(--warning))" },
  { id: "C-010", name: "Sonia Bean",         company: "Health Services",               department: "Supply Chain Management",  phone: "(372) 588-9852", phoneExt: "",    secondaryPhone: "(896) 675-9493", secondaryPhoneExt: "3515", email: "mrdvt@icloud.com",                    avatarColor: "hsl(var(--violet))" },
  { id: "C-011", name: "Angie Webb",         company: "Nonmetallic Mineral Product",   department: "Sales",                    phone: "(590) 887-7526", phoneExt: "",    secondaryPhone: "(377) 289-4752", secondaryPhoneExt: "3515", email: "cparis@optonline.net",                avatarColor: "hsl(var(--primary))" },
  { id: "C-012", name: "Jay Massey",         company: "Couriers and Messengers",       department: "Finance",                  phone: "(277) 891-7540", phoneExt: "",    secondaryPhone: "(751) 496-6500", secondaryPhoneExt: "3515", email: "bryam@me.com",                        avatarColor: "hsl(var(--success))" },
  { id: "C-013", name: "Marcus Chen",        company: "Technology Services",           department: "Supply Chain Management",  phone: "(415) 882-3344", phoneExt: "",    secondaryPhone: "(415) 882-3345", secondaryPhoneExt: "200",  email: "mchen@techsvc.com",                   avatarColor: "hsl(var(--violet))" },
  { id: "C-014", name: "Diana Ross",         company: "Logistics Corp",                department: "Finance",                  phone: "(312) 555-0198", phoneExt: "",    secondaryPhone: "(312) 555-0199", secondaryPhoneExt: "1010", email: "dross@logicorp.com",                  avatarColor: "hsl(var(--warning))" },
  { id: "C-015", name: "Tyler Brooks",       company: "Construction Materials",        department: "Sales",                    phone: "(602) 444-7788", phoneExt: "",    secondaryPhone: "(602) 444-7789", secondaryPhoneExt: "500",  email: "tbrooks@constmat.com",                avatarColor: "hsl(var(--success))" },
  { id: "C-016", name: "Sofia Martinez",     company: "Electronics Distribution",      department: "Supply Chain Management",  phone: "(713) 999-2211", phoneExt: "",    secondaryPhone: "(713) 999-2212", secondaryPhoneExt: "3515", email: "smartinez@elecdist.com",              avatarColor: "hsl(var(--primary))" },
  { id: "C-017", name: "Richard Kowalski",   company: "General Motors (GM)",           department: "Sales",                    phone: "(313) 556-5102", phoneExt: "",    secondaryPhone: "",                secondaryPhoneExt: "",     email: "r.kowalski@gm.com",                   avatarColor: "hsl(var(--primary))" },
  { id: "C-018", name: "Linda Vasquez",      company: "General Motors (GM)",           department: "Supply Chain Management",  phone: "(248) 555-1818", phoneExt: "",    secondaryPhone: "",                secondaryPhoneExt: "",     email: "linda.vasquez@gm.com",                avatarColor: "hsl(var(--violet))" },
  { id: "C-019", name: "James Rodriguez",    company: "General Motors (GM)",           department: "Supply Chain Management",  phone: "(248) 555-2727", phoneExt: "",    secondaryPhone: "",                secondaryPhoneExt: "",     email: "james.rodriguez@gm.com",              avatarColor: "hsl(var(--success))" },
  { id: "C-020", name: "Sarah Johnson",      company: "Summit Group",                  department: "Sales",                    phone: "(415) 339-2139", phoneExt: "",    secondaryPhone: "",                secondaryPhoneExt: "",     email: "sarah.johnson@company.com",           avatarColor: "hsl(var(--violet))" },
  { id: "C-021", name: "David Kim",          company: "Apex Industries",               department: "Supply Chain Management",  phone: "(312) 555-0147", phoneExt: "",    secondaryPhone: "",                secondaryPhoneExt: "",     email: "david.kim@company.com",               avatarColor: "hsl(var(--success))" },
  { id: "C-022", name: "Emily Chen",         company: "TechVault",                     department: "Finance",                  phone: "(650) 442-8891", phoneExt: "",    secondaryPhone: "",                secondaryPhoneExt: "",     email: "emily.chen@company.com",              avatarColor: "hsl(var(--warning))" },
  { id: "C-023", name: "Marcus Obi",         company: "NexGen Solutions",              department: "Sales",                    phone: "(713) 888-3456", phoneExt: "",    secondaryPhone: "",                secondaryPhoneExt: "",     email: "marcus.obi@company.com",              avatarColor: "hsl(var(--primary))" },
  { id: "C-024", name: "Elena Volkov",       company: "Summit Group",                  department: "Supply Chain Management",  phone: "(758) 358-2158", phoneExt: "",    secondaryPhone: "",                secondaryPhoneExt: "",     email: "elena.volkov@company.com",            avatarColor: "hsl(var(--violet))" },
  { id: "C-025", name: "Ahtisham Ahmad",     company: "Omnesoft",                      department: "Finance",                  phone: "(921) 522-2322", phoneExt: "",    secondaryPhone: "",                secondaryPhoneExt: "",     email: "ahtisham.ahmad@company.com",          avatarColor: "hsl(var(--primary))" },
  { id: "C-026", name: "Nathan Scott",       company: "Atlas Logistics",               department: "Sales",                    phone: "(415) 552-1100", phoneExt: "",    secondaryPhone: "",                secondaryPhoneExt: "",     email: "nathan.scott@atlaslog.com",           avatarColor: "hsl(var(--success))" },
  { id: "C-027", name: "Maria Lopez",        company: "Cascade Networks",              department: "Supply Chain Management",  phone: "(503) 992-4421", phoneExt: "",    secondaryPhone: "",                secondaryPhoneExt: "",     email: "maria.lopez@cascade.net",             avatarColor: "hsl(var(--warning))" },
  { id: "C-028", name: "Henry Kim",          company: "Pioneer Systems",               department: "Finance",                  phone: "(206) 451-9982", phoneExt: "",    secondaryPhone: "",                secondaryPhoneExt: "",     email: "henry.kim@pioneer.com",               avatarColor: "hsl(var(--violet))" },
  { id: "C-029", name: "Sophia Wilson",      company: "Beacon Analytics",              department: "Sales",                    phone: "(617) 778-2233", phoneExt: "",    secondaryPhone: "",                secondaryPhoneExt: "",     email: "sophia.wilson@beacon.io",             avatarColor: "hsl(var(--primary))" },
  { id: "C-030", name: "Ryan Smith",         company: "Vertex Labs",                   department: "Supply Chain Management",  phone: "(415) 888-6671", phoneExt: "",    secondaryPhone: "",                secondaryPhoneExt: "",     email: "ryan.smith@vertex.dev",               avatarColor: "hsl(var(--success))" },
];

/* ─── Deterministic hash (Partners parity) ─── */
function contactHash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = s.charCodeAt(i) + ((h << 5) - h);
  return Math.abs(h);
}

const ROLE_POOL = [
  "Procurement Manager",
  "Sales Director",
  "Account Executive",
  "Logistics Coordinator",
  "Operations Manager",
  "VP of Partnerships",
  "Supply Chain Lead",
  "Business Development",
  "Finance Controller",
  "Quality Inspector",
  "Project Manager",
  "Technical Lead",
];
const PHONE_TYPES: ContactPhone["type"][] = ["Office", "Mobile", "Landline"];
const PHONE_CODES = ["+1", "+44", "+91", "+49"];
const EMAIL_TYPES: ContactEmail["type"][] = ["Work", "Personal"];
const SOCIAL_TYPES: ContactSocial["type"][] = ["LinkedIn", "Twitter / X", "Website"];
const DEPTS_GEN = ["Sales", "Supply Chain Management", "Finance", "Operations", "Procurement", "Logistics"];
const COMPANIES_GEN = [
  "Toyota International",
  "Ford Motor Company",
  "Tesla, Inc.",
  "General Motors (GM)",
  "BMW Group",
  "Honda Motor Co.",
  "Rivian Automotive",
  "Lucid Motors",
  "Volvo Cars",
  "Hyundai Motor",
  "Nissan Motor",
  "Stellantis NV",
];

function enrichContactFields(c: ContactPerson): ContactPerson {
  const h = contactHash(c.id);
  const role = ROLE_POOL[h % ROLE_POOL.length];
  const phoneCount = 1 + (h % 3);
  const phones: ContactPhone[] = [
    { id: `${c.id}-ph-0`, type: "Office", code: "+1", number: c.phone, ext: c.phoneExt || "" },
  ];
  for (let p = 1; p < phoneCount; p++) {
    const ph2 = (h + p * 37) % 10000;
    phones.push({
      id: `${c.id}-ph-${p}`,
      type: PHONE_TYPES[(h + p) % PHONE_TYPES.length],
      code: PHONE_CODES[(h + p * 3) % PHONE_CODES.length],
      number: `(${300 + (ph2 % 700)}) ${100 + (ph2 % 900)}-${1000 + (ph2 % 9000)}`,
      ext: p % 3 === 0 ? String(100 + (ph2 % 900)) : "",
    });
  }
  const emailCount = 1 + (h % 2);
  const emails: ContactEmail[] = [{ id: `${c.id}-em-0`, type: "Work", address: c.email }];
  if (emailCount > 1) {
    const namePart = c.name.toLowerCase().replace(/\s+/g, ".");
    emails.push({ id: `${c.id}-em-1`, type: "Personal", address: `${namePart}@gmail.com` });
  }
  const socialCount = h % 3;
  const socials: ContactSocial[] = [];
  const handle = c.name.toLowerCase().replace(/\s+/g, "");
  for (let s = 0; s < socialCount; s++) {
    const sType = SOCIAL_TYPES[(h + s * 5) % SOCIAL_TYPES.length];
    let url = "";
    if (sType === "LinkedIn") url = `https://linkedin.com/in/${handle}`;
    else if (sType === "Twitter / X") url = `https://x.com/${handle}`;
    else url = `https://${handle}.com`;
    socials.push({ id: `${c.id}-so-${s}`, type: sType, url });
  }
  const deptCount = 1 + (h % 2);
  const departments: string[] = [c.department];
  for (let d = 1; d < deptCount; d++) {
    const dept = DEPTS_GEN[(h + d * 11) % DEPTS_GEN.length];
    if (!departments.includes(dept)) departments.push(dept);
  }
  const compCount = 1 + (h % 2);
  const companies: string[] = [c.company];
  for (let co = 1; co < compCount; co++) {
    const comp = COMPANIES_GEN[(h + co * 13) % COMPANIES_GEN.length];
    if (!companies.includes(comp)) companies.push(comp);
  }
  return { ...c, role, phones, emails, socials, departments, companies };
}

export const CONTACT_DICTIONARY: ContactPerson[] = RAW.map(enrichContactFields);

/* ─── Partner-name pool used for the linked_partners column ─── */
const PARTNER_NAMES = [
  "Acme Corp",
  "TechVault",
  "NexGen Solutions",
  "Apex Industries",
  "Summit Group",
  "Vertex Labs",
  "Pioneer Systems",
  "Atlas Logistics",
  "Beacon Analytics",
  "Cascade Networks",
  "Delta Manufacturing",
  "Echo Enterprises",
  "Falcon Dynamics",
  "Granite Holdings",
  "Horizon Partners",
];

const ENTITY_MODULE_URLS: Record<LinkedEntityRef["entityType"], string> = {
  "Purchase Order": "/purchase-orders",
  "Sales Order": "/sales-orders",
  "Quote": "/quotes",
};

const CREATORS = ["Ahtisham Ahmad", "Sarah Johnson", "David Kim", "Emily Chen", "Marcus Obi", "Elena Volkov"];

/** Enrich contacts with status / linked partners / linked entities /
 *  created_by / created_on — same deterministic-hash pattern Partners uses
 *  so a given POC always gets the same derived fields across reloads. */
export function enrichContacts(contacts: ContactPerson[]): EnrichedContact[] {
  return contacts.map((c) => {
    const h = contactHash(c.id);
    const status: "active" | "inactive" = h % 5 === 0 ? "inactive" : "active";

    const partnerCount = 1 + (h % 5);
    const linkedPartners: string[] = [];
    for (let p = 0; p < partnerCount; p++) {
      linkedPartners.push(PARTNER_NAMES[(h + p * 7) % PARTNER_NAMES.length]);
    }

    const entityCount = h % 7;
    const linkedEntities: LinkedEntityRef[] = [];
    for (let e = 0; e < entityCount; e++) {
      const type = ENTITY_TYPE_KEYS[(h + e * 3) % 3];
      const prefix = type === "Purchase Order" ? "PO" : type === "Sales Order" ? "SO" : "QT";
      const num = 1000 + ((h + e * 17) % 9000);
      linkedEntities.push({
        id: `${c.id}-ent-${e}`,
        entityType: type,
        refNo: `${prefix}-${num}`,
        href: ENTITY_MODULE_URLS[type],
      });
    }

    const createdByName = CREATORS[h % CREATORS.length];
    const createdByInitials = createdByName
      .split(" ")
      .map((w) => w[0])
      .join("")
      .toUpperCase();

    const month = (h % 12) + 1;
    const day = (h % 28) + 1;
    const year = h % 3 === 0 ? 2025 : 2026;
    const createdOn = new Date(year, month - 1, day).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });

    return {
      ...c,
      status,
      linkedPartners,
      linkedEntities,
      createdByName,
      createdByInitials,
      createdOn,
    };
  });
}

/* Department pill palette — same colour ladder Partners uses on the table. */
export const DEPT_STYLES: Record<string, { bg: string; text: string; border: string }> = {
  Sales: { bg: "#EFF6FF", text: "#1E40AF", border: "#BFDBFE" },
  "Supply Chain Management": { bg: "#F0FDF4", text: "#166534", border: "#BBF7D0" },
  Finance: { bg: "#F5F3FF", text: "#5B21B6", border: "#DDD6FE" },
  Operations: { bg: "#FFFBEB", text: "#92400E", border: "#FDE68A" },
  Procurement: { bg: "#FDF4FF", text: "#86198F", border: "#F5D0FE" },
  Logistics: { bg: "#ECFEFF", text: "#155E75", border: "#A5F3FC" },
};

/** Short dept label used in the table (matches Partners' `shortDept`). */
export function shortDept(d: string): string {
  return d === "Supply Chain Management" ? "Supply Chain" : d;
}

/** Initials helper — used by the contact-name cell + created-by cell. */
export function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}
