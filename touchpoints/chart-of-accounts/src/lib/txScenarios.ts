// =========================
// Transaction scenarios - the narration behind every seeded posting.
//
// A ledger line is only believable when its wording, its source document, its
// counterparty and the two accounts it touches all describe the same event. So
// the seed does not compose descriptions from account names; it picks a scenario
// (a real manufacturing event) and lets the scenario decide the source, the
// party, both legs' wording, and which account families each leg may land on.
//
// Legs are matched to accounts by `FULL_CHART` group label rather than by
// account id, so the chart can gain or lose accounts without stranding copy.
// This module deliberately imports nothing from seed.ts - seed.ts imports it.
// =========================

export type PartyKind = 'vendor' | 'customer' | 'bank' | 'agency' | 'employee'

export interface ScenarioLeg {
  /** FULL_CHART ChartRow.group the account must belong to. */
  group: string
  /**
   * Account numbers within the group this leg may land on. A group is coarser
   * than its members - "Capitalize tooling, progressive die set" is true of
   * Machinery & Equipment and false of Vehicles - so any leg naming a specific
   * asset, tax or bank account narrows to the accounts it actually describes.
   */
  accounts?: string[]
  /** Narration. May contain the {qty}, {week} and {month} tokens. */
  text: string
  /** Further wordings for the same event, so a register isn't one sentence repeated. */
  alts?: string[]
  /** Plausible range for {qty}, in the same order of magnitude as the real figure. */
  qty?: [number, number]
  /** Renders `${text} ${reference}` when the source carries a linked document. */
  appendRef?: boolean
  /** true = contra accounts only. Omitted = contra accounts excluded. */
  contra?: boolean
  /**
   * The leg was written in its account's own currency - a euro receipt into the
   * euro account - so the posting carries the amount as typed in it beside the
   * base figure (see the seed's `typedLeg`). Only means anything on an account
   * held in another currency; omitted, the posting is a base figure alone.
   */
  inAccountCurrency?: boolean
}

export interface TxScenario {
  id: string
  /** SOURCE_DOC key - decides the reference prefix, the document label and whether one exists. */
  source: string
  debit: ScenarioLeg
  credit: ScenarioLeg
  party?: string
  partyKind?: PartyKind
  /**
   * How often the business actually does this. A plant collects receivables
   * daily and issues bonds once, so an even spread across scenarios would put
   * thirty land purchases in one year. Defaults to 'normal' (roughly monthly).
   */
  cadence?: 'high' | 'normal' | 'low'
  /**
   * Order of magnitude of the money involved. Land and a tin of cutting fluid
   * do not share a range, and the document quick view prints the amount next to
   * the narration, so one flat band made a claim for abrasives read as $441,335.
   * Defaults to 'mid'.
   */
  size?: 'tiny' | 'small' | 'large'
  /**
   * When in the month the event can happen at all. Most events happen whenever
   * business happens, and take the default. 'period-end' is for the work that
   * only exists because a period is being closed - retranslating a foreign
   * currency balance at the closing rate is not something anyone does on the
   * 9th, and a register showing it every few days says the close runs
   * continuously. Such a scenario posts on the last day of the period, once,
   * and never in a period whose close has not come round yet.
   */
  timing?: 'period-end'
  /** Document header line, e.g. 'Customer invoice, finished goods'. */
  docTitle: string
  /** Document body: one sentence a reader could check the entry against. */
  doc: string
}

