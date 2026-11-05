// @ts-nocheck
/* ────────────────────────────────────────────────────────────────────────
   Contacts-only subset of Partner Management's partnerConstants.tsx.
   Ported here so the embedded ContactsDirectoryPage has its own contact
   dictionary without pulling in the entire vendor/partner/PR/PT/group
   universe. Keep in sync with the Partner Management source of truth.
   ──────────────────────────────────────────────────────────────────────── */

export interface ContactPhone {
  id: string;
  type: "Office" | "Mobile" | "Landline" | "Fax" | "Other";
  code: string; // e.g. "+1"
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
  // New fields
  role?: string;
  phones?: ContactPhone[];
  emails?: ContactEmail[];
  socials?: ContactSocial[];
  departments?: string[];
  companies?: string[];
  profileImage?: string;
  /** Per-location anchoring. When the contact directory is embedded in
   *  the recipients picker, the `locationId` lets the "This location
   *  only" scope pill filter rows to the SO's current location.
   *  `locations` carries the human-readable name(s) for tooltips. */
  locationId?: string;
  locations?: string[];
}

export const CONTACT_DICTIONARY: ContactPerson[] = [
  { id: "C-001", name: "Issac Archer", company: "Service-Provider", department: "Sales", phone: "(419) 548-1532", phoneExt: "", secondaryPhone: "(523) 314-3233", secondaryPhoneExt: "123", email: "issacarcher@toyota.technical.com", avatarColor: "hsl(var(--primary))" },
  { id: "C-002", name: "Braelyn Lowe", company: "Administrative and Support", department: "Supply Chain Management", phone: "(390) 412-9029", phoneExt: "", secondaryPhone: "(928) 630-9272", secondaryPhoneExt: "789", email: "braelynlowe@toyota.technical.com", avatarColor: "hsl(var(--violet))" },
  { id: "C-003", name: "Leah Wilkins", company: "Gasoline Stations", department: "Finance", phone: "(404) 296-5888", phoneExt: "", secondaryPhone: "(326) 419-3996", secondaryPhoneExt: "456", email: "leahwilkins@toyota.technical.com", avatarColor: "hsl(var(--primary))" },
  { id: "C-004", name: "Jamya House", company: "Furniture and Furnishings", department: "Sales", phone: "(277) 891-7540", phoneExt: "", secondaryPhone: "(537) 547-6401", secondaryPhoneExt: "3515", email: "mrdvt@hotmail.com", avatarColor: "hsl(var(--success))" },
  { id: "C-005", name: "Peyton Ellison", company: "Manufacturing", department: "Supply Chain Management", phone: "(578) 277-4989", phoneExt: "", secondaryPhone: "(704) 443-1841", secondaryPhoneExt: "3515", email: "bester@me.com", avatarColor: "hsl(var(--warning))" },
  { id: "C-006", name: "Jimena Morrow", company: "Real Estate", department: "Finance", phone: "(472) 605-8134", phoneExt: "", secondaryPhone: "(710) 263-0555", secondaryPhoneExt: "3515", email: "carreras@gmail.com", avatarColor: "hsl(var(--violet))" },
  { id: "C-007", name: "Jackson Mahoney", company: "Health Services", department: "Supply Chain Management", phone: "(678) 333-6085", phoneExt: "", secondaryPhone: "(858) 577-3477", secondaryPhoneExt: "3515", email: "salesgeek@hotmail.com", avatarColor: "hsl(var(--primary))" },
  { id: "C-008", name: "Kelvin Levy", company: "Health and Personal Care", department: "Sales", phone: "(632) 362-5257", phoneExt: "", secondaryPhone: "(309) 645-6861", secondaryPhoneExt: "3515", email: "sopwith@msn.com", avatarColor: "hsl(var(--success))" },
  { id: "C-009", name: "Jesse Donovan", company: "Gasoline Stations", department: "Finance", phone: "(858) 577-3477", phoneExt: "", secondaryPhone: "(566) 237-4687", secondaryPhoneExt: "3515", email: "lstaf@me.com", avatarColor: "hsl(var(--warning))" },
  { id: "C-010", name: "Sonia Bean", company: "Health Services", department: "Supply Chain Management", phone: "(372) 588-9852", phoneExt: "", secondaryPhone: "(896) 675-9493", secondaryPhoneExt: "3515", email: "mrdvt@icloud.com", avatarColor: "hsl(var(--violet))" },
  { id: "C-011", name: "Angie Webb", company: "Nonmetallic Mineral Product...", department: "Sales", phone: "(590) 887-7526", phoneExt: "", secondaryPhone: "(377) 289-4752", secondaryPhoneExt: "3515", email: "cparis@optonline.net", avatarColor: "hsl(var(--primary))" },
  { id: "C-012", name: "Jay Massey", company: "Couriers and Messengers", department: "Finance", phone: "(277) 891-7540", phoneExt: "", secondaryPhone: "(751) 496-6500", secondaryPhoneExt: "3515", email: "bryam@me.com", avatarColor: "hsl(var(--success))" },
  { id: "C-013", name: "Issac Archer", company: "Service-Providing Industries", department: "Sales", phone: "(419) 548-1532", phoneExt: "", secondaryPhone: "(523) 314-3233", secondaryPhoneExt: "3515", email: "philb@outlook.com", avatarColor: "hsl(var(--primary))" },
  { id: "C-014", name: "Braelyn Lowe", company: "Administrative and Support", department: "Supply Chain Management", phone: "(390) 412-9029", phoneExt: "", secondaryPhone: "(928) 630-9272", secondaryPhoneExt: "3515", email: "hwestiii@aol.com", avatarColor: "hsl(var(--violet))" },
  { id: "C-015", name: "Leah Wilkins", company: "Gasoline Stations", department: "Finance", phone: "(404) 296-5888", phoneExt: "", secondaryPhone: "(326) 419-3996", secondaryPhoneExt: "3515", email: "aardo@yahoo.com", avatarColor: "hsl(var(--primary))" },
  { id: "C-016", name: "Jamya House", company: "Furniture and Furnishings", department: "Sales", phone: "(277) 891-7540", phoneExt: "", secondaryPhone: "(537) 547-6401", secondaryPhoneExt: "3515", email: "mrdvt@hotmail.com", avatarColor: "hsl(var(--success))" },
  { id: "C-017", name: "Peyton Ellison", company: "Manufacturing", department: "Supply Chain Management", phone: "(578) 277-4989", phoneExt: "", secondaryPhone: "(704) 443-1841", secondaryPhoneExt: "3515", email: "bester@me.com", avatarColor: "hsl(var(--warning))" },
  { id: "C-018", name: "Jimena Morrow", company: "Real Estate", department: "Finance", phone: "(472) 605-8134", phoneExt: "", secondaryPhone: "(710) 263-0555", secondaryPhoneExt: "3515", email: "carreras@gmail.com", avatarColor: "hsl(var(--violet))" },
  { id: "C-019", name: "Jackson Mahoney", company: "Health Services", department: "Supply Chain Management", phone: "(678) 333-6085", phoneExt: "", secondaryPhone: "(858) 577-3477", secondaryPhoneExt: "3515", email: "salesgeek@hotmail.com", avatarColor: "hsl(var(--primary))" },
  { id: "C-020", name: "Kelvin Levy", company: "Health and Personal Care", department: "Sales", phone: "(632) 362-5257", phoneExt: "", secondaryPhone: "(309) 645-6861", secondaryPhoneExt: "3515", email: "sopwith@msn.com", avatarColor: "hsl(var(--success))" },
  { id: "C-021", name: "Marcus Chen", company: "Technology Services", department: "Supply Chain Management", phone: "(415) 882-3344", phoneExt: "", secondaryPhone: "(415) 882-3345", secondaryPhoneExt: "200", email: "mchen@techsvc.com", avatarColor: "hsl(var(--violet))" },
  { id: "C-022", name: "Diana Ross", company: "Logistics Corp", department: "Finance", phone: "(312) 555-0198", phoneExt: "", secondaryPhone: "(312) 555-0199", secondaryPhoneExt: "1010", email: "dross@logicorp.com", avatarColor: "hsl(var(--warning))" },
  { id: "C-023", name: "Tyler Brooks", company: "Construction Materials", department: "Sales", phone: "(602) 444-7788", phoneExt: "", secondaryPhone: "(602) 444-7789", secondaryPhoneExt: "500", email: "tbrooks@constmat.com", avatarColor: "hsl(var(--success))" },
  { id: "C-024", name: "Sofia Martinez", company: "Electronics Distribution", department: "Supply Chain Management", phone: "(713) 999-2211", phoneExt: "", secondaryPhone: "(713) 999-2212", secondaryPhoneExt: "3515", email: "smartinez@elecdist.com", avatarColor: "hsl(var(--primary))" },
];

