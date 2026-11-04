Filter Button Flow — End to End
1. The Button (PartnersDataTable.tsx, line 611)
The button you selected lives inside PartnersDataTable. It receives two props:

activeFilterCount — number of active filters (drives the blue badge)
onOpenFilters — callback that opens the modal
// PartnersDataTable.tsx props interface (line 234-236)
activeFilterCount: number;
onOpenFilters: () => void;
2. Wiring in VendorsListPage.tsx (the parent)
The parent page owns all filter state and passes it down:

// VendorsListPage.tsx line 78-79
const [advFilters, setAdvFilters] = useState<AdvancedFilters>({ ...DEFAULT_FILTERS });
const [filtersOpen, setFiltersOpen] = useState(false);

// Line 205 — count is derived from state
const activeFilterCount = useMemo(() => countActiveFilters(advFilters), [advFilters]);

// Line 716 — passed to PartnersDataTable
onOpenFilters={() => setFiltersOpen(true)}
3. The FiltersModal Component (FiltersModal.tsx — 790 lines)
Rendered in VendorsListPage.tsx at line 755:

<FiltersModal
  open={filtersOpen}
  onOpenChange={setFiltersOpen}
  filters={advFilters}
  onFiltersChange={(f) => { setAdvFilters(f); setCurrentPage(1); }}
  vendors={vendors}
  filteredCount={filteredVendors.length}
/>
The modal is a Radix Dialog with these sections:

Section	Filter Type	Component Used	Fields in AdvancedFilters
Partner Type	Segmented control (Any/Vendor/Customer)	SegmentedControl	partnerTypes: string[]
Status	Pill chips (Any/Active/Inactive/Archived)	Pill	statuses: string[]
Vendor Type	Pill chips with "Show more"	PillSection	vendorTypes: string[]
Partner Group	Searchable multi-select	SearchableMultiSelect	partnerGroups: string[]
Country	Searchable multi-select with flags	SearchableMultiSelect	countries: string[]
Services	Searchable multi-select	SearchableMultiSelect	services: string[]
Created By	Searchable multi-select	SearchableMultiSelect	createdBy: string[]
Net Margin	Min/Max numeric inputs	RangeHistogram	netProfitMin/Max: string
Credit Limit	Min/Max numeric inputs	RangeHistogram	creditLimitMin/Max: string
Credit Utilization	Min/Max numeric inputs	RangeHistogram	creditUtilMin/Max: string
Contact Info	Text inputs (email & website)	Native <input>	email, website: string
Created On	Date range (from/to)	Native <input type="date">	createdFrom/To: string
4. The AdvancedFilters Type & Defaults (FiltersModal.tsx lines 13-51)
export interface AdvancedFilters {
  partnerTypes: string[];    vendorTypes: string[];
  statuses: string[];        partnerGroups: string[];
  services: string[];        countries: string[];
  createdBy: string[];       netProfitMin: string;
  netProfitMax: string;      creditLimitMin: string;
  creditLimitMax: string;    creditUtilMin: string;
  creditUtilMax: string;     email: string;
  website: string;           createdFrom: string;
  createdTo: string;
}

// All empty by default
export const DEFAULT_FILTERS: AdvancedFilters = {
  partnerTypes: [], vendorTypes: [], statuses: [], ...
};
5. Count Logic (FiltersModal.tsx lines 53-69)
Each filter category counts as 1 regardless of how many values are selected:

export function countActiveFilters(f: AdvancedFilters): number {
  let count = 0;
  if (f.partnerTypes.length > 0) count++;
  if (f.vendorTypes.length > 0) count++;
  if (f.statuses.length > 0) count++;
  // ... 10 more checks
  return count;
}
6. Filtering Logic (VendorsListPage.tsx lines 310-436)
All filters are applied inside a single useMemo. The flow is:

Text search — matches against companyName, displayName, code, contact name, city, country, email
Quick filter (pill bar above table) — filters by partner type or status
Advanced filters (from this modal) — applied sequentially:
Multi-select arrays: partnerTypes, vendorTypes, statuses, partnerGroups, services, countries, createdBy
Numeric ranges: netProfitMin/Max, creditLimitMin/Max, creditUtilMin/Max
Text contains: email, website
Date range: createdFrom, createdTo
Column filters (Notion-style per-column) — applied via applyColumnFilters()
Sorting — applied last
7. Sub-components Inside FiltersModal
Pill — Toggle chip with optional count badge. Blue bg (#EDF4FF) when selected.
SegmentedControl — Connected button row with "Any" + options. Multi-select.
PillSection — Wraps Pill chips with a "Show all N" / "Show less" toggle (threshold default: 8).
SearchableMultiSelect — Search input + pill results. When idle: shows selected + top 6 by count + "+N more" hint. When searching: shows all matches.
RangeHistogram — Side-by-side Min/Max number inputs with $ prefix and placeholder showing data bounds.
Section — Layout wrapper with title/subtitle + px-6 py-4 padding.
Divider — Thin border-t between sections.
8. Modal Footer (line 768-785)
Two actions:

"Clear all" — resets to DEFAULT_FILTERS
"Show N partners" — closes the modal (filters are already applied live as you change them)
The footer dynamically shows the current filteredCount so users see results update in real-time as they adjust filters.

This is a live-filtering pattern — every filter change immediately updates advFilters state, which triggers the filteredVendors useMemo to recompute, and the filteredCount prop flows back into the modal footer. No "Apply" button needed.