// Every active posting account in FULL_CHART is reachable from at least one leg
// below, so no account in the listing carries a movement its register cannot
// explain. The two accounts the chart marks Inactive are deliberately
// unreachable - an inactive account should not take new postings.
export const TX_SCENARIOS: TxScenario[] = [
  {
    id: 'ar-collect-meridian',
    cadence: 'high',
    source: 'Customer payments',
    debit: { group: 'Cash and Cash Equivalents', accounts: ['11120', '11130'], text: 'Payment received for finished goods invoice', alts: ['Payment received on finished goods release', 'Customer remittance received, finished goods invoice'], appendRef: true },
    credit: { group: 'Accounts Receivable', accounts: ['11310'], text: 'Clear receivable, Meridian Auto Parts, brake caliper assemblies', alts: ['Clear receivable, Meridian Auto Parts, caliper brackets', 'Clear receivable, Meridian Auto Parts, monthly release'] },
    party: 'Meridian Auto Parts',
    partyKind: 'customer',
    docTitle: 'Customer invoice, finished goods',
    doc: 'Brake caliper assemblies shipped from Plant 2 against a standing blanket order, settled by wire.',
  },
  {
    id: 'steel-coil-purchase',
    cadence: 'high',
    source: 'Receiving',
    debit: { group: 'Inventory', accounts: ['11410'], text: 'Record raw material, steel coil, {qty} metric tons, Plant 2', qty: [20, 90] },
    credit: { group: 'Cash and Cash Equivalents', accounts: ['11130'], text: 'Payment to Nucor for hot-rolled steel coil,', alts: ['Payment to Nucor for cold-rolled coil,', 'Payment to Nucor on coil delivery,'], appendRef: true },
    party: 'Nucor',
    partyKind: 'vendor',
    docTitle: 'Vendor invoice, raw material',
    doc: 'Hot-rolled coil received at the Plant 2 slitting line, gauge and mill certificates on file.',
  },
  {
    id: 'payroll-machining',
    cadence: 'high',
    source: 'Payroll',
    debit: { group: 'Salaries and Wages', accounts: ['52110'], text: 'Weekly payroll, Plant 2 machining line, week {week}' },
    credit: { group: 'Accrued Liabilities', accounts: ['21310'], text: 'Clear accrued wages, {qty} line operators', qty: [60, 140] },
    docTitle: 'Payroll run, hourly plant staff',
    doc: 'Weekly run for the Plant 2 machining line, hours taken from the shop floor clock system.',
  },
  {
    id: 'inbound-freight',
    size: 'small',
    cadence: 'high',
    source: 'Vendor Invoice',
    debit: { group: 'Cost of Goods Sold', accounts: ['51040'], text: 'Record transport cost, billet delivery, dock 3', alts: ['Record inbound freight, steel coil delivery, dock 1', 'Record transport cost, sensor module airfreight', 'Record inbound freight, expedited component run', 'Record transport cost, returnable packaging haul'] },
    credit: { group: 'Accounts Payable', accounts: ['21110'], text: 'Inbound freight, aluminum billet, Ryder Logistics', alts: ['Inbound freight, steel coil, Ryder Logistics', 'Inbound freight payable, expedited component delivery'] },
    party: 'Ryder Logistics',
    partyKind: 'vendor',
    docTitle: 'Vendor invoice, inbound freight',
    doc: 'Line-haul charge for aluminum billet delivered to dock 3, weight verified against the bill of lading.',
  },
  {
    id: 'stamping-tooling',
    cadence: 'low',
    source: 'Vendor Invoice',
    debit: { group: 'Property, Plant and Equipment', accounts: ['12120'], text: 'Capitalize tooling, progressive die set', alts: ['Capitalize tooling, transfer die and fixtures', 'Capitalize machinery, CNC turning cell'] },
    credit: { group: 'Accounts Payable', accounts: ['21110'], text: 'Die replacement, stamping press #{qty}', qty: [2, 9] },
    party: 'Dayton Progress',
    partyKind: 'vendor',
    docTitle: 'Vendor invoice, tooling',
    doc: 'Replacement progressive die set for the stamping cell, capitalized over the expected part run.',
  },
  {
    id: 'plant-utilities',
    size: 'small',
    source: 'Vendor Invoice',
    debit: { group: 'General and Administrative', accounts: ['52320'], text: 'Record utilities, power and gas', alts: ['Record utilities, compressed air and lighting load', 'Record utilities, natural gas for heat treat'] },
    credit: { group: 'Accounts Payable', accounts: ['21110'], text: '{month} utilities, injection molding shop' },
    party: 'Consumers Energy',
    partyKind: 'vendor',
    docTitle: 'Utility invoice, power and gas',
    doc: 'Metered power and gas for the injection molding shop, billed on the plant meter.',
  },
  {
    id: 'pm-contract',
    size: 'small',
    source: 'Vendor Payments',
    debit: { group: 'Accounts Payable', accounts: ['21110'], text: 'Clear service payable, quarterly PM contract', alts: ['Clear service payable, annual calibration contract', 'Clear payable on maintenance contract settlement'] },
    credit: { group: 'Cash and Cash Equivalents', accounts: ['11130'], text: 'Preventive maintenance, CNC cell, Haas service', alts: ['Preventive maintenance, stamping press, Haas service', 'Service payment, spindle rebuild, Haas service'] },
    party: 'Haas Automation',
    partyKind: 'vendor',
    docTitle: 'Bank payment, service contract',
    doc: 'Quarterly preventive maintenance visit on the CNC cell, spindle and way covers serviced.',
  },
  {
    id: 'ar-collect-gearworks',
    cadence: 'high',
    source: 'Customer payments',
    debit: { group: 'Cash and Cash Equivalents', accounts: ['11130'], text: 'Payment received, Continental Gearworks,', appendRef: true },
    credit: { group: 'Accounts Receivable', accounts: ['11310'], text: 'Clear receivable, transmission housings, {qty} units', qty: [400, 900] },
    party: 'Continental Gearworks',
    partyKind: 'customer',
    docTitle: 'Customer invoice, machined housings',
    doc: 'Transmission housings machined at Plant 3 and released after first-article approval.',
  },
  {
    id: 'scrap-sale',
    size: 'small',
    source: 'Cash Management',
    debit: { group: 'Cash and Cash Equivalents', accounts: ['11120', '11130'], text: 'Proceeds from scrap metal sale, Sims Metal', alts: ['Proceeds from scrap sale, steel offcuts', 'Proceeds from scrap collection, Sims Metal'] },
    credit: { group: 'Other Revenue', accounts: ['42040'], text: 'Record other income, steel offcuts, {qty} tons', qty: [6, 24] },
    party: 'Sims Metal',
    partyKind: 'customer',
    docTitle: 'Bank receipt, scrap sale',
    doc: 'Steel offcuts from the stamping line weighed out at the scrap yard and paid at the posted rate.',
  },
  {
    id: 'sensor-purchase',
    cadence: 'high',
    source: 'Receiving',
    debit: { group: 'Inventory', accounts: ['11410'], text: 'Record raw material, ABS sensor modules, {qty} units', qty: [2000, 8000] },
    credit: { group: 'Cash and Cash Equivalents', accounts: ['11130'], text: 'Payment to Bosch for sensor components,', alts: ['Payment to Bosch for sensor modules,', 'Payment to Bosch on component delivery,'], appendRef: true },
    party: 'Bosch',
    partyKind: 'vendor',
    docTitle: 'Vendor invoice, purchased components',
    doc: 'ABS sensor modules for the brake assembly line, received against a kanban pull signal.',
  },

  // ----- Written to cover the remaining groups, same voice -----
  {
    id: 'goods-invoiced',
    cadence: 'high',
    source: 'Customer Invoice',
    debit: {
      group: 'Accounts Receivable', accounts: ['11310'], appendRef: true,
      text: 'Invoice finished goods shipment, Meridian Auto Parts',
      alts: ['Invoice caliper assemblies, Meridian Auto Parts release', 'Invoice finished goods, Plant 2 shipment'],
    },
    credit: {
      group: 'Operating Revenue', accounts: ['41010'], qty: [800, 2400],
      text: 'Recognize revenue, brake caliper assemblies, {qty} units',
      alts: ['Recognize product revenue, caliper assemblies, {qty} units', 'Recognize revenue on shipment, {qty} units released'],
    },
    party: 'Meridian Auto Parts',
    partyKind: 'customer',
    docTitle: 'Customer invoice, finished goods',
    doc: 'Caliper assemblies released from Plant 2 finished goods, priced on the current blanket order.',
  },
  {
    id: 'credit-memo',
    size: 'small',
    cadence: 'low',
    source: 'RMA',
    debit: {
      group: 'Operating Revenue', accounts: ['41070'], contra: true,
      text: 'Sales return, transmission housings rejected at incoming inspection',
      alts: ['Sales return, housings out of tolerance on bore diameter'],
    },
    credit: { group: 'Accounts Receivable', accounts: ['11310'], text: 'Credit memo issued, Continental Gearworks, {qty} units', qty: [8, 40], appendRef: true },
    party: 'Continental Gearworks',
    partyKind: 'customer',
    docTitle: 'Customer credit memo, returned goods',
    doc: 'Housings rejected on bore diameter at the customer incoming inspection, returned to Plant 3 for rework.',
  },
  {
    id: 'shop-consumables',
    size: 'tiny',
    cadence: 'high',
    source: 'Vendor Invoice',
    debit: {
      group: 'General and Administrative', accounts: ['52330'],
      text: 'Stores supplies, gloves and safety consumables',
      alts: [
        'Stores supplies, gauges and hand tools, Plant 2',
        'Stores supplies, cleaning and janitorial stock',
        'Office supplies, print and stationery, admin block',
        'Office supplies, toner and filing stock, admin block',
        'Stores supplies, first aid and PPE restock',
        'Office supplies, kitchen and breakroom stock',
      ],
    },
    credit: {
      group: 'Current Liabilities', accounts: ['21200'],
      text: 'Reimbursement payable, MSC Industrial order',
      alts: [
        'Reimbursement payable, consumables order',
        'Reimbursement payable, tooling supplies order',
        'Reimbursement payable, safety stock order',
        'Reimbursement payable, abrasives and media order',
      ],
      appendRef: true,
    },
    party: 'Ravi Menon (Plant Supervisor)',
    partyKind: 'employee',
    docTitle: 'Expense claim, stores and office supplies',
    doc: 'Gloves, PPE and stores sundries bought by the plant supervisor and claimed back on the monthly expense run.',
  },
  {
    id: 'trade-show',
    size: 'tiny',
    cadence: 'low',
    source: 'Vendor Invoice',
    debit: {
      group: 'Sales and Marketing', accounts: ['52220'],
      text: 'Trade show costs, Detroit auto supplier expo',
      alts: ['Trade show costs, booth build and sample parts', 'Trade show costs, Chicago fabricators show'],
    },
    credit: { group: 'Current Liabilities', accounts: ['21200'], text: 'Reimbursement payable, booth space and freight', alts: ['Reimbursement payable, exhibition stand and freight', 'Reimbursement payable, show registration and logistics'], appendRef: true },
    party: 'Hannah Weiss (Sales Director)',
    partyKind: 'employee',
    docTitle: 'Expense claim, trade show',
    doc: 'Booth space, freight and travel for the Detroit auto supplier expo, approved before the show.',
  },
  {
    id: 'property-insurance',
    cadence: 'low',
    source: 'Vendor Invoice',
    debit: { group: 'Prepaid Expenses and Other', accounts: ['11510'], text: 'Prepay property and casualty cover, plants 1 to 3', alts: ['Prepay property and casualty cover, annual renewal', 'Prepay plant and liability cover for the policy year'], appendRef: true },
    credit: { group: 'Accounts Payable', accounts: ['21110'], text: 'Annual premium payable, Travelers policy', alts: ['Annual premium payable, property and casualty renewal', 'Premium payable on policy renewal, Travelers'] },
    party: 'Travelers',
    partyKind: 'vendor',
    docTitle: 'Vendor invoice, insurance premium',
    doc: 'Twelve-month property and casualty cover across the three plants, amortized monthly.',
  },
  {
    id: 'monthly-depreciation',
    source: 'Manual JE',
    debit: { group: 'Depreciation and Amortization', accounts: ['52510'], text: 'Monthly depreciation, plant buildings and improvements', alts: ['Depreciation charge, buildings and leasehold fit-out', 'Depreciation charge, freehold plant and improvements'] },
    credit: { group: 'Property, Plant and Equipment', accounts: ['12140', '12145'], text: 'Accumulate depreciation, buildings register', alts: ['Accumulate depreciation, freehold buildings', 'Accumulate depreciation, leasehold improvements'], contra: true },
    docTitle: 'Depreciation schedule',
    doc: 'Straight-line charge for the month taken from the fixed asset register, no additions in the period.',
  },
  {
    id: 'monthly-amortization',
    source: 'Manual JE',
    debit: { group: 'Depreciation and Amortization', accounts: ['52520'], text: 'Monthly amortization, patents and capitalized software', alts: ['Amortize capitalized software, MES rollout', 'Amortize patent family over remaining useful life'] },
    credit: { group: 'Intangible Assets', accounts: ['12240'], text: 'Accumulate amortization, software and patent register', alts: ['Accumulate amortization, capitalized software', 'Accumulate amortization, patent register'], contra: true },
    docTitle: 'Amortization schedule',
    doc: 'Monthly charge on capitalized MES and CAD licenses over their remaining useful life.',
  },
  {
    id: 'mes-capitalize',
    cadence: 'low',
    source: 'Vendor Invoice',
    debit: { group: 'Intangible Assets', accounts: ['12230'], text: 'Capitalize MES licenses, Plant 2 rollout', alts: ['Capitalize configuration effort, MES rollout', 'Capitalize software licences, quality module'], appendRef: true },
    credit: { group: 'Accounts Payable', accounts: ['21110'], text: 'License and configuration payable, Rockwell', alts: ['Software licence payable, MES modules', 'Configuration and integration payable, Rockwell'] },
    party: 'Rockwell Automation',
    partyKind: 'vendor',
    docTitle: 'Vendor invoice, software license',
    doc: 'Manufacturing execution system licenses and configuration for the Plant 2 rollout.',
  },
  {
    id: 'term-loan-draw',
    size: 'large',
    cadence: 'low',
    source: 'Cash Management',
    debit: { group: 'Cash and Cash Equivalents', accounts: ['11130'], text: 'Draw on equipment term loan, press line finance', alts: ['Draw on equipment term loan, machining cell finance', 'Drawdown received under the equipment facility'] },
    credit: { group: 'Long-Term Debt', accounts: ['22110'], text: 'Record term loan principal, Fifth Third facility', alts: ['Record term loan principal, press line facility', 'Increase term loan balance on further drawdown'], appendRef: true },
    party: 'Fifth Third Bank',
    partyKind: 'bank',
    docTitle: 'Bank advice, loan drawdown',
    doc: 'Drawdown on the equipment facility funding the new press line, seven-year amortizing term.',
  },
  {
    id: 'loan-interest',
    size: 'small',
    source: 'Cash Management',
    debit: {
      group: 'Other Expenses', accounts: ['53010'],
      text: 'Interest on equipment term loan',
      alts: ['Interest on plant mortgage facility', 'Interest on revolving working capital line'],
    },
    credit: { group: 'Cash and Cash Equivalents', accounts: ['11130'], text: 'Debit for scheduled interest, Fifth Third facility', alts: ['Debit for scheduled interest, term facility', 'Interest debited on the equipment facility'], appendRef: true },
    party: 'Fifth Third Bank',
    partyKind: 'bank',
    docTitle: 'Bank advice, interest charge',
    doc: 'Scheduled interest on the equipment facility, taken by direct debit on the payment date.',
  },
  {
    id: 'tooling-deposit',
    source: 'Customer payments',
    debit: { group: 'Cash and Cash Equivalents', accounts: ['11130'], text: 'Customer tooling deposit received,', appendRef: true },
    credit: { group: 'Other Current Liabilities', accounts: ['21620'], text: 'Record customer deposit, {qty} percent of program value', qty: [20, 50] },
    party: 'Continental Gearworks',
    partyKind: 'customer',
    docTitle: 'Customer invoice, tooling deposit',
    doc: 'Up-front tooling contribution on a new housing program, released as parts ship.',
  },
  {
    id: 'sales-tax-remittance',
    source: 'Vendor Payments',
    debit: { group: 'Taxes Payable', accounts: ['21410'], text: 'Remit sales and use tax, Michigan filing', alts: ['Remit sales and use tax, quarterly filing', 'Clear sales tax payable on filing submission'] },
    credit: { group: 'Cash and Cash Equivalents', accounts: ['11130'], text: 'Payment to Michigan Department of Treasury', alts: ['Direct debit, state sales tax remittance', 'Payment on sales and use tax filing'] },
    party: 'Michigan Department of Treasury',
    partyKind: 'agency',
    docTitle: 'Tax remittance',
    doc: 'Monthly sales and use tax filing for the Michigan plants, paid from the operating account.',
  },
  {
    id: 'term-deposit',
    size: 'large',
    cadence: 'low',
    source: 'Cash Management',
    debit: { group: 'Short-Term Investments', accounts: ['11220'], text: 'Place {qty} day certificate of deposit, surplus operating cash', qty: [30, 180] },
    credit: { group: 'Cash and Cash Equivalents', accounts: ['11130'], text: 'Transfer to certificate of deposit, JPMorgan', alts: ['Transfer to certificate of deposit on placement', 'Outbound transfer, term deposit placement'], appendRef: true },
    party: 'JPMorgan',
    partyKind: 'bank',
    docTitle: 'Bank advice, term deposit',
    doc: 'Surplus operating cash placed on short-term deposit ahead of the next tooling payment run.',
  },
  {
    id: 'plant-lease-deposit',
    cadence: 'low',
    source: 'Vendor Payments',
    debit: { group: 'Other Non-Current Assets', accounts: ['12310'], text: 'Record security deposit, Plant 3 lease', alts: ['Record security deposit, warehouse lease', 'Record deposit held under the Plant 3 lease'] },
    credit: { group: 'Cash and Cash Equivalents', accounts: ['11130'], text: 'Payment of lease deposit, Duke Realty', alts: ['Payment of lease deposit on signing', 'Deposit paid under the plant lease'] },
    party: 'Duke Realty',
    partyKind: 'vendor',
    docTitle: 'Lease deposit',
    doc: 'Refundable security deposit on the Plant 3 lease, held for the full term of the agreement.',
  },
  {
    id: 'share-issue',
    size: 'large',
    cadence: 'low',
    source: 'Manual JE',
    debit: { group: 'Cash and Cash Equivalents', accounts: ['11130'], text: 'Proceeds from share issue, expansion funding', alts: ['Subscription proceeds received, expansion round', 'Share issue proceeds credited to the operating account'] },
    credit: { group: 'Contributed Capital', accounts: ['31010'], text: 'Record common stock issued, press line expansion round', alts: ['Record common stock at par, expansion round', 'Issue common stock, capacity funding round'] },
    docTitle: 'Share issue',
    doc: 'Equity raised to fund the press line expansion, subscribed by the existing shareholder group.',
  },
  {
    id: 'dividend-payment',
    size: 'large',
    cadence: 'low',
    source: 'Cash Management',
    debit: { group: 'Distributions', accounts: ['33010'], text: 'Dividend declared, {qty} cents per share', qty: [8, 45], contra: true },
    credit: { group: 'Cash and Cash Equivalents', accounts: ['11130'], text: 'Settlement of declared dividend, Computershare', alts: ['Settlement of dividend tranche, Computershare', 'Payment on dividend distribution'], appendRef: true },
    party: 'Computershare',
    partyKind: 'agency',
    docTitle: 'Bank advice, dividend distribution',
    doc: 'Dividend paid through the transfer agent under the distribution approved by the board.',
  },
  {
    id: 'prior-year-tax-restatement',
    cadence: 'low',
    source: 'Manual JE',
    // A hand correction, so it lands in the manual half of retained earnings.
    debit: { group: 'Retained Earnings', accounts: ['32200'], text: 'Prior year adjustment, understated tax accrual', alts: ['Prior period adjustment, prior year tax provision restated', 'Restate opening reserves for understated tax charge'] },
    credit: { group: 'Accrued Liabilities', accounts: ['21330'], text: 'Top up accrued taxes, {qty} prior year returns reassessed', qty: [2, 9] },
    docTitle: 'Prior period adjustment',
    doc: 'Prior year tax accrual restated after the amended state returns were reassessed by the tax adviser.',
  },
  {
    id: 'bad-debt-provision',
    cadence: 'low',
    source: 'Manual JE',
    debit: { group: 'Other Expenses', accounts: ['53030'], text: 'Bad debt provision, aged tier two accounts', alts: ['Bad debt provision, disputed tier two balance', 'Bad debt provision, customer in administration'] },
    credit: { group: 'Accounts Receivable', accounts: ['11330'], text: 'Increase allowance for doubtful accounts, {qty} days past due', qty: [90, 210], contra: true },
    docTitle: 'Provision schedule',
    doc: 'Allowance raised on aged tier two customer balances following the monthly credit review.',
  },
  {
    id: 'inventory-writedown',
    cadence: 'low',
    source: 'Manual JE',
    debit: { group: 'Cost of Goods Sold', accounts: ['51010'], text: 'Write down obsolete stock, superseded caliper brackets', alts: ['Write down slow moving stock, superseded housings', 'Write down obsolete stock, discontinued sensor variant'] },
    credit: { group: 'Inventory', accounts: ['11440'], text: 'Increase inventory reserve, {qty} units at standard cost', qty: [200, 1400], contra: true },
    docTitle: 'Inventory adjustment',
    doc: 'Brackets superseded by the current caliper revision, written down to net realizable value.',
  },

  // ----- Payroll, banking and treasury -----
  {
    id: 'payroll-funding',
    cadence: 'high',
    source: 'Payroll',
    debit: { group: 'Accrued Liabilities', accounts: ['21310'], text: 'Fund weekly payroll, hourly plant staff, week {week}' },
    credit: { group: 'Cash and Cash Equivalents', accounts: ['11140'], text: 'Payroll transfer, week {week} net pay', appendRef: true },
    docTitle: 'Payroll run, net pay transfer',
    doc: 'Net pay for the week moved from the payroll account, direct deposit file released to the bank.',
  },
  {
    id: 'payroll-taxes',
    source: 'Payroll',
    debit: { group: 'Salaries and Wages', accounts: ['52120'], text: 'Employer payroll taxes, week {week}' },
    credit: { group: 'Taxes Payable', accounts: ['21420'], text: 'Accrue payroll tax withholding, week {week}' },
    docTitle: 'Payroll run, tax accrual',
    doc: 'Employer and withheld payroll taxes for the week, held until the federal deposit date.',
  },
  {
    id: 'payroll-tax-remit',
    source: 'Vendor Payments',
    debit: { group: 'Taxes Payable', accounts: ['21420'], text: 'Remit accrued payroll taxes, federal deposit', alts: ['Remit accrued payroll taxes, state withholding', 'Remit withheld payroll taxes on deposit schedule'] },
    credit: { group: 'Cash and Cash Equivalents', accounts: ['11140'], text: 'EFTPS payment, payroll tax deposit', alts: ['EFTPS payment, federal payroll deposit', 'Electronic payment, payroll tax deposit'], appendRef: true },
    party: 'Internal Revenue Service',
    partyKind: 'agency',
    docTitle: 'Bank payment, payroll tax deposit',
    doc: 'Semi-weekly federal payroll tax deposit made from the payroll account on the due date.',
  },
  {
    id: 'benefits-invoice',
    source: 'Vendor Invoice',
    debit: { group: 'Salaries and Wages', accounts: ['52130'], text: 'Employee benefits, medical and dental cover, {month}' },
    credit: { group: 'Accounts Payable', accounts: ['21110'], text: 'Benefits premium payable, plant and office staff', alts: ['Benefits premium payable, medical and dental plans', 'Premium payable, staff benefit schemes'] },
    party: 'Blue Cross Blue Shield',
    partyKind: 'vendor',
    docTitle: 'Vendor invoice, benefits premium',
    doc: 'Monthly medical and dental premium for plant and office headcount, billed per enrolled employee.',
  },
  {
    id: 'production-bonus',
    cadence: 'low',
    source: 'Payroll',
    debit: { group: 'Salaries and Wages', accounts: ['52110'], text: 'Production bonus, Plant 2 output above standard', alts: ['Production bonus, scrap rate below target', 'Commission and bonus, quarterly output award'] },
    credit: { group: 'Accrued Liabilities', accounts: ['21310'], text: 'Accrue quarterly production bonus, {qty} eligible staff', qty: [40, 120] },
    docTitle: 'Payroll run, bonus accrual',
    doc: 'Quarterly bonus earned on output above standard, paid with the first run after the quarter closes.',
  },
  {
    id: 'direct-labor',
    cadence: 'high',
    source: 'Payroll',
    debit: { group: 'Cost of Goods Sold', accounts: ['51020'], text: 'Direct labor applied, Plant 2 machining cell, week {week}' },
    credit: { group: 'Accrued Liabilities', accounts: ['21310'], text: 'Accrue direct wages, {qty} operators', qty: [40, 110] },
    docTitle: 'Payroll run, direct labor',
    doc: 'Machining cell hours applied to open work orders at the standard labor rate.',
  },
  {
    id: 'money-market-sweep',
    size: 'large',
    cadence: 'high',
    source: 'Cash Management',
    debit: { group: 'Cash and Cash Equivalents', accounts: ['11150'], text: 'Sweep surplus operating cash to money market', alts: ['Sweep month end surplus to money market', 'Move idle operating balance to money market'] },
    credit: { group: 'Cash and Cash Equivalents', accounts: ['11130'], text: 'Transfer to money market, JPMorgan', alts: ['Outbound sweep to money market account', 'Transfer out on daily cash sweep'], appendRef: true },
    party: 'JPMorgan',
    partyKind: 'bank',
    docTitle: 'Bank transfer, cash sweep',
    doc: 'Surplus above the operating float swept overnight to the money market account.',
  },
  {
    id: 'petty-cash-disbursement',
    size: 'tiny',
    cadence: 'low',
    source: 'Vendor Payments',
    debit: {
      group: 'General and Administrative', accounts: ['52330'],
      text: 'Sundries paid from the plant petty cash float',
      alts: [
        'Courier charge paid from the petty cash float',
        'Breakroom and kitchen stock, petty cash float',
        'Parking and local travel, petty cash float',
      ],
    },
    credit: {
      group: 'Cash and Cash Equivalents', accounts: ['11110'],
      text: 'Cash paid out, petty cash float',
      alts: ['Cash paid out against petty cash voucher', 'Disbursement from the plant petty cash tin'],
    },
    party: 'Ravi Menon (Plant Supervisor)',
    partyKind: 'employee',
    docTitle: 'Petty cash voucher',
    doc: 'Small sundries paid in cash from the plant float and vouched at the end of the week.',
  },
  {
    id: 'petty-cash-topup',
    size: 'tiny',
    cadence: 'low',
    source: 'Cash Management',
    debit: {
      group: 'Cash and Cash Equivalents', accounts: ['11110'],
      text: 'Restore the petty cash float to its imprest level',
      alts: ['Top up the plant petty cash float', 'Reimburse the petty cash float against vouchers'],
    },
    credit: {
      group: 'Cash and Cash Equivalents', accounts: ['11130'],
      text: 'Cash withdrawal, petty cash top up',
      alts: ['Withdrawal to restore the petty cash float', 'Transfer out, petty cash reimbursement'],
      appendRef: true,
    },
    party: 'Chase Bank',
    partyKind: 'bank',
    docTitle: 'Bank withdrawal, petty cash',
    doc: 'The float brought back to its imprest level once the weeks vouchers are counted.',
  },
  {
    id: 'savings-reserve',
    size: 'large',
    cadence: 'low',
    source: 'Cash Management',
    debit: { group: 'Cash and Cash Equivalents', accounts: ['11160'], text: 'Transfer to reserve savings, quarterly cash reserve', alts: ['Transfer to reserve savings, capital expenditure fund', 'Top up reserve savings against covenant minimum'], inAccountCurrency: true },
    credit: { group: 'Cash and Cash Equivalents', accounts: ['11130'], text: 'Reserve transfer, Barclays savings', alts: ['Transfer out to reserve savings', 'Outbound transfer, reserve funding'], appendRef: true },
    party: 'Barclays',
    partyKind: 'bank',
    docTitle: 'Bank transfer, cash reserve',
    doc: 'Quarterly top up of the reserve held against the tooling program commitments.',
  },
  {
    id: 'eur-export-receipt',
    source: 'Customer payments',
    debit: { group: 'Cash and Cash Equivalents', accounts: ['11170'], text: 'EUR receipt, export shipment converted at spot', alts: ['EUR receipt, European export settled at spot', 'EUR receipt, customer payment on export invoice'], appendRef: true, inAccountCurrency: true },
    credit: { group: 'Accounts Receivable', accounts: ['11310'], text: 'Clear receivable, EUR export shipment, {qty} units', qty: [200, 900] },
    party: 'Rheinmetall Automotive',
    partyKind: 'customer',
    docTitle: 'Customer invoice, export shipment',
    doc: 'Export shipment invoiced in euros and settled into the Deutsche Bank account.',
  },
  {
    id: 'fx-revaluation',
    size: 'small',
    timing: 'period-end',
    source: 'Manual JE',
    debit: { group: 'Other Revenue', accounts: ['42040'], text: 'Revalue EUR bank balance at month end rate', alts: ['Retranslate EUR balance at closing rate', 'Record unrealized loss on EUR cash holding'] },
    credit: { group: 'Cash and Cash Equivalents', accounts: ['11170'], text: 'Adjust EUR account to {month} closing rate' },
    docTitle: 'Month end revaluation',
    doc: 'EUR bank balance restated at the closing rate, the unrealized movement taken against income.',
  },
  {
    id: 'marketable-securities',
    size: 'large',
    cadence: 'low',
    source: 'Cash Management',
    debit: { group: 'Short-Term Investments', accounts: ['11210'], text: 'Purchase marketable securities, short-dated treasuries', alts: ['Purchase marketable securities, commercial paper', 'Purchase short-dated treasuries with surplus cash'] },
    credit: { group: 'Cash and Cash Equivalents', accounts: ['11130'], text: 'Settlement of securities purchase, JPMorgan', alts: ['Settlement of treasury purchase, JPMorgan', 'Debit on marketable securities settlement'], appendRef: true },
    party: 'JPMorgan',
    partyKind: 'bank',
    docTitle: 'Bank advice, securities purchase',
    doc: 'Short-dated treasuries bought to hold surplus cash ahead of the capital program.',
  },
  {
    id: 'interest-income',
    size: 'small',
    source: 'Cash Management',
    debit: { group: 'Cash and Cash Equivalents', accounts: ['11150'], text: 'Interest credited, money market balance', alts: ['Interest credited, savings balance', 'Interest credited on certificate of deposit'] },
    credit: { group: 'Other Revenue', accounts: ['42010'], text: 'Record interest income, {month} money market' },
    party: 'JPMorgan',
    partyKind: 'bank',
    docTitle: 'Bank advice, interest credit',
    doc: 'Monthly interest credited on the money market balance at the posted tier rate.',
  },
  {
    id: 'rental-income',
    size: 'small',
    source: 'Customer Invoice',
    debit: { group: 'Accounts Receivable', accounts: ['11320'], text: 'Invoice sublease of surplus warehouse bay', appendRef: true },
    credit: { group: 'Other Revenue', accounts: ['42020'], text: 'Record rental income, Plant 1 surplus bay', alts: ['Record rental income, surplus warehouse bay', 'Record rental income, sublet office suite'] },
    party: 'Midwest Fabricating',
    partyKind: 'customer',
    docTitle: 'Customer invoice, sublease',
    doc: 'Monthly sublease of the surplus Plant 1 bay, charged per square foot under the side agreement.',
  },

  // ----- Inventory, cost of sales and prepayments -----
  {
    id: 'wip-release',
    cadence: 'high',
    source: 'Manual JE',
    debit: { group: 'Inventory', accounts: ['11420'], text: 'Issue raw material to Plant 2 machining line, work order release', alts: ['Issue steel coil to the stamping line on work order release', 'Issue sensor modules to the assembly cell'] },
    credit: { group: 'Inventory', accounts: ['11410'], text: 'Relieve raw material, steel coil issued to production', alts: ['Relieve raw material, billet drawn to production', 'Relieve raw material, purchased components issued'] },
    docTitle: 'Inventory movement, work order release',
    doc: 'Coil and blanks issued against released work orders on the Plant 2 machining line.',
  },
  {
    id: 'wip-to-finished',
    cadence: 'high',
    source: 'Manual JE',
    debit: { group: 'Inventory', accounts: ['11430'], text: 'Receive finished goods from Plant 2, {qty} units to stock', qty: [200, 1500] },
    credit: { group: 'Inventory', accounts: ['11420'], text: 'Close work order, caliper assembly build', alts: ['Close work order, transmission housing build', 'Close work order, sensor bracket build'] },
    docTitle: 'Inventory movement, work order close',
    doc: 'Completed caliper assemblies received into finished goods at standard cost.',
  },
  {
    id: 'cogs-material',
    cadence: 'high',
    source: 'Manual JE',
    debit: { group: 'Cost of Goods Sold', accounts: ['51010'], text: 'Consume direct material, caliper bracket blanks, {qty} units', qty: [500, 4000] },
    credit: { group: 'Inventory', accounts: ['11430'], text: 'Relieve finished goods at standard cost, customer release', alts: ['Relieve finished goods on customer release, standard cost', 'Relieve finished goods, shipment against release schedule'] },
    docTitle: 'Inventory movement, cost of sales',
    doc: 'Finished goods relieved on customer release, cost of sales taken at the current standard.',
  },
  {
    id: 'mfg-overhead',
    source: 'Manual JE',
    debit: { group: 'Cost of Goods Sold', accounts: ['51030'], text: 'Apply manufacturing overhead at standard rate, {month} production' },
    credit: { group: 'Current Liabilities', accounts: ['21200'], text: 'Accrue plant overhead, indirect labor and supplies', alts: ['Accrue indirect labor and consumables at period end', 'Accrue plant overhead absorbed but not invoiced'] },
    docTitle: 'Overhead application',
    doc: 'Plant overhead applied to production at the standard machine hour rate for the month.',
  },
  {
    id: 'subcontract-heat-treat',
    source: 'Vendor Invoice',
    debit: { group: 'Cost of Goods Sold', accounts: ['51030'], text: 'Outside processing, heat treat and plating, {qty} units', qty: [300, 2000] },
    credit: { group: 'Current Liabilities', accounts: ['21200'], text: 'Subcontractor payable, Bodycote heat treat', alts: ['Subcontractor payable, plating and passivation', 'Accrued outside processing, heat treat batches'] },
    party: 'Bodycote',
    partyKind: 'vendor',
    docTitle: 'Vendor invoice, outside processing',
    doc: 'Housings sent out for heat treat and plating, returned to Plant 3 for final machining.',
  },
  {
    id: 'insurance-amortize',
    size: 'small',
    source: 'Manual JE',
    debit: { group: 'General and Administrative', accounts: ['52340'], text: 'Amortize prepaid insurance, {month} share' },
    credit: { group: 'Prepaid Expenses and Other', accounts: ['11510'], text: 'Release prepaid insurance to expense', alts: ['Release monthly share of prepaid premium', 'Amortize prepaid property and casualty cover'] },
    docTitle: 'Prepayment release',
    doc: 'One twelfth of the annual property and casualty premium taken to expense.',
  },
  {
    id: 'prepay-plant-rent',
    cadence: 'low',
    source: 'Vendor Payments',
    debit: { group: 'Prepaid Expenses and Other', accounts: ['11520'], text: 'Prepay Plant 3 rent, next quarter', alts: ['Prepay warehouse rent, next quarter', 'Prepay Plant 3 rent, quarter in advance'], appendRef: true },
    credit: { group: 'Cash and Cash Equivalents', accounts: ['11130'], text: 'Quarterly rent payment, Duke Realty', alts: ['Quarterly rent payment on plant lease', 'Rent paid in advance, Duke Realty'] },
    party: 'Duke Realty',
    partyKind: 'vendor',
    docTitle: 'Vendor invoice, plant rent',
    doc: 'Quarterly rent on the Plant 3 lease, paid in advance under the terms of the agreement.',
  },
  {
    id: 'rent-expense',
    size: 'small',
    source: 'Manual JE',
    debit: { group: 'General and Administrative', accounts: ['52310'], text: 'Plant and office rent, {month}' },
    credit: { group: 'Prepaid Expenses and Other', accounts: ['11520'], text: 'Release prepaid rent to expense', alts: ['Release prepaid rent for the month', 'Amortize prepaid rent, Plant 3 lease'] },
    docTitle: 'Prepayment release',
    doc: 'One month of the quarterly Plant 3 rent taken to expense.',
  },
  {
    id: 'cad-subscription',
    size: 'tiny',
    cadence: 'low',
    source: 'Vendor Invoice',
    debit: { group: 'Prepaid Expenses and Other', accounts: ['11530'], text: 'Prepay CAD seats, annual term', alts: ['Prepay MES seats, annual term', 'Prepay office suite licences, annual term'], appendRef: true },
    credit: { group: 'Current Liabilities', accounts: ['21200'], text: 'Reimbursement payable, Autodesk annual renewal', alts: ['Reimbursement payable, annual licence renewal', 'Reimbursement payable, software subscription renewal'] },
    party: 'Priya Nair (Engineering Manager)',
    partyKind: 'employee',
    docTitle: 'Expense claim, software renewal',
    doc: 'Annual CAD and CAM seat renewal for the tooling design group, charged to the department card.',
  },
  {
    id: 'subscription-expense',
    size: 'small',
    source: 'Manual JE',
    debit: { group: 'General and Administrative', accounts: ['52360'], text: 'Software and subscriptions, {month} seats' },
    credit: {
      group: 'Prepaid Expenses and Other', accounts: ['11530'],
      text: 'Release prepaid subscriptions to expense',
      alts: ['Release {month} share of prepaid seats', 'Amortize prepaid CAD and MES licences'],
    },
    docTitle: 'Prepayment release',
    doc: 'Monthly share of the annual CAD, MES and office subscription terms taken to expense.',
  },
  {
    id: 'employee-advance',
    size: 'tiny',
    source: 'Vendor Payments',
    debit: { group: 'Prepaid Expenses and Other', accounts: ['11540'], text: 'Travel advance to plant engineer, supplier audit trip', alts: ['Travel advance to quality engineer, customer audit', 'Travel advance to sales team, trade show attendance'] },
    credit: { group: 'Cash and Cash Equivalents', accounts: ['11130'], text: 'Advance paid ahead of supplier audit travel', alts: ['Advance paid ahead of customer audit travel', 'Advance paid ahead of trade show attendance'], appendRef: true },
    party: 'Ravi Menon (Plant Supervisor)',
    partyKind: 'employee',
    docTitle: 'Bank payment, travel advance',
    doc: 'Advance issued ahead of a tier two supplier audit, cleared against the claim on return.',
  },
  {
    id: 'travel-claim',
    size: 'tiny',
    source: 'Vendor Payments',
    debit: { group: 'Sales and Marketing', accounts: ['52230'], text: 'Travel and entertainment, customer plant visits', alts: ['Travel and entertainment, supplier audit trip', 'Travel and entertainment, customer sourcing review'], appendRef: true },
    credit: { group: 'Prepaid Expenses and Other', accounts: ['11540'], text: 'Clear travel advance against submitted claim', alts: ['Clear outstanding advance against approved claim', 'Offset advance against settled expense claim'] },
    party: 'Hannah Weiss (Sales Director)',
    partyKind: 'employee',
    docTitle: 'Expense claim, travel',
    doc: 'Airfare, hotel and mileage for customer plant visits, cleared against the outstanding advance.',
  },

  /* ----- Property, plant, equipment and intangibles ----- */
  {
    id: 'land-purchase',
    size: 'large',
    cadence: 'low',
    source: 'Vendor Payments',
    debit: { group: 'Property, Plant and Equipment', accounts: ['12105'], text: 'Acquire land parcel adjoining Plant 2, {qty} acres', qty: [3, 18] },
    credit: { group: 'Cash and Cash Equivalents', accounts: ['11130'], text: 'Settlement funding, industrial land acquisition', alts: ['Settlement funding, land parcel completion', 'Payment on land acquisition completion'] },
    party: 'Duke Realty',
    partyKind: 'vendor',
    docTitle: 'Journal entry, land acquisition',
    doc: 'Closing settlement for the industrial parcel adjoining Plant 2, recorded at purchase price plus transfer costs.',
  },
  {
    id: 'building-works',
    size: 'large',
    cadence: 'low',
    source: 'Vendor Invoice',
    debit: { group: 'Property, Plant and Equipment', accounts: ['12110'], text: 'Capitalize plant construction, Bay {qty} extension', qty: [2, 9], alts: ['Capitalize building works, roof replacement, Plant 2'] },
    credit: { group: 'Accounts Payable', accounts: ['21110'], text: 'Construction progress billing, Plant 2 extension', alts: ['Construction progress billing, roof replacement', 'Progress billing certified, Plant 2 works'] },
    party: 'Barton Malow',
    partyKind: 'vendor',
    docTitle: 'Vendor invoice, construction',
    doc: 'Progress billing against the Plant 2 extension contract, certified by the project engineer.',
  },
  {
    id: 'leasehold-improvements',
    size: 'small',
    cadence: 'low',
    source: 'Vendor Invoice',
    debit: { group: 'Property, Plant and Equipment', accounts: ['12115'], text: 'Capitalize leasehold fit-out, quality lab and offices', alts: ['Capitalize leasehold fit-out, warehouse racking', 'Capitalize leasehold works, metrology room build'] },
    credit: { group: 'Accounts Payable', accounts: ['21110'], text: 'Fit-out works, leased warehouse, Grand Rapids', alts: ['Fit-out works, quality lab build, Grand Rapids', 'Fit-out works, racking and lighting, leased warehouse'] },
    party: 'Barton Malow',
    partyKind: 'vendor',
    docTitle: 'Vendor invoice, fit-out works',
    doc: 'Partitioning, electrical and HVAC works on the leased Grand Rapids warehouse, amortized over the lease term.',
  },
  {
    id: 'furniture-purchase',
    size: 'small',
    cadence: 'low',
    source: 'Vendor Invoice',
    debit: { group: 'Property, Plant and Equipment', accounts: ['12125'], text: 'Record office furniture, {qty} workstations, admin block', qty: [8, 40] },
    credit: { group: 'Accounts Payable', accounts: ['21110'], text: 'Workstations and shelving, admin block refresh', alts: ['Task seating and storage, admin block refresh', 'Furniture and fittings, plant office refresh'] },
    party: 'Steelcase',
    partyKind: 'vendor',
    docTitle: 'Vendor invoice, furniture',
    doc: 'Workstations, task seating and storage for the plant administration block.',
  },
  {
    id: 'vehicle-purchase',
    cadence: 'low',
    source: 'Manual JE',
    debit: { group: 'Property, Plant and Equipment', accounts: ['12130'], text: 'Record delivery fleet addition, {qty} yard tractors', qty: [1, 4], alts: ['Record forklift fleet addition, Plant 2 yard'] },
    credit: { group: 'Other Long-Term Liabilities', accounts: ['22220'], text: 'Recognize lease liability, yard tractor fleet', alts: ['Recognize lease liability at commencement, forklift fleet', 'Record finance lease obligation, plant vehicles'] },
    party: 'Ryder Logistics',
    partyKind: 'vendor',
    docTitle: 'Journal entry, fleet lease',
    doc: 'Right-of-use asset and lease liability recognized on the yard tractor fleet at lease commencement.',
  },
  {
    id: 'computer-equipment',
    size: 'small',
    cadence: 'low',
    source: 'Vendor Invoice',
    debit: { group: 'Property, Plant and Equipment', accounts: ['12135'], text: 'Record shop floor terminals, {qty} units', qty: [6, 30], alts: ['Record IT hardware, machine monitoring servers'] },
    credit: { group: 'Accounts Payable', accounts: ['21110'], text: 'Shop floor terminals and network hardware', alts: ['Machine monitoring servers and switching', 'Shop floor terminals, monitoring rollout'] },
    party: 'Dell Technologies',
    partyKind: 'vendor',
    docTitle: 'Vendor invoice, IT hardware',
    doc: 'Ruggedized shop floor terminals and switching hardware for the machine monitoring rollout.',
  },
  {
    id: 'depreciation-equipment',
    source: 'Manual JE',
    debit: { group: 'Depreciation and Amortization', accounts: ['52510'], text: 'Record {month} depreciation, machinery and tooling' },
    credit: { group: 'Property, Plant and Equipment', accounts: ['12150', '12155', '12160', '12165'], contra: true, text: 'Accumulate depreciation, CNC and stamping assets', alts: ['Accumulate depreciation, machining and tooling register', 'Accumulate depreciation, vehicles and IT hardware'] },
    docTitle: 'Journal entry, depreciation run',
    doc: 'Straight-line depreciation for the month across the machinery, tooling and vehicle registers.',
  },
  {
    id: 'asset-disposal-gain',
    size: 'small',
    cadence: 'low',
    source: 'Manual JE',
    debit: { group: 'Property, Plant and Equipment', accounts: ['12150'], contra: true, text: 'Release accumulated depreciation on disposal, retired grinding cell' },
    credit: { group: 'Other Revenue', accounts: ['42030'], text: 'Gain on disposal, retired grinding cell', alts: ['Gain on disposal, surplus press line', 'Gain on disposal, replaced inspection rig'] },
    docTitle: 'Journal entry, asset disposal',
    doc: 'Retirement of the grinding cell, with salvage proceeds above carrying value taken to gain.',
  },
  {
    id: 'goodwill-acquisition',
    size: 'large',
    cadence: 'low',
    source: 'Manual JE',
    debit: { group: 'Intangible Assets', accounts: ['12210'], text: 'Recognize goodwill on gearbox line acquisition', alts: ['Recognize goodwill on supplier book acquisition', 'Allocate excess consideration to goodwill'] },
    credit: { group: 'Long-Term Debt', accounts: ['22110'], text: 'Draw on term loan to fund the gearbox line acquisition', alts: ['Draw on term loan, acquisition consideration', 'Term loan drawn on acquisition completion'] },
    party: 'Vantage Gear Holdings',
    partyKind: 'vendor',
    docTitle: 'Journal entry, business combination',
    doc: 'Excess of consideration over net identifiable assets on the gearbox line acquisition, allocated to goodwill.',
  },
  {
    id: 'patent-filing',
    size: 'small',
    cadence: 'low',
    source: 'Vendor Invoice',
    debit: { group: 'Intangible Assets', accounts: ['12220'], text: 'Capitalize patent filing, sensor housing design', alts: ['Capitalize trademark registration, brand portfolio', 'Capitalize patent continuation, bracket geometry'] },
    credit: { group: 'Accounts Payable', accounts: ['21110'], text: 'Patent prosecution fees, sensor housing family', alts: ['Patent prosecution fees, bracket geometry continuation', 'Trademark registration fees, brand portfolio'] },
    party: 'Brinks Gilson',
    partyKind: 'vendor',
    docTitle: 'Vendor invoice, patent fees',
    doc: 'Filing and prosecution fees for the sensor housing patent family, capitalized as an intangible asset.',
  },
  {
    id: 'utility-supply-deposit',
    cadence: 'low',
    source: 'Vendor Payments',
    debit: { group: 'Other Non-Current Assets', accounts: ['12310'], text: 'Record long-term deposit, natural gas supply contract', alts: ['Record long-term deposit, industrial power contract', 'Record deposit held under the gas supply agreement'] },
    credit: { group: 'Cash and Cash Equivalents', accounts: ['11130'], text: 'Funding transfer, utility supply deposit', alts: ['Funding transfer, power contract deposit', 'Payment of deposit under the supply agreement'], appendRef: true },
    party: 'DTE Energy',
    partyKind: 'vendor',
    docTitle: 'Bank transaction, supply deposit',
    doc: 'Deposit required under the five year natural gas supply contract for the Plant 2 furnaces.',
  },
  {
    id: 'deferred-tax-asset',
    cadence: 'low',
    source: 'Manual JE',
    debit: { group: 'Other Non-Current Assets', accounts: ['12320'], text: 'Recognize deferred tax asset, timing differences', alts: ['Recognize deferred tax asset on accrued expenses', 'Recognize deferred tax asset on carried forward losses'] },
    credit: { group: 'EXPENSES', accounts: ['54000'], text: 'Reduce tax charge for deferred tax movement', alts: ['Credit tax charge for deferred tax recognized', 'Release tax charge on deferred tax movement'] },
    docTitle: 'Journal entry, deferred tax',
    doc: 'Deferred tax asset recognized on depreciation and accrual timing differences at the reporting date.',
  },
  {
    id: 'deferred-tax-liability',
    cadence: 'low',
    source: 'Manual JE',
    debit: { group: 'EXPENSES', accounts: ['54000'], text: 'Record deferred tax charge, accelerated allowances', alts: ['Record deferred tax charge on timing differences', 'Increase tax charge for deferred tax movement'] },
    credit: { group: 'Other Long-Term Liabilities', accounts: ['22210'], text: 'Recognize deferred tax liability, capital allowances', alts: ['Record deferred tax on accelerated allowances', 'Increase deferred tax liability, plant timing differences'] },
    docTitle: 'Journal entry, deferred tax',
    doc: 'Deferred tax liability arising on accelerated capital allowances claimed on plant and tooling.',
  },

  /* ----- Debt, tax and equity ----- */
  {
    id: 'mortgage-draw',
    size: 'large',
    cadence: 'low',
    source: 'Cash Management',
    debit: { group: 'Cash and Cash Equivalents', accounts: ['11130'], text: 'Mortgage advance received, Plant 2 refinance', alts: ['Mortgage advance received on refinance completion', 'Drawdown received, freehold mortgage facility'] },
    credit: { group: 'Long-Term Debt', accounts: ['22120'], text: 'Recognize mortgage principal, Plant 2 refinance', alts: ['Record mortgage drawdown, freehold security', 'Recognize mortgage balance on refinance completion'] },
    party: 'Fifth Third Bank',
    partyKind: 'bank',
    docTitle: 'Bank transaction, mortgage advance',
    doc: 'Drawdown on the Plant 2 mortgage refinance, secured on the freehold building.',
  },
  {
    id: 'revolver-draw',
    size: 'large',
    cadence: 'low',
    source: 'Cash Management',
    debit: { group: 'Cash and Cash Equivalents', accounts: ['11130'], text: 'Revolver drawdown received, working capital facility' },
    credit: { group: 'Short-Term Debt', accounts: ['21510'], text: 'Recognize revolver drawdown, working capital facility', alts: ['Record line of credit drawdown at period rate', 'Recognize facility balance drawn for the capacity programme'] },
    party: 'Chase Bank',
    partyKind: 'bank',
    docTitle: 'Bank advice, revolver drawdown',
    doc: 'Drawdown on the committed working capital facility to bridge the capacity expansion spend.',
  },
  {
    id: 'accrue-interest',
    size: 'small',
    source: 'Manual JE',
    debit: { group: 'Other Expenses', accounts: ['53010'], text: 'Accrue {month} interest, term loan and notes' },
    credit: { group: 'Accrued Liabilities', accounts: ['21320'], text: 'Recognize interest payable at period end', alts: ['Accrue interest payable to period end', 'Recognize unpaid interest at the reporting date'] },
    docTitle: 'Journal entry, interest accrual',
    doc: 'Interest accrued to period end on the term loan, mortgage and senior notes.',
  },
  {
    id: 'debt-reclass',
    cadence: 'low',
    source: 'Manual JE',
    debit: { group: 'Long-Term Debt', accounts: ['22110'], text: 'Reclassify notes payable due within twelve months', alts: ['Reclassify mortgage principal due within twelve months', 'Move current year principal out of long-term debt'] },
    credit: { group: 'Short-Term Debt', accounts: ['21520'], text: 'Record current portion of long-term debt', alts: ['Record principal due within twelve months', 'Reclassify next twelve months of scheduled principal'] },
    docTitle: 'Journal entry, debt reclassification',
    doc: 'Next twelve months of scheduled principal moved from long-term to current at the reporting date.',
  },
  {
    id: 'federal-tax-accrual',
    cadence: 'low',
    source: 'Manual JE',
    debit: { group: 'EXPENSES', accounts: ['54000'], text: 'Record federal income tax charge for the quarter' },
    credit: { group: 'Taxes Payable', accounts: ['21430'], text: 'Recognize federal income tax payable', alts: ['Record federal income tax payable for the quarter', 'Recognize federal tax liability on taxable profit'] },
    docTitle: 'Journal entry, tax provision',
    doc: 'Federal income tax provision for the quarter, computed on taxable profit before deferred tax.',
  },
  {
    id: 'state-tax-accrual',
    size: 'small',
    cadence: 'low',
    source: 'Manual JE',
    debit: { group: 'EXPENSES', accounts: ['54000'], text: 'Record Michigan corporate income tax charge' },
    credit: { group: 'Taxes Payable', accounts: ['21430'], text: 'Recognize state income tax payable', alts: ['Record Michigan income tax payable', 'Recognize state tax liability on apportioned income'] },
    party: 'Michigan Department of Treasury',
    partyKind: 'agency',
    docTitle: 'Journal entry, tax provision',
    doc: 'Michigan corporate income tax accrued on apportioned taxable income for the period.',
  },
  {
    id: 'late-fee',
    size: 'tiny',
    cadence: 'low',
    source: 'Cash Management',
    debit: { group: 'Other Expenses', accounts: ['53040'], text: 'Late filing penalty, sales tax return', alts: ['Penalty and interest, late payroll tax deposit', 'Penalty, late annual report filing'] },
    credit: { group: 'Cash and Cash Equivalents', accounts: ['11130'], text: 'Penalty settled by direct debit', alts: ['Penalty and interest settled by direct debit', 'Direct debit, assessed penalty and interest'], appendRef: true },
    party: 'Michigan Department of Treasury',
    partyKind: 'agency',
    docTitle: 'Bank transaction, penalty',
    doc: 'Penalty and interest assessed on a late sales tax return, settled by direct debit.',
  },
  {
    id: 'share-premium',
    size: 'large',
    cadence: 'low',
    source: 'Manual JE',
    debit: { group: 'Cash and Cash Equivalents', accounts: ['11130'], text: 'Subscription proceeds above par value', alts: ['Share premium element of subscription proceeds', 'Proceeds above nominal value on share issue'] },
    credit: { group: 'Contributed Capital', accounts: ['31020'], text: 'Record paid-in capital in excess of par', alts: ['Record share premium on subscription', 'Allocate subscription proceeds above nominal value'] },
    docTitle: 'Journal entry, share issue',
    doc: 'Portion of the subscription proceeds above nominal value, taken to additional paid-in capital.',
  },
  {
    id: 'petty-cash-float',
    size: 'tiny',
    cadence: 'high',
    source: 'Cash Management',
    debit: { group: 'Cash and Cash Equivalents', accounts: ['11120'], text: 'Replenish petty cash float, Plant 2 stores', alts: ['Replenish petty cash float, admin block', 'Restore stores petty cash to imprest level'] },
    credit: { group: 'Cash and Cash Equivalents', accounts: ['11130'], text: 'Cash withdrawal to top up plant float', alts: ['Cash withdrawal, petty cash replenishment', 'Withdrawal to restore the stores float'] },
    party: 'Chase Bank',
    partyKind: 'bank',
    docTitle: 'Bank transaction, cash withdrawal',
    doc: 'Withdrawal to restore the Plant 2 stores petty cash float to its imprest level.',
  },

  /* ----- Revenue, marketing and overheads ----- */
  {
    id: 'service-invoiced',
    cadence: 'high',
    source: 'Customer Invoice',
    debit: { group: 'Accounts Receivable', accounts: ['11310'], text: 'Invoice tooling maintenance services', alts: ['Invoice die maintenance services for the quarter', 'Invoice on-site tooling refurbishment'], appendRef: true },
    credit: { group: 'Operating Revenue', accounts: ['41030'], text: 'Recognize service revenue, die maintenance contract', alts: ['Recognize service revenue, tooling refurbishment', 'Recognize service revenue, on-site die repair', 'Recognize service revenue, line commissioning support', 'Recognize service revenue, gauge calibration visit'] },
    party: 'Continental Gearworks',
    partyKind: 'customer',
    docTitle: 'Customer invoice, services',
    doc: 'Quarterly die maintenance and refurbishment services delivered at the customer plant.',
  },
  {
    id: 'telemetry-subscription',
    size: 'small',
    source: 'Customer Invoice',
    debit: { group: 'Accounts Receivable', accounts: ['11310'], text: 'Invoice machine telemetry subscription', alts: ['Invoice monitored asset subscription', 'Invoice telemetry subscription for the month'], appendRef: true },
    credit: { group: 'Operating Revenue', accounts: ['41050'], text: 'Recognize subscription revenue, {qty} monitored assets', qty: [40, 260] },
    party: 'Fleetline Systems',
    partyKind: 'customer',
    docTitle: 'Customer invoice, subscription',
    doc: 'Monthly telemetry subscription across the customer monitored asset fleet.',
  },
  {
    id: 'license-royalty',
    size: 'small',
    cadence: 'low',
    source: 'Customer Invoice',
    debit: { group: 'Accounts Receivable', accounts: ['11310'], text: 'Invoice design licence royalty', alts: ['Invoice royalty on units produced under licence', 'Invoice quarterly design licence royalty'], appendRef: true },
    credit: { group: 'Operating Revenue', accounts: ['41040'], text: 'Recognize licensing revenue, sensor housing design', alts: ['Recognize licensing revenue, design royalty on units shipped', 'Recognize royalty revenue, sensor housing licence'] },
    party: 'Rheinmetall Automotive',
    partyKind: 'customer',
    docTitle: 'Customer invoice, royalty',
    doc: 'Royalty on units produced under the sensor housing design licence for the quarter.',
  },
  {
    id: 'early-settlement-discount',
    size: 'tiny',
    cadence: 'low',
    source: 'Customer payments',
    debit: { group: 'Operating Revenue', accounts: ['41080'], contra: true, text: 'Allow early settlement discount on finished goods invoice', alts: ['Allow settlement discount taken inside terms', 'Record early payment discount on customer settlement'] },
    credit: { group: 'Accounts Receivable', accounts: ['11310'], text: 'Reduce receivable for discount taken on payment', alts: ['Reduce receivable for settlement discount taken', 'Adjust receivable, discount allowed on early payment'] },
    party: 'Meridian Auto Parts',
    partyKind: 'customer',
    docTitle: 'Customer invoice, settlement discount',
    doc: 'Discount taken by the customer for settlement inside the agreed terms.',
  },
  {
    id: 'deferred-revenue',
    source: 'Manual JE',
    debit: { group: 'Other Current Liabilities', accounts: ['21610'], text: 'Release deferred revenue earned in {month}' },
    credit: { group: 'Operating Revenue', accounts: ['41050'], text: 'Recognize subscription revenue as service delivered', alts: ['Release deferred subscription revenue as earned', 'Recognize monitored asset subscription for the month'] },
    docTitle: 'Journal entry, revenue recognition',
    doc: 'Portion of prepaid subscription terms earned during the month, released from deferred revenue.',
  },
  {
    id: 'advertising',
    size: 'small',
    source: 'Vendor Invoice',
    debit: { group: 'Sales and Marketing', accounts: ['52210'], text: 'Trade press advertising, tier one supplier feature', alts: ['Trade press advertising, capability directory listing', 'Advertising, supplier profile in industry annual'] },
    credit: { group: 'Accounts Payable', accounts: ['21110'], text: 'Advertising placement, {month} trade press', alts: ['Advertising placement, industry directory listing', 'Advertising placement, supplier annual feature'] },
    party: 'Automotive News',
    partyKind: 'vendor',
    docTitle: 'Vendor invoice, advertising',
    doc: 'Print and digital placements in the trade press supplier feature for the month.',
  },
  {
    id: 'marketing-campaign',
    size: 'small',
    cadence: 'low',
    source: 'Vendor Invoice',
    debit: { group: 'Sales and Marketing', accounts: ['52220'], text: 'Campaign spend, lightweighting capability launch', alts: ['Campaign spend, e-mobility component programme', 'Campaign spend, quality accreditation announcement'] },
    credit: { group: 'Accounts Payable', accounts: ['21110'], text: 'Agency retainer and media, capability campaign', alts: ['Agency retainer and paid media, programme launch', 'Agency fees, campaign production and placement'] },
    party: 'Foundry Digital',
    partyKind: 'vendor',
    docTitle: 'Vendor invoice, marketing agency',
    doc: 'Agency retainer and paid media for the lightweighting capability launch campaign.',
  },
  {
    id: 'professional-fees',
    size: 'small',
    cadence: 'low',
    source: 'Vendor Invoice',
    debit: { group: 'General and Administrative', accounts: ['52350'], text: 'Professional fees, year end audit and tax', alts: ['Professional fees, transfer pricing review', 'Professional fees, statutory audit fieldwork'] },
    credit: { group: 'Accounts Payable', accounts: ['21110'], text: 'Audit and advisory fees, interim billing', alts: ['Audit fieldwork fees, interim billing', 'Tax compliance and advisory fees'] },
    party: 'Plante Moran',
    partyKind: 'vendor',
    docTitle: 'Vendor invoice, professional fees',
    doc: 'Interim billing for statutory audit fieldwork and corporate tax compliance.',
  },
  {
    id: 'telecom',
    size: 'small',
    source: 'Vendor Invoice',
    debit: { group: 'General and Administrative', accounts: ['52320'], text: 'Telephone and internet, plant and office circuits', alts: ['Telephone and internet, plant fibre circuit', 'Connectivity charges, mobile fleet and voice lines'] },
    credit: { group: 'Accounts Payable', accounts: ['21110'], text: '{month} connectivity, Plant 2 and admin block' },
    party: 'AT&T Business',
    partyKind: 'vendor',
    docTitle: 'Vendor invoice, connectivity',
    doc: 'Monthly charges for the plant fibre circuits, voice lines and mobile fleet.',
  },
  {
    id: 'equipment-financing',
    size: 'large',
    cadence: 'low',
    source: 'Manual JE',
    debit: { group: 'Property, Plant and Equipment', accounts: ['12120'], text: 'Record press line addition financed on note, Plant 2', alts: ['Record machining cell addition financed on note', 'Record inspection rig addition financed on note'] },
    credit: { group: 'Long-Term Debt', accounts: ['22130'], text: 'Recognize equipment financing note, press line', alts: ['Recognize equipment note at drawdown, machining cell', 'Record financing note principal, plant equipment'] },
    party: 'Fifth Third Bank',
    partyKind: 'bank',
    docTitle: 'Journal entry, equipment financing',
    doc: 'Press line addition funded on a five year equipment note secured on the asset itself.',
  },
  {
    id: 'tooling-program-billing',
    source: 'Customer Invoice',
    debit: { group: 'Accounts Receivable', accounts: ['11310'], text: 'Invoice tooling program milestone, ahead of build', appendRef: true },
    credit: { group: 'Other Current Liabilities', accounts: ['21630'], text: 'Defer tooling program billing until build complete', alts: ['Hold tooling milestone as unearned until acceptance', 'Defer program billing, build not yet started'] },
    party: 'Rheinmetall Automotive',
    partyKind: 'customer',
    docTitle: 'Customer invoice, tooling program',
    doc: 'Milestone billed on the tooling program before the build starts, held unearned until acceptance.',
  },
  {
    id: 'extended-service-plan',
    cadence: 'low',
    source: 'Customer Invoice',
    debit: { group: 'Accounts Receivable', accounts: ['11310'], text: 'Invoice {qty} year extended service plan', qty: [3, 5], appendRef: true },
    credit: { group: 'Other Long-Term Liabilities', accounts: ['22230'], text: 'Defer extended service plan beyond twelve months', alts: ['Defer multi-year service plan, portion due after one year', 'Hold long-term service revenue until the term is served'] },
    party: 'Volvo Trucks North America',
    partyKind: 'customer',
    docTitle: 'Customer invoice, extended service plan',
    doc: 'Multi-year service plan billed upfront, with the portion earned after twelve months held long term.',
  },
  {
    id: 'currency-translation',
    size: 'small',
    cadence: 'low',
    timing: 'period-end',
    source: 'Manual JE',
    debit: { group: 'Cash and Cash Equivalents', accounts: ['11160'], text: 'Retranslate GBP balance at closing rate' },
    credit: { group: 'EQUITY', accounts: ['34000'], text: 'Take translation difference to other comprehensive income', alts: ['Record translation reserve movement on the GBP balance', 'Recognize translation difference in the reserve'] },
    docTitle: 'Journal entry, currency translation',
    doc: 'Translation difference on the GBP balance taken to reserves rather than to income.',
  },
  {
    id: 'wholesale-order',
    cadence: 'high',
    source: 'Customer Invoice',
    debit: { group: 'Accounts Receivable', accounts: ['11310'], text: 'Invoice distributor order, {qty} caliper kits', qty: [400, 1800], appendRef: true },
    credit: { group: 'Operating Revenue', accounts: ['41020'], text: 'Recognize wholesale revenue, distributor price list', alts: ['Recognize wholesale revenue, aftermarket kit order', 'Recognize wholesale revenue, distributor stocking order'] },
    party: 'Genuine Parts Company',
    partyKind: 'customer',
    docTitle: 'Customer invoice, distributor order',
    doc: 'Aftermarket caliper kits shipped to the distributor at contracted wholesale prices.',
  },
  {
    id: 'freight-billed-on',
    size: 'small',
    cadence: 'high',
    source: 'Customer Invoice',
    debit: { group: 'Accounts Receivable', accounts: ['11310'], text: 'Invoice outbound freight on customer release', appendRef: true },
    credit: { group: 'Operating Revenue', accounts: ['41060'], text: 'Recognize shipping and handling recharged to customer', alts: ['Recognize freight recovery on expedited release', 'Recognize handling charge billed with the shipment'] },
    party: 'Meridian Auto Parts',
    partyKind: 'customer',
    docTitle: 'Customer invoice, outbound freight',
    doc: 'Outbound freight and handling recharged at cost plus the contracted handling margin.',
  },
  {
    id: 'engineering-payroll',
    source: 'Payroll',
    debit: { group: 'Research and Development', accounts: ['52410'], text: 'Engineering payroll, product development team, week {week}' },
    credit: { group: 'Accrued Liabilities', accounts: ['21310'], text: 'Clear accrued salaries, {qty} development engineers', qty: [8, 24] },
    docTitle: 'Payroll run, engineering staff',
    doc: 'Weekly run for the product development team, hours booked against open development projects.',
  },
  {
    id: 'prototype-materials',
    size: 'small',
    source: 'Vendor Invoice',
    debit: { group: 'Research and Development', accounts: ['52420'], text: 'Prototype materials, sensor housing trial build', alts: ['Prototype materials, caliper redesign trial', 'Test rig consumables, durability programme'] },
    credit: { group: 'Accounts Payable', accounts: ['21110'], text: 'Prototype material payable, development build', alts: ['Payable for trial build materials', 'Payable for test rig consumables'] },
    party: 'McMaster-Carr',
    partyKind: 'vendor',
    docTitle: 'Vendor invoice, prototype materials',
    doc: 'Bar stock, fasteners and instrumentation for the sensor housing trial build.',
  },
]