// ── Helper: deterministic hash from string ──
function _contactHash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = s.charCodeAt(i) + ((h << 5) - h);
  return Math.abs(h);
}

// ── Pools for generated contact fields ──
const _ROLE_POOL = ["Procurement Manager", "Sales Director", "Account Executive", "Logistics Coordinator", "Operations Manager", "VP of Partnerships", "Supply Chain Lead", "Business Development", "Finance Controller", "Quality Inspector", "Project Manager", "Technical Lead"];
const _PHONE_TYPES: ContactPhone["type"][] = ["Office", "Mobile", "Landline"];
const _PHONE_CODES = ["+1", "+44", "+91", "+49"];
const _SOCIAL_TYPES: ContactSocial["type"][] = ["LinkedIn", "Twitter / X", "Website"];
const _ALL_DEPTS_GEN = ["Sales", "Supply Chain Management", "Finance", "Operations", "Procurement", "Logistics"];
const _ALL_COMPANIES_GEN = ["Toyota International", "Ford Motor Company", "Tesla, Inc.", "General Motors (GM)", "BMW Group", "Honda Motor Co.", "Rivian Automotive", "Lucid Motors", "Volvo Cars", "Hyundai Motor", "Nissan Motor", "Stellantis NV"];

function _enrichContactFields(c: ContactPerson): void {
  const h = _contactHash(c.id);

  c.role = _ROLE_POOL[h % _ROLE_POOL.length];

  const phoneCount = 1 + (h % 3);
  const phones: ContactPhone[] = [];
  phones.push({ id: `${c.id}-ph-0`, type: "Office", code: "+1", number: c.phone, ext: c.phoneExt || "" });
  for (let p = 1; p < phoneCount; p++) {
    const ph2 = (h + p * 37) % 10000;
    phones.push({
      id: `${c.id}-ph-${p}`,
      type: _PHONE_TYPES[(h + p) % _PHONE_TYPES.length],
      code: _PHONE_CODES[(h + p * 3) % _PHONE_CODES.length],
      number: `(${300 + (ph2 % 700)}) ${100 + (ph2 % 900)}-${1000 + (ph2 % 9000)}`,
      ext: p % 3 === 0 ? String(100 + (ph2 % 900)) : "",
    });
  }
  c.phones = phones;

  const emailCount = 1 + (h % 2);
  const emails: ContactEmail[] = [];
  emails.push({ id: `${c.id}-em-0`, type: "Work", address: c.email });
  if (emailCount > 1) {
    const namePart = c.name.toLowerCase().replace(/\s+/g, ".");
    emails.push({ id: `${c.id}-em-1`, type: "Personal", address: `${namePart}@gmail.com` });
  }
  c.emails = emails;

  const socialCount = h % 3;
  const socials: ContactSocial[] = [];
  const namePart = c.name.toLowerCase().replace(/\s+/g, "");
  for (let s = 0; s < socialCount; s++) {
    const sType = _SOCIAL_TYPES[(h + s * 5) % _SOCIAL_TYPES.length];
    let url = "";
    if (sType === "LinkedIn") url = `https://linkedin.com/in/${namePart}`;
    else if (sType === "Twitter / X") url = `https://x.com/${namePart}`;
    else url = `https://${namePart}.com`;
    socials.push({ id: `${c.id}-so-${s}`, type: sType, url });
  }
  c.socials = socials;

  const deptCount = 1 + (h % 2);
  const departments: string[] = [c.department];
  for (let d = 1; d < deptCount; d++) {
    const dept = _ALL_DEPTS_GEN[(h + d * 11) % _ALL_DEPTS_GEN.length];
    if (!departments.includes(dept)) departments.push(dept);
  }
  c.departments = departments;

  const compCount = 1 + (h % 2);
  const companies: string[] = [c.company];
  for (let co = 1; co < compCount; co++) {
    const comp = _ALL_COMPANIES_GEN[(h + co * 13) % _ALL_COMPANIES_GEN.length];
    if (!companies.includes(comp)) companies.push(comp);
  }
  c.companies = companies;
}

