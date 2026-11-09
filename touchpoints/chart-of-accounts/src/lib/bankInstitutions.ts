// Bank institution catalogue - ported verbatim from the Cash Management module
// (`src/app/data/cash-management/bankInstitutions.ts`) so both modules share one
// source of truth for banking. Do not fork this list per-module; extend it here.
export interface BankInstitution {
  id: string
  name: string
  shortName: string
  initials: string
  primaryColor: string
  isPopular: boolean
  /** Primary public domain - used to look up a logo via the Clearbit Logo API. */
  domain?: string
}

export const BANK_INSTITUTIONS: BankInstitution[] = [
  { id: 'chase', name: 'JPMorgan Chase', shortName: 'Chase', initials: 'JP', primaryColor: '#117ACA', isPopular: true, domain: 'chase.com' },
  { id: 'bofa', name: 'Bank of America', shortName: 'Bank of America', initials: 'BA', primaryColor: '#E31837', isPopular: true, domain: 'bankofamerica.com' },
  { id: 'wells-fargo', name: 'Wells Fargo', shortName: 'Wells Fargo', initials: 'WF', primaryColor: '#D71E28', isPopular: true, domain: 'wellsfargo.com' },
  { id: 'citi', name: 'Citibank', shortName: 'Citi', initials: 'CI', primaryColor: '#003B70', isPopular: true, domain: 'citi.com' },
  { id: 'capital-one', name: 'Capital One', shortName: 'Capital One', initials: 'CO', primaryColor: '#004977', isPopular: true },
  { id: 'us-bank', name: 'U.S. Bank', shortName: 'US Bank', initials: 'US', primaryColor: '#0E4D8F', isPopular: true, domain: 'usbank.com' },
  { id: 'pnc', name: 'PNC Bank', shortName: 'PNC', initials: 'PN', primaryColor: '#F58025', isPopular: true, domain: 'pnc.com' },
  { id: 'truist', name: 'Truist Bank', shortName: 'Truist', initials: 'TR', primaryColor: '#52247F', isPopular: true, domain: 'truist.com' },
  { id: 'amex', name: 'American Express', shortName: 'Amex', initials: 'AX', primaryColor: '#006FCF', isPopular: true, domain: 'americanexpress.com' },
  { id: 'discover', name: 'Discover Bank', shortName: 'Discover', initials: 'DS', primaryColor: '#FF6000', isPopular: true, domain: 'discover.com' },
  { id: 'ally', name: 'Ally Bank', shortName: 'Ally', initials: 'AL', primaryColor: '#6C2EB9', isPopular: false, domain: 'ally.com' },
  { id: 'td-bank', name: 'TD Bank', shortName: 'TD Bank', initials: 'TD', primaryColor: '#54B948', isPopular: false, domain: 'td.com' },
  { id: 'regions', name: 'Regions Bank', shortName: 'Regions', initials: 'RE', primaryColor: '#52BE7E', isPopular: false, domain: 'regions.com' },
  { id: 'fifth-third', name: 'Fifth Third Bank', shortName: 'Fifth Third', initials: 'FT', primaryColor: '#005EB8', isPopular: false, domain: '53.com' },
  { id: 'keybank', name: 'KeyBank', shortName: 'KeyBank', initials: 'KB', primaryColor: '#C8102E', isPopular: false, domain: 'key.com' },
  { id: 'huntington', name: 'Huntington National Bank', shortName: 'Huntington', initials: 'HU', primaryColor: '#00643E', isPopular: false, domain: 'huntington.com' },
  { id: 'citizens', name: 'Citizens Bank', shortName: 'Citizens', initials: 'CZ', primaryColor: '#1B5E20', isPopular: false, domain: 'citizensbank.com' },
  { id: 'm-t', name: 'M and T Bank', shortName: 'M and T', initials: 'MT', primaryColor: '#005393', isPopular: false, domain: 'mtb.com' },
  { id: 'first-republic', name: 'First Republic Bank', shortName: 'First Republic', initials: 'FR', primaryColor: '#202C40', isPopular: false, domain: 'firstrepublic.com' },
  { id: 'silicon-valley', name: 'Silicon Valley Bank', shortName: 'SVB', initials: 'SV', primaryColor: '#1F4E79', isPopular: false, domain: 'svb.com' },
  { id: 'mercury', name: 'Mercury', shortName: 'Mercury', initials: 'MR', primaryColor: '#1A1A1A', isPopular: false, domain: 'mercury.com' },
  { id: 'brex', name: 'Brex', shortName: 'Brex', initials: 'BX', primaryColor: '#F25C1F', isPopular: false, domain: 'brex.com' },
  { id: 'ramp', name: 'Ramp', shortName: 'Ramp', initials: 'RP', primaryColor: '#FFCC00', isPopular: false, domain: 'ramp.com' },
  { id: 'navy-federal', name: 'Navy Federal Credit Union', shortName: 'Navy Federal', initials: 'NF', primaryColor: '#003366', isPopular: false, domain: 'navyfederal.org' },
  { id: 'alliant', name: 'Alliant Credit Union', shortName: 'Alliant', initials: 'AC', primaryColor: '#0066B3', isPopular: false, domain: 'alliantcreditunion.org' },
  { id: 'penfed', name: 'PenFed Credit Union', shortName: 'PenFed', initials: 'PF', primaryColor: '#003E7E', isPopular: false, domain: 'penfed.org' },
  { id: 'chime', name: 'Chime', shortName: 'Chime', initials: 'CH', primaryColor: '#00C2A2', isPopular: false, domain: 'chime.com' },
  { id: 'sofi', name: 'SoFi Bank', shortName: 'SoFi', initials: 'SF', primaryColor: '#00A6B5', isPopular: false, domain: 'sofi.com' },
  { id: 'varo', name: 'Varo Bank', shortName: 'Varo', initials: 'VA', primaryColor: '#003595', isPopular: false, domain: 'varomoney.com' },
  { id: 'current', name: 'Current', shortName: 'Current', initials: 'CU', primaryColor: '#000000', isPopular: false, domain: 'current.com' },
  { id: 'bok-financial', name: 'BOK Financial', shortName: 'BOK', initials: 'BK', primaryColor: '#001E62', isPopular: false, domain: 'bokf.com' },
  { id: 'comerica', name: 'Comerica Bank', shortName: 'Comerica', initials: 'CM', primaryColor: '#0073AE', isPopular: false, domain: 'comerica.com' },
  { id: 'first-horizon', name: 'First Horizon Bank', shortName: 'First Horizon', initials: 'FH', primaryColor: '#00355F', isPopular: false, domain: 'firsthorizon.com' },
  { id: 'synovus', name: 'Synovus Bank', shortName: 'Synovus', initials: 'SY', primaryColor: '#003E7E', isPopular: false, domain: 'synovus.com' },
  { id: 'valley-national', name: 'Valley National Bank', shortName: 'Valley National', initials: 'VN', primaryColor: '#003366', isPopular: false, domain: 'valley.com' },
  { id: 'webster', name: 'Webster Bank', shortName: 'Webster', initials: 'WB', primaryColor: '#005CAB', isPopular: false, domain: 'websterbank.com' },
  { id: 'zions', name: 'Zions Bank', shortName: 'Zions', initials: 'ZN', primaryColor: '#004787', isPopular: false, domain: 'zionsbank.com' },
  { id: 'santander', name: 'Santander Bank N.A.', shortName: 'Santander', initials: 'SA', primaryColor: '#EC0000', isPopular: false, domain: 'santander.com' },
  { id: 'hsbc-usa', name: 'HSBC Bank USA', shortName: 'HSBC', initials: 'HS', primaryColor: '#DB0011', isPopular: false, domain: 'us.hsbc.com' },
  { id: 'bmo', name: 'BMO Harris Bank', shortName: 'BMO Harris', initials: 'BM', primaryColor: '#0079C1', isPopular: false, domain: 'bmo.com' },
  { id: 'frost', name: 'Frost Bank', shortName: 'Frost', initials: 'FB', primaryColor: '#003E7E', isPopular: false, domain: 'frostbank.com' },
  { id: 'first-citizens', name: 'First Citizens Bank', shortName: 'First Citizens', initials: 'FC', primaryColor: '#00425A', isPopular: false, domain: 'firstcitizens.com' },
  { id: 'associated', name: 'Associated Bank', shortName: 'Associated', initials: 'AB', primaryColor: '#00563F', isPopular: false, domain: 'associatedbank.com' },
  { id: 'east-west', name: 'East West Bank', shortName: 'East West', initials: 'EW', primaryColor: '#003366', isPopular: false, domain: 'eastwestbank.com' },
  { id: 'city-national', name: 'City National Bank', shortName: 'City National', initials: 'CN', primaryColor: '#9E1B32', isPopular: false, domain: 'cnb.com' },
  { id: 'western-alliance', name: 'Western Alliance Bank', shortName: 'Western Alliance', initials: 'WA', primaryColor: '#1B365D', isPopular: false, domain: 'westernalliancebancorporation.com' },
  { id: 'axos', name: 'Axos Bank', shortName: 'Axos', initials: 'AX', primaryColor: '#003E7E', isPopular: false, domain: 'axosbank.com' },
  { id: 'live-oak', name: 'Live Oak Bank', shortName: 'Live Oak', initials: 'LO', primaryColor: '#62A744', isPopular: false, domain: 'liveoakbank.com' },
  { id: 'pacwest', name: 'PacWest Bancorp', shortName: 'PacWest', initials: 'PW', primaryColor: '#003E7E', isPopular: false, domain: 'pacwest.com' },
  { id: 'signature', name: 'Signature Bank', shortName: 'Signature', initials: 'SG', primaryColor: '#000000', isPopular: false, domain: 'signatureny.com' },

  /* ── Credit unions ────────────────────────────────────────────────── */
  { id: 'becu', name: 'Boeing Employees Credit Union', shortName: 'BECU', initials: 'BE', primaryColor: '#005CB9', isPopular: false, domain: 'becu.org' },
  { id: 'secu-nc', name: 'State Employees Credit Union', shortName: 'SECU', initials: 'SE', primaryColor: '#003366', isPopular: false, domain: 'ncsecu.org' },
  { id: 'schoolsfirst', name: 'SchoolsFirst Federal Credit Union', shortName: 'SchoolsFirst', initials: 'SF', primaryColor: '#A6192E', isPopular: false, domain: 'schoolsfirstfcu.org' },
  { id: 'suncoast-cu', name: 'Suncoast Credit Union', shortName: 'Suncoast', initials: 'SU', primaryColor: '#F18A00', isPopular: false, domain: 'suncoastcreditunion.com' },
  { id: 'america-first-cu', name: 'America First Credit Union', shortName: 'America First', initials: 'AF', primaryColor: '#C8102E', isPopular: false, domain: 'americafirst.com' },

  /* ── Fintech / neobanks ───────────────────────────────────────────── */
  { id: 'wise', name: 'Wise', shortName: 'Wise', initials: 'WI', primaryColor: '#9FE870', isPopular: false, domain: 'wise.com' },
  { id: 'bluevine', name: 'Bluevine', shortName: 'Bluevine', initials: 'BV', primaryColor: '#005EFF', isPopular: false, domain: 'bluevine.com' },
  { id: 'relay', name: 'Relay', shortName: 'Relay', initials: 'RL', primaryColor: '#2E2E2E', isPopular: false, domain: 'relayfi.com' },
  { id: 'novo', name: 'Novo', shortName: 'Novo', initials: 'NV', primaryColor: '#000000', isPopular: false, domain: 'novo.co' },
  { id: 'lili', name: 'Lili', shortName: 'Lili', initials: 'LI', primaryColor: '#FF6B6B', isPopular: false, domain: 'lili.co' },
  { id: 'found', name: 'Found', shortName: 'Found', initials: 'FN', primaryColor: '#1B1F3B', isPopular: false, domain: 'found.com' },
  { id: 'revolut-us', name: 'Revolut', shortName: 'Revolut', initials: 'RV', primaryColor: '#0075EB', isPopular: false, domain: 'revolut.com' },
  { id: 'n26', name: 'N26', shortName: 'N26', initials: 'N2', primaryColor: '#36A18B', isPopular: false, domain: 'n26.com' },
  { id: 'monzo', name: 'Monzo', shortName: 'Monzo', initials: 'MZ', primaryColor: '#FF4F40', isPopular: false, domain: 'monzo.com' },
  { id: 'starling', name: 'Starling Bank', shortName: 'Starling', initials: 'ST', primaryColor: '#7935C1', isPopular: false, domain: 'starlingbank.com' },
  { id: 'nubank', name: 'Nubank', shortName: 'Nubank', initials: 'NU', primaryColor: '#820AD1', isPopular: false, domain: 'nubank.com.br' },

  /* ── UK ───────────────────────────────────────────────────────────── */
  { id: 'hsbc-uk', name: 'HSBC UK', shortName: 'HSBC UK', initials: 'HU', primaryColor: '#DB0011', isPopular: false, domain: 'hsbc.co.uk' },
  { id: 'barclays', name: 'Barclays', shortName: 'Barclays', initials: 'BC', primaryColor: '#00AEEF', isPopular: false, domain: 'barclays.co.uk' },
  { id: 'lloyds', name: 'Lloyds Bank', shortName: 'Lloyds', initials: 'LL', primaryColor: '#024731', isPopular: false, domain: 'lloydsbank.com' },
  { id: 'natwest', name: 'NatWest', shortName: 'NatWest', initials: 'NW', primaryColor: '#5A287D', isPopular: false, domain: 'natwest.com' },
  { id: 'standard-chartered', name: 'Standard Chartered', shortName: 'StanChart', initials: 'SC', primaryColor: '#0473EA', isPopular: false, domain: 'sc.com' },

  /* ── Canada ───────────────────────────────────────────────────────── */
  { id: 'rbc', name: 'Royal Bank of Canada', shortName: 'RBC', initials: 'RC', primaryColor: '#005DAA', isPopular: false, domain: 'rbc.com' },
  { id: 'td-canada', name: 'TD Canada Trust', shortName: 'TD Canada', initials: 'TC', primaryColor: '#54B948', isPopular: false, domain: 'td.com' },
  { id: 'scotiabank', name: 'Scotiabank', shortName: 'Scotia', initials: 'SB', primaryColor: '#EC111A', isPopular: false, domain: 'scotiabank.com' },
  { id: 'cibc', name: 'CIBC', shortName: 'CIBC', initials: 'CB', primaryColor: '#BE2D2F', isPopular: false, domain: 'cibc.com' },

  /* ── Europe ───────────────────────────────────────────────────────── */
  { id: 'deutsche', name: 'Deutsche Bank', shortName: 'Deutsche', initials: 'DB', primaryColor: '#0018A8', isPopular: false, domain: 'db.com' },
  { id: 'commerzbank', name: 'Commerzbank', shortName: 'Commerzbank', initials: 'CZ', primaryColor: '#FFCC00', isPopular: false, domain: 'commerzbank.com' },
  { id: 'ing', name: 'ING', shortName: 'ING', initials: 'IN', primaryColor: '#FF6200', isPopular: false, domain: 'ing.com' },
  { id: 'bnp-paribas', name: 'BNP Paribas', shortName: 'BNP Paribas', initials: 'BP', primaryColor: '#00915A', isPopular: false, domain: 'bnpparibas.com' },
  { id: 'societe-generale', name: 'Société Générale', shortName: 'SocGen', initials: 'SG', primaryColor: '#E60028', isPopular: false, domain: 'societegenerale.com' },
  { id: 'santander-es', name: 'Banco Santander', shortName: 'Santander ES', initials: 'SE', primaryColor: '#EC0000', isPopular: false, domain: 'santander.com' },
  { id: 'bbva', name: 'BBVA', shortName: 'BBVA', initials: 'BB', primaryColor: '#004481', isPopular: false, domain: 'bbva.com' },
  { id: 'nordea', name: 'Nordea', shortName: 'Nordea', initials: 'ND', primaryColor: '#0000A0', isPopular: false, domain: 'nordea.com' },

  /* ── Asia-Pacific ─────────────────────────────────────────────────── */
  { id: 'dbs', name: 'DBS Bank', shortName: 'DBS', initials: 'DS', primaryColor: '#ED1A3D', isPopular: false, domain: 'dbs.com' },
  { id: 'ocbc', name: 'OCBC Bank', shortName: 'OCBC', initials: 'OC', primaryColor: '#E60039', isPopular: false, domain: 'ocbc.com' },
  { id: 'uob', name: 'UOB', shortName: 'UOB', initials: 'UO', primaryColor: '#005AA0', isPopular: false, domain: 'uob.com.sg' },
  { id: 'anz', name: 'ANZ Bank', shortName: 'ANZ', initials: 'AN', primaryColor: '#005EB8', isPopular: false, domain: 'anz.com' },
  { id: 'commbank', name: 'Commonwealth Bank', shortName: 'CommBank', initials: 'CK', primaryColor: '#FFCC00', isPopular: false, domain: 'commbank.com.au' },
  { id: 'nab', name: 'National Australia Bank', shortName: 'NAB', initials: 'NB', primaryColor: '#E50000', isPopular: false, domain: 'nab.com.au' },
  { id: 'westpac', name: 'Westpac', shortName: 'Westpac', initials: 'WP', primaryColor: '#D5002B', isPopular: false, domain: 'westpac.com.au' },
]