const SCENARIO_BY_ID = new Map(TX_SCENARIOS.map(s => [s.id, s]))

export const scenarioById = (id?: string): TxScenario | undefined => (id ? SCENARIO_BY_ID.get(id) : undefined)

/** The counterparty a posting's scenario names, when it names one. */
export const scenarioParty = (id?: string): string | undefined => scenarioById(id)?.party

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

// ISO-8601 week number, so "week 47" agrees with the date on the same row.
function isoWeek(iso: string): number {
  const d = new Date(`${iso.slice(0, 10)}T00:00:00.000Z`)
  const day = d.getUTCDay() || 7
  d.setUTCDate(d.getUTCDate() + 4 - day)
  const yearStart = Date.UTC(d.getUTCFullYear(), 0, 1)
  return Math.ceil(((+d - yearStart) / 86_400_000 + 1) / 7)
}

// A group holds far fewer scenarios than an account holds postings, so verbatim
// copy would repeat the same sentence twenty times down one register. The tokens
// vary the figures within a plausible band and tie the date-bearing ones to the
// posting's own date.
export function formatLeg(leg: ScenarioLeg, date: string, reference: string): string {
  const wordings = leg.alts ? [leg.text, ...leg.alts] : [leg.text]
  let text = wordings[Math.floor(Math.random() * wordings.length)]
  if (text.includes('{qty}')) {
    const [min, max] = leg.qty ?? [1, 99]
    const n = min + Math.floor(Math.random() * (max - min + 1))
    text = text.split('{qty}').join(n >= 1000 ? n.toLocaleString('en-US') : String(n))
  }
  if (text.includes('{week}')) text = text.split('{week}').join(String(isoWeek(date)))
  if (text.includes('{month}')) text = text.split('{month}').join(MONTHS[new Date(`${date.slice(0, 10)}T00:00:00.000Z`).getUTCMonth()])
  return leg.appendRef && reference ? `${text} ${reference}` : text
}