// ── Generate up to 500 contacts total so the table reads like a real directory ──
(() => {
  const firstNames = ["Alex","Jordan","Taylor","Morgan","Casey","Riley","Quinn","Blake","Drew","Avery","Cameron","Dakota","Emery","Finley","Harper","Jamie","Kai","Logan","Micah","Noel","Parker","Reese","Sage","Skyler","Toby","Val","Wren","Ash","Bay","Cleo","Darcy","Ellis","Frankie","Gray","Haven","Indie","Jules","Kit","Lane","Marley","Nico","Oakley","Peyton","Remy","Sam","Tatum","Uri","Winter","Zara","Ari","Briar","Cruz","Devin","Eden","Flynn","Greer","Hollis","Ira","Joss","Kira","Lee","Milan","Nash","Onyx","Phoenix","Rae","Shea","True","Uma","Vega","West","Xen","Yael","Zion"];
  const lastNames = ["Anderson","Baker","Clark","Davis","Edwards","Foster","Garcia","Harris","Irving","Jones","Kim","Lewis","Miller","Nelson","Owens","Patel","Quinn","Roberts","Smith","Taylor","Upton","Vargas","Williams","Xiao","Young","Zhang","Abbott","Bennett","Coleman","Dixon","Evans","Fletcher","Grant","Hayes","Ingram","Jackson","Knight","Lambert","Morrison","Nash","Ortiz","Palmer","Reed","Stevens","Tucker","Underwood","Vincent","Walsh","York","Zimmer"];
  const companies = ["Acme Corp","TechVault","NexGen Solutions","Apex Industries","Summit Group","Vertex Labs","Pioneer Systems","Atlas Logistics","Beacon Analytics","Cascade Networks","Delta Manufacturing","Echo Enterprises","Falcon Dynamics","Granite Holdings","Horizon Partners","Ionic Solutions","Jade Innovations","Keystone Global","Lumen Corp","Metro Supply"];
  const depts = ["Sales", "Supply Chain Management", "Finance"];
  const colors = ["hsl(var(--primary))", "hsl(var(--violet))", "hsl(var(--success))", "hsl(var(--warning))"];
  const existing = CONTACT_DICTIONARY.length;
  for (let i = existing; i < 500; i++) {
    const fn = firstNames[i % firstNames.length];
    const ln = lastNames[i % lastNames.length];
    const h = (i * 31 + 7) % 10000;
    CONTACT_DICTIONARY.push({
      id: `C-${String(i + 1).padStart(3, "0")}`,
      name: `${fn} ${ln}`,
      company: companies[i % companies.length],
      department: depts[i % depts.length],
      phone: `(${300 + (h % 700)}) ${100 + (h % 900)}-${1000 + (h % 9000)}`,
      phoneExt: i % 4 === 0 ? String(100 + (h % 900)) : "",
      secondaryPhone: i % 3 === 0 ? `(${400 + (h % 600)}) ${200 + (h % 800)}-${2000 + (h % 8000)}` : "",
      secondaryPhoneExt: i % 5 === 0 ? String(200 + (h % 800)) : "",
      email: `${fn.toLowerCase()}.${ln.toLowerCase()}@${companies[i % companies.length].toLowerCase().replace(/\s+/g, "")}.com`,
      avatarColor: colors[i % colors.length],
    });
  }
  CONTACT_DICTIONARY.forEach(_enrichContactFields);
})();