export function searchInstitutions(query: string): BankInstitution[] {
  if (!query.trim()) return BANK_INSTITUTIONS
  const q = query.toLowerCase()
  return BANK_INSTITUTIONS.filter(
    b => b.name.toLowerCase().includes(q) || b.shortName.toLowerCase().includes(q),
  )
}

export function getPopularInstitutions(): BankInstitution[] {
  return BANK_INSTITUTIONS.filter(b => b.isPopular)
}

export function getInstitution(id: string): BankInstitution | undefined {
  return BANK_INSTITUTIONS.find(b => b.id === id)
}

// Ordered list of logo URLs to try for a given domain: Clearbit (real brand
// logo) first, then Google favicon as a fallback. Empty array = no domain, so
// consumers render the initials/monogram tile.
export function getBankLogoUrls(domain: string | undefined): string[] {
  if (!domain) return []
  const encoded = encodeURIComponent(domain)
  return [
    `https://logo.clearbit.com/${encoded}?size=128`,
    `https://www.google.com/s2/favicons?domain=${encoded}&sz=128`,
  ]
}

export function getBankLogoUrl(domain: string | undefined): string | null {
  return getBankLogoUrls(domain)[0] ?? null
}

// Resolve an institution by display name (exact/canonical first, then a
// substring fallback). Used when only bankName is known, not the id.
export function getInstitutionByName(bankName: string): BankInstitution | undefined {
  if (!bankName) return undefined
  const normalized = bankName.toLowerCase()
  for (const b of BANK_INSTITUTIONS) {
    if (b.name.toLowerCase() === normalized) return b
    if (b.shortName.toLowerCase() === normalized) return b
  }
  for (const b of BANK_INSTITUTIONS) {
    if (normalized.includes(b.shortName.toLowerCase()) || b.name.toLowerCase().includes(normalized)) {
      return b
    }
  }
  return undefined
}

export function getBankDomainByName(bankName: string): string | undefined {
  return getInstitutionByName(bankName)?.domain
}

export function getBankPrimaryColorByName(bankName: string): string {
  return getInstitutionByName(bankName)?.primaryColor ?? '#0A77FF'
}
