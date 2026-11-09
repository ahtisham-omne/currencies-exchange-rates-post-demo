// Slim partner data layer - ported from the Cash Management module's
// `data/partners/*` so the "Set up as partner" nudge inside Create GL Account
// mirrors it exactly. Intentionally lighter than a full Partners directory:
// only the fields a user can fill in seconds while creating a bank account.

export type PartnerKind = 'vendor' | 'customer'

export interface Partner {
  id: string
  /** Display name - defaults to the bank name during create. */
  name: string
  /** Always at least one. Bank-account create presets "vendor". */
  kinds: PartnerKind[]
  phone?: string
  website?: string
  address?: string
  description?: string
  groupId?: string | null
  createdAt: string
  createdBy: string
}

// The in-progress form shape used by the inline create panel.
export interface PartnerDraft {
  name: string
  kinds: PartnerKind[]
  phone: string
  website: string
  address: string
  description: string
  groupId: string | null
}

export interface NewPartnerInput {
  name: string
  kinds: PartnerKind[]
  phone?: string
  website?: string
  address?: string
  description?: string
  groupId?: string | null
}

export const emptyPartnerDraft = (name = ''): PartnerDraft => ({
  name,
  kinds: ['vendor'],
  phone: '',
  website: '',
  address: '',
  description: '',
  groupId: null,
})

// ── Partner groups ──────────────────────────────────────────────────────
export interface PartnerGroup {
  id: string
  name: string
  description: string
  country: string
  countryFlag: string
  memberCount: number
}

export const PARTNER_GROUPS: PartnerGroup[] = [
  { id: 'PG-1-1', name: 'Tier 1 Automotive OEMs', description: 'Certified original-equipment manufacturers across the automotive sector.', country: 'USA', countryFlag: '\u{1F1FA}\u{1F1F8}', memberCount: 187 },
  { id: 'PG-1-2', name: 'Seats & Interior Trim', description: 'Seat assemblies, headliners, and upholstery suppliers.', country: 'Germany', countryFlag: '\u{1F1E9}\u{1F1EA}', memberCount: 156 },
  { id: 'PG-2-1', name: 'Powertrain Components', description: 'Engine blocks, transmissions, and drivetrain part suppliers.', country: 'USA', countryFlag: '\u{1F1FA}\u{1F1F8}', memberCount: 198 },
  { id: 'PG-2-2', name: 'Body Panels & Sheet Metal', description: 'Body-in-white panels, doors, hoods, and stamped sheet-metal vendors.', country: 'UK', countryFlag: '\u{1F1EC}\u{1F1E7}', memberCount: 134 },
  { id: 'PG-3-1', name: 'Chassis & Suspension', description: 'Frames, control arms, struts, and coil-spring suppliers.', country: 'Singapore', countryFlag: '\u{1F1F8}\u{1F1EC}', memberCount: 167 },
  { id: 'PG-4-1', name: 'Nordic Countries', description: 'Suppliers across Sweden, Norway, Denmark, Finland, and Iceland.', country: 'Sweden', countryFlag: '\u{1F1F8}\u{1F1EA}', memberCount: 92 },
  { id: 'PG-4-4', name: 'DACH Region', description: 'Germany, Austria, and Switzerland industrial suppliers.', country: 'Germany', countryFlag: '\u{1F1E9}\u{1F1EA}', memberCount: 175 },
]

export const OTHER_PARTNER_GROUP_ID = 'OTHER'

export function getPartnerGroup(id: string | null | undefined): PartnerGroup | undefined {
  if (!id) return undefined
  return PARTNER_GROUPS.find(g => g.id === id)
}

// ── Seed + matching ─────────────────────────────────────────────────────
// A handful of existing partners so the linked-existing state (no duplicate)
// is demonstrable out of the box. CM ships an empty list; COA seeds a few.
export const SEED_PARTNERS: Partner[] = [
  { id: 'ptr-chase', name: 'JPMorgan Chase', kinds: ['vendor'], website: 'chase.com', groupId: OTHER_PARTNER_GROUP_ID, createdAt: '2026-01-04T09:00:00.000Z', createdBy: 'Ahtisham Ahmad (You)' },
  { id: 'ptr-amex', name: 'American Express', kinds: ['vendor'], website: 'americanexpress.com', groupId: OTHER_PARTNER_GROUP_ID, createdAt: '2026-01-04T09:00:00.000Z', createdBy: 'Ahtisham Ahmad (You)' },
]

// Case-insensitive trim match of a candidate name against the Partners list.
export function findMatchingPartner(name: string, partners: Partner[]): Partner | undefined {
  const target = name.trim().toLowerCase()
  if (!target) return undefined
  return partners.find(p => p.name.trim().toLowerCase() === target)
}
