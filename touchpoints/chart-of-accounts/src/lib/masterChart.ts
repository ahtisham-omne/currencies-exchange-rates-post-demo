// The canonical 143-account master chart from CoA_Guided_Wizard_and_Master_Chart.md,
// migrated to the five-Type + classification model (see ACCOUNTING_MODEL.md). Each entry
// carries a Type code and a classification; COGS is classification 'Cost of goods sold' inside
// Type EXP, and Other Income is classification 'Other income' inside Type REV. The guided wizard
// filters these entries against the user's answers (see wizardEngine.ts).

import type { AccountType, StatementClassification, AccountRole, NumberingScheme } from '../types'

export const masterChartNumberingScheme: NumberingScheme = {
  segments: [{ index: 0, length: 4, meaning: 'Account', separator: '' }],
}

export type WizardTrigger =
  | 'Always'
  | 'Accrual'
  | 'Inventory'
  | 'Payroll'
  | 'Sales Tax'
  | 'Fixed Assets'
  | 'Loans / Financing'
  | 'Multi-Currency'
  | 'Entity'
  | 'Entity: Sole Prop / Partnership'
  | 'Entity: Partnership / LLC'
  | 'Entity: Corp'
  | 'Entity: S-Corp'
  | 'Entity: C-Corp'
  | 'Industry: Construction'
  | 'Industry: SaaS'
  | 'Industry: Services'
  | 'Industry'
  | 'Optional'
  // Compound triggers used in the spec, kept as their exact string:
  | 'Inventory / Industry'
  | 'Inventory / Payroll'
  | 'Accrual / SaaS'
  | 'Entity: S-Corp / Payroll'

export interface MasterChartEntry {
  number: string
  name: string
  type: AccountType                 // 'AST' | 'LIA' | 'EQT' | 'REV' | 'EXP'
  statementClassification: StatementClassification
  isContra?: boolean
  parentNumber: string | null
  posting: 'Posting' | 'Summary'
  wizardTrigger: WizardTrigger
  description: string
  // Optional explicit denomination (ISO code). Set on the overseas bank
  // accounts; everything else defaults to the tenant base currency (USD).
  currency?: string
}

export const MASTER_CHART: MasterChartEntry[] = [
  // ===== Assets =====
  { number: '1000', name: 'Assets', type: 'AST', statementClassification: 'Current asset', parentNumber: null, posting: 'Summary', wizardTrigger: 'Always', description: 'Everything the business owns' },
  { number: '1010', name: 'Current Assets', type: 'AST', statementClassification: 'Current asset', parentNumber: '1000', posting: 'Summary', wizardTrigger: 'Always', description: 'Assets expected to convert to cash within one year' },
  { number: '1020', name: 'Operating Bank Account', type: 'AST', statementClassification: 'Current asset', parentNumber: '1010', posting: 'Posting', wizardTrigger: 'Always', description: 'Primary checking / operating cash' },
  // Overseas bank accounts, held in foreign currencies (FX revaluation applies).
  { number: '1021', name: 'Deutsche Bank Frankfurt', type: 'AST', statementClassification: 'Current asset', parentNumber: '1010', posting: 'Posting', wizardTrigger: 'Multi-Currency', description: 'Euro-denominated operating account', currency: 'EUR' },
  { number: '1022', name: 'HSBC Hong Kong', type: 'AST', statementClassification: 'Current asset', parentNumber: '1010', posting: 'Posting', wizardTrigger: 'Multi-Currency', description: 'Hong Kong dollar operating account', currency: 'HKD' },
  { number: '1023', name: 'MUFG Bank Tokyo', type: 'AST', statementClassification: 'Current asset', parentNumber: '1010', posting: 'Posting', wizardTrigger: 'Multi-Currency', description: 'Japanese yen operating account', currency: 'JPY' },
  { number: '1025', name: 'Payroll Bank Account', type: 'AST', statementClassification: 'Current asset', parentNumber: '1010', posting: 'Posting', wizardTrigger: 'Payroll', description: 'Separate account used for payroll disbursements' },
  { number: '1030', name: 'Savings / Reserve Account', type: 'AST', statementClassification: 'Current asset', parentNumber: '1010', posting: 'Posting', wizardTrigger: 'Always', description: 'Reserve or savings cash' },
  { number: '1040', name: 'Petty Cash', type: 'AST', statementClassification: 'Current asset', parentNumber: '1010', posting: 'Posting', wizardTrigger: 'Always', description: 'Small on-hand cash for minor expenses' },
  { number: '1050', name: 'Undeposited Funds', type: 'AST', statementClassification: 'Current asset', parentNumber: '1010', posting: 'Posting', wizardTrigger: 'Always', description: 'Payments received but not yet deposited' },
  { number: '1060', name: 'Short-Term Investments', type: 'AST', statementClassification: 'Current asset', parentNumber: '1010', posting: 'Posting', wizardTrigger: 'Always', description: 'Marketable securities maturing within a year' },
  { number: '1100', name: 'Accounts Receivable', type: 'AST', statementClassification: 'Current asset', parentNumber: '1010', posting: 'Posting', wizardTrigger: 'Accrual', description: 'Amounts owed by customers on credit' },
  { number: '1110', name: 'Allowance for Doubtful Accounts', type: 'AST', statementClassification: 'Current asset', isContra: true, parentNumber: '1010', posting: 'Posting', wizardTrigger: 'Accrual', description: 'Estimated uncollectible receivables (contra-asset)' },
  { number: '1150', name: 'Employee Advances', type: 'AST', statementClassification: 'Current asset', parentNumber: '1010', posting: 'Posting', wizardTrigger: 'Payroll', description: 'Advances or short-term loans to employees' },
  { number: '1200', name: 'Inventory', type: 'AST', statementClassification: 'Current asset', parentNumber: '1010', posting: 'Summary', wizardTrigger: 'Inventory', description: 'Goods held for sale or production' },
  { number: '1210', name: 'Inventory - Raw Materials', type: 'AST', statementClassification: 'Current asset', parentNumber: '1200', posting: 'Posting', wizardTrigger: 'Inventory', description: 'Materials awaiting production' },
  { number: '1220', name: 'Inventory - Work in Process', type: 'AST', statementClassification: 'Current asset', parentNumber: '1200', posting: 'Posting', wizardTrigger: 'Inventory / Industry', description: 'Partially completed goods / jobs (mfg, construction)' },
  { number: '1230', name: 'Inventory - Finished Goods', type: 'AST', statementClassification: 'Current asset', parentNumber: '1200', posting: 'Posting', wizardTrigger: 'Inventory', description: 'Completed goods ready for sale' },
  { number: '1300', name: 'Prepaid Expenses', type: 'AST', statementClassification: 'Current asset', parentNumber: '1010', posting: 'Summary', wizardTrigger: 'Accrual', description: 'Costs paid in advance of the benefit period' },
  { number: '1310', name: 'Prepaid Insurance', type: 'AST', statementClassification: 'Current asset', parentNumber: '1300', posting: 'Posting', wizardTrigger: 'Accrual', description: 'Insurance paid ahead of coverage period' },
  { number: '1320', name: 'Prepaid Rent', type: 'AST', statementClassification: 'Current asset', parentNumber: '1300', posting: 'Posting', wizardTrigger: 'Accrual', description: 'Rent paid in advance' },
  { number: '1330', name: 'Prepaid Subscriptions', type: 'AST', statementClassification: 'Current asset', parentNumber: '1300', posting: 'Posting', wizardTrigger: 'Accrual', description: 'Software / service fees paid in advance' },
  { number: '1400', name: 'Supplies on Hand', type: 'AST', statementClassification: 'Current asset', parentNumber: '1010', posting: 'Posting', wizardTrigger: 'Always', description: 'Unused supplies held as an asset' },
  { number: '1450', name: 'Other Current Assets', type: 'AST', statementClassification: 'Current asset', parentNumber: '1010', posting: 'Posting', wizardTrigger: 'Always', description: 'Miscellaneous short-term assets' },
  { number: '1500', name: 'Fixed Assets', type: 'AST', statementClassification: 'Non-current asset', parentNumber: '1000', posting: 'Summary', wizardTrigger: 'Fixed Assets', description: 'Long-lived assets used in operations' },
  { number: '1510', name: 'Land', type: 'AST', statementClassification: 'Non-current asset', parentNumber: '1500', posting: 'Posting', wizardTrigger: 'Fixed Assets', description: 'Land (not depreciated)' },
  { number: '1520', name: 'Buildings', type: 'AST', statementClassification: 'Non-current asset', parentNumber: '1500', posting: 'Posting', wizardTrigger: 'Fixed Assets', description: 'Owned buildings / facilities' },
  { number: '1525', name: 'Accum. Depreciation - Buildings', type: 'AST', statementClassification: 'Non-current asset', isContra: true, parentNumber: '1500', posting: 'Posting', wizardTrigger: 'Fixed Assets', description: 'Accumulated depreciation on buildings (contra)' },
  { number: '1530', name: 'Leasehold Improvements', type: 'AST', statementClassification: 'Non-current asset', parentNumber: '1500', posting: 'Posting', wizardTrigger: 'Fixed Assets', description: 'Improvements to leased premises' },
  { number: '1540', name: 'Machinery & Equipment', type: 'AST', statementClassification: 'Non-current asset', parentNumber: '1500', posting: 'Posting', wizardTrigger: 'Fixed Assets', description: 'Production / operating equipment' },
  { number: '1545', name: 'Accum. Depreciation - Equipment', type: 'AST', statementClassification: 'Non-current asset', isContra: true, parentNumber: '1500', posting: 'Posting', wizardTrigger: 'Fixed Assets', description: 'Accumulated depreciation on equipment (contra)' },
  { number: '1550', name: 'Vehicles', type: 'AST', statementClassification: 'Non-current asset', parentNumber: '1500', posting: 'Posting', wizardTrigger: 'Fixed Assets', description: 'Company vehicles' },
  { number: '1555', name: 'Accum. Depreciation - Vehicles', type: 'AST', statementClassification: 'Non-current asset', isContra: true, parentNumber: '1500', posting: 'Posting', wizardTrigger: 'Fixed Assets', description: 'Accumulated depreciation on vehicles (contra)' },
  { number: '1560', name: 'Furniture & Fixtures', type: 'AST', statementClassification: 'Non-current asset', parentNumber: '1500', posting: 'Posting', wizardTrigger: 'Fixed Assets', description: 'Office furniture and fixtures' },
  { number: '1565', name: 'Accum. Depreciation - Furniture', type: 'AST', statementClassification: 'Non-current asset', isContra: true, parentNumber: '1500', posting: 'Posting', wizardTrigger: 'Fixed Assets', description: 'Accumulated depreciation on furniture (contra)' },
  { number: '1570', name: 'Computer & Office Equipment', type: 'AST', statementClassification: 'Non-current asset', parentNumber: '1500', posting: 'Posting', wizardTrigger: 'Fixed Assets', description: 'Computers, servers, office hardware' },
  { number: '1600', name: 'Intangible Assets', type: 'AST', statementClassification: 'Non-current asset', parentNumber: '1500', posting: 'Summary', wizardTrigger: 'Fixed Assets', description: 'Non-physical long-term assets' },
  { number: '1610', name: 'Goodwill', type: 'AST', statementClassification: 'Non-current asset', parentNumber: '1600', posting: 'Posting', wizardTrigger: 'Fixed Assets', description: 'Premium paid on acquisitions' },
  { number: '1620', name: 'Patents & Trademarks', type: 'AST', statementClassification: 'Non-current asset', parentNumber: '1600', posting: 'Posting', wizardTrigger: 'Fixed Assets', description: 'Registered intellectual property' },
  { number: '1630', name: 'Accumulated Amortization', type: 'AST', statementClassification: 'Non-current asset', isContra: true, parentNumber: '1600', posting: 'Posting', wizardTrigger: 'Fixed Assets', description: 'Accumulated amortization on intangibles (contra)' },
  { number: '1700', name: 'Other Non-Current Assets', type: 'AST', statementClassification: 'Non-current asset', parentNumber: '1500', posting: 'Summary', wizardTrigger: 'Always', description: 'Other long-term assets' },
  { number: '1710', name: 'Long-Term Investments', type: 'AST', statementClassification: 'Non-current asset', parentNumber: '1700', posting: 'Posting', wizardTrigger: 'Always', description: 'Investments held beyond one year' },
  { number: '1720', name: 'Security Deposits', type: 'AST', statementClassification: 'Non-current asset', parentNumber: '1700', posting: 'Posting', wizardTrigger: 'Always', description: 'Deposits held by landlords / vendors' },

  // ===== Liabilities =====
  { number: '2000', name: 'Liabilities', type: 'LIA', statementClassification: 'Current liability', parentNumber: null, posting: 'Summary', wizardTrigger: 'Always', description: 'Everything the business owes' },
  { number: '2010', name: 'Current Liabilities', type: 'LIA', statementClassification: 'Current liability', parentNumber: '2000', posting: 'Summary', wizardTrigger: 'Always', description: 'Obligations due within one year' },
  { number: '2020', name: 'Accounts Payable', type: 'LIA', statementClassification: 'Current liability', parentNumber: '2010', posting: 'Posting', wizardTrigger: 'Accrual', description: 'Amounts owed to vendors' },
  { number: '2030', name: 'Credit Card Payable', type: 'LIA', statementClassification: 'Current liability', parentNumber: '2010', posting: 'Posting', wizardTrigger: 'Loans / Financing', description: 'Outstanding credit-card balances' },
  { number: '2100', name: 'Accrued Liabilities', type: 'LIA', statementClassification: 'Current liability', parentNumber: '2010', posting: 'Summary', wizardTrigger: 'Accrual', description: 'Expenses incurred but not yet paid' },
  { number: '2110', name: 'Accrued Wages Payable', type: 'LIA', statementClassification: 'Current liability', parentNumber: '2100', posting: 'Posting', wizardTrigger: 'Payroll', description: 'Earned but unpaid wages' },
  { number: '2120', name: 'Accrued Interest Payable', type: 'LIA', statementClassification: 'Current liability', parentNumber: '2100', posting: 'Posting', wizardTrigger: 'Loans / Financing', description: 'Interest incurred but not yet paid' },
  { number: '2200', name: 'Payroll Liabilities', type: 'LIA', statementClassification: 'Current liability', parentNumber: '2010', posting: 'Summary', wizardTrigger: 'Payroll', description: 'Amounts withheld / owed from payroll' },
  { number: '2210', name: 'Income Tax Withholding Payable', type: 'LIA', statementClassification: 'Current liability', parentNumber: '2200', posting: 'Posting', wizardTrigger: 'Payroll', description: 'Employee income tax withheld, owed to authority' },
  { number: '2220', name: 'Payroll Taxes Payable', type: 'LIA', statementClassification: 'Current liability', parentNumber: '2200', posting: 'Posting', wizardTrigger: 'Payroll', description: 'Employer and employee payroll taxes owed' },
  { number: '2230', name: 'Employee Benefits Payable', type: 'LIA', statementClassification: 'Current liability', parentNumber: '2200', posting: 'Posting', wizardTrigger: 'Payroll', description: 'Benefit deductions owed to providers' },
  { number: '2300', name: 'Sales Tax / VAT / GST Payable', type: 'LIA', statementClassification: 'Current liability', parentNumber: '2010', posting: 'Posting', wizardTrigger: 'Sales Tax', description: 'Tax collected from customers, owed to authority' },
  { number: '2400', name: 'Unearned / Deferred Revenue', type: 'LIA', statementClassification: 'Current liability', parentNumber: '2010', posting: 'Posting', wizardTrigger: 'Accrual / SaaS', description: 'Payments received before revenue is earned' },
  { number: '2450', name: 'Customer Deposits', type: 'LIA', statementClassification: 'Current liability', parentNumber: '2010', posting: 'Posting', wizardTrigger: 'Always', description: 'Prepayments or retainers held for customers' },
  { number: '2500', name: 'Current Portion of Long-Term Debt', type: 'LIA', statementClassification: 'Current liability', parentNumber: '2010', posting: 'Posting', wizardTrigger: 'Loans / Financing', description: 'Portion of long-term debt due within a year' },
  { number: '2600', name: 'Income Tax Payable', type: 'LIA', statementClassification: 'Current liability', parentNumber: '2010', posting: 'Posting', wizardTrigger: 'Entity: Corp', description: 'Corporate income tax owed' },
  { number: '2700', name: 'Long-Term Liabilities', type: 'LIA', statementClassification: 'Non-current liability', parentNumber: '2000', posting: 'Summary', wizardTrigger: 'Loans / Financing', description: 'Obligations due beyond one year' },
  { number: '2710', name: 'Notes / Loans Payable', type: 'LIA', statementClassification: 'Non-current liability', parentNumber: '2700', posting: 'Posting', wizardTrigger: 'Loans / Financing', description: 'Long-term loans and notes' },
  { number: '2720', name: 'Mortgage Payable', type: 'LIA', statementClassification: 'Non-current liability', parentNumber: '2700', posting: 'Posting', wizardTrigger: 'Loans / Financing', description: 'Property mortgage balances' },
  { number: '2730', name: 'Lease Liabilities', type: 'LIA', statementClassification: 'Non-current liability', parentNumber: '2700', posting: 'Posting', wizardTrigger: 'Loans / Financing', description: 'Capitalized lease obligations' },
  { number: '2800', name: 'Shareholder / Partner Loans', type: 'LIA', statementClassification: 'Non-current liability', parentNumber: '2700', posting: 'Posting', wizardTrigger: 'Entity', description: 'Loans from owners to the business' },
  { number: '2900', name: 'Deferred Tax Liability', type: 'LIA', statementClassification: 'Non-current liability', parentNumber: '2700', posting: 'Posting', wizardTrigger: 'Entity: Corp', description: 'Taxes deferred to future periods' },

  // ===== Equity =====
  { number: '3000', name: 'Equity', type: 'EQT', statementClassification: 'Contributed capital', parentNumber: null, posting: 'Summary', wizardTrigger: 'Always', description: 'Residual value of the business after liabilities' },
  { number: '3010', name: "Owner's Capital", type: 'EQT', statementClassification: 'Contributed capital', parentNumber: '3000', posting: 'Posting', wizardTrigger: 'Entity: Sole Prop / Partnership', description: 'Owner contributions / capital' },
  { number: '3020', name: "Owner's Draw", type: 'EQT', statementClassification: 'Distributions', isContra: true, parentNumber: '3000', posting: 'Posting', wizardTrigger: 'Entity: Sole Prop / Partnership', description: 'Owner withdrawals (contra-equity)' },
  { number: '3030', name: 'Partner Capital', type: 'EQT', statementClassification: 'Contributed capital', parentNumber: '3000', posting: 'Posting', wizardTrigger: 'Entity: Partnership / LLC', description: 'Per-partner capital accounts' },
  { number: '3040', name: 'Partner Distributions', type: 'EQT', statementClassification: 'Distributions', isContra: true, parentNumber: '3000', posting: 'Posting', wizardTrigger: 'Entity: Partnership / LLC', description: 'Per-partner distributions (contra-equity)' },
  { number: '3100', name: 'Common Stock', type: 'EQT', statementClassification: 'Contributed capital', parentNumber: '3000', posting: 'Posting', wizardTrigger: 'Entity: Corp', description: 'Par value of issued common shares' },
  { number: '3110', name: 'Preferred Stock', type: 'EQT', statementClassification: 'Contributed capital', parentNumber: '3000', posting: 'Posting', wizardTrigger: 'Entity: C-Corp', description: 'Par value of issued preferred shares' },
  { number: '3120', name: 'Additional Paid-In Capital', type: 'EQT', statementClassification: 'Contributed capital', parentNumber: '3000', posting: 'Posting', wizardTrigger: 'Entity: Corp', description: 'Capital contributed above par' },
  { number: '3200', name: 'Shareholder Distributions', type: 'EQT', statementClassification: 'Distributions', isContra: true, parentNumber: '3000', posting: 'Posting', wizardTrigger: 'Entity: S-Corp', description: 'Distributions to shareholders (contra-equity)' },
  { number: '3210', name: 'Dividends Payable', type: 'EQT', statementClassification: 'Distributions', isContra: true, parentNumber: '3000', posting: 'Posting', wizardTrigger: 'Entity: C-Corp', description: 'Declared dividends not yet paid' },
  { number: '3500', name: 'Opening Balance Equity', type: 'EQT', statementClassification: 'Contributed capital', parentNumber: '3000', posting: 'Posting', wizardTrigger: 'Always', description: 'System account used during migration / setup' },
  { number: '3900', name: 'Retained Earnings', type: 'EQT', statementClassification: 'Retained earnings', parentNumber: '3000', posting: 'Posting', wizardTrigger: 'Always', description: 'Accumulated earnings kept in the business. The year end close posts to it' },

  // ===== Revenue =====
  { number: '4000', name: 'Revenue', type: 'REV', statementClassification: 'Operating revenue', parentNumber: null, posting: 'Summary', wizardTrigger: 'Always', description: 'Income from primary business activities' },
  { number: '4010', name: 'Product Sales', type: 'REV', statementClassification: 'Operating revenue', parentNumber: '4000', posting: 'Posting', wizardTrigger: 'Inventory', description: 'Revenue from selling products' },
  { number: '4020', name: 'Service Revenue', type: 'REV', statementClassification: 'Operating revenue', parentNumber: '4000', posting: 'Posting', wizardTrigger: 'Industry: Services', description: 'Revenue from providing services' },
  { number: '4030', name: 'Subscription Revenue', type: 'REV', statementClassification: 'Operating revenue', parentNumber: '4000', posting: 'Posting', wizardTrigger: 'Industry: SaaS', description: 'Recurring subscription income' },
  { number: '4040', name: 'Contract Revenue', type: 'REV', statementClassification: 'Operating revenue', parentNumber: '4000', posting: 'Posting', wizardTrigger: 'Industry: Construction', description: 'Revenue recognized on contracts / jobs' },
  { number: '4100', name: 'Shipping & Handling Income', type: 'REV', statementClassification: 'Operating revenue', parentNumber: '4000', posting: 'Posting', wizardTrigger: 'Inventory', description: 'Shipping charged to customers' },
  { number: '4200', name: 'Sales Returns & Allowances', type: 'REV', statementClassification: 'Operating revenue', isContra: true, parentNumber: '4000', posting: 'Posting', wizardTrigger: 'Inventory', description: 'Refunds and allowances (contra-revenue)' },
  { number: '4210', name: 'Sales Discounts', type: 'REV', statementClassification: 'Operating revenue', isContra: true, parentNumber: '4000', posting: 'Posting', wizardTrigger: 'Always', description: 'Discounts given to customers (contra-revenue)' },
  { number: '4500', name: 'Other Income', type: 'REV', statementClassification: 'Other income', parentNumber: '4000', posting: 'Summary', wizardTrigger: 'Always', description: 'Income outside core operations' },
  { number: '4510', name: 'Interest Income', type: 'REV', statementClassification: 'Other income', parentNumber: '4500', posting: 'Posting', wizardTrigger: 'Always', description: 'Interest earned on cash / investments' },
  { number: '4520', name: 'Realized FX Gain', type: 'REV', statementClassification: 'Other income', parentNumber: '4500', posting: 'Posting', wizardTrigger: 'Multi-Currency', description: 'Gains on settled foreign-currency transactions' },
  { number: '4530', name: 'Unrealized FX Gain', type: 'REV', statementClassification: 'Other income', parentNumber: '4500', posting: 'Posting', wizardTrigger: 'Multi-Currency', description: 'Gains on revaluing open FX balances' },
  { number: '4540', name: 'Gain on Sale of Assets', type: 'REV', statementClassification: 'Other income', parentNumber: '4500', posting: 'Posting', wizardTrigger: 'Fixed Assets', description: 'Gain on disposal of fixed assets' },
  { number: '4900', name: 'Other Operating Revenue', type: 'REV', statementClassification: 'Other income', parentNumber: '4000', posting: 'Posting', wizardTrigger: 'Always', description: 'Miscellaneous operating income' },
  { number: '4990', name: 'Other Miscellaneous Income', type: 'REV', statementClassification: 'Other income', parentNumber: '4500', posting: 'Posting', wizardTrigger: 'Always', description: 'Other non-operating income' },

  // ===== Expenses =====
  { number: '5000', name: 'Cost of Goods Sold', type: 'EXP', statementClassification: 'Cost of goods sold', parentNumber: null, posting: 'Summary', wizardTrigger: 'Inventory / Industry', description: 'Direct cost of goods or services sold' },
  { number: '5010', name: 'COGS - Materials / Products', type: 'EXP', statementClassification: 'Cost of goods sold', parentNumber: '5000', posting: 'Posting', wizardTrigger: 'Inventory', description: 'Cost of products / materials sold' },
  { number: '5020', name: 'COGS - Direct Labor', type: 'EXP', statementClassification: 'Cost of goods sold', parentNumber: '5000', posting: 'Posting', wizardTrigger: 'Inventory / Payroll', description: 'Labor directly tied to production' },
  { number: '5030', name: 'Freight & Shipping In', type: 'EXP', statementClassification: 'Cost of goods sold', parentNumber: '5000', posting: 'Posting', wizardTrigger: 'Inventory', description: 'Inbound freight on purchased goods' },
  { number: '5040', name: 'Job Materials', type: 'EXP', statementClassification: 'Cost of goods sold', parentNumber: '5000', posting: 'Posting', wizardTrigger: 'Industry: Construction', description: 'Materials charged to jobs' },
  { number: '5050', name: 'Subcontractor Costs', type: 'EXP', statementClassification: 'Cost of goods sold', parentNumber: '5000', posting: 'Posting', wizardTrigger: 'Industry: Construction', description: 'Subcontracted labor on jobs' },
  { number: '5060', name: 'Merchant / Processing Fees', type: 'EXP', statementClassification: 'Cost of goods sold', parentNumber: '5000', posting: 'Posting', wizardTrigger: 'Inventory', description: 'Payment-processing fees on sales' },
  { number: '5070', name: 'Inventory Adjustments / Shrinkage', type: 'EXP', statementClassification: 'Cost of goods sold', parentNumber: '5000', posting: 'Posting', wizardTrigger: 'Inventory', description: 'Write-downs, shrinkage, count adjustments' },
  { number: '5100', name: 'Cost of Services', type: 'EXP', statementClassification: 'Cost of goods sold', parentNumber: '5000', posting: 'Posting', wizardTrigger: 'Industry: Services', description: 'Direct cost of delivering services' },
  { number: '6000', name: 'Operating Expenses', type: 'EXP', statementClassification: 'Operating expense', parentNumber: null, posting: 'Summary', wizardTrigger: 'Always', description: 'Costs of running the business' },
  { number: '6010', name: 'Payroll & Benefits', type: 'EXP', statementClassification: 'Operating expense', parentNumber: '6000', posting: 'Summary', wizardTrigger: 'Payroll', description: 'Compensation-related expenses' },
  { number: '6020', name: 'Wages & Salaries', type: 'EXP', statementClassification: 'Operating expense', parentNumber: '6010', posting: 'Posting', wizardTrigger: 'Payroll', description: 'Employee wages and salaries' },
  { number: '6030', name: 'Officer / Shareholder Salary', type: 'EXP', statementClassification: 'Operating expense', parentNumber: '6010', posting: 'Posting', wizardTrigger: 'Entity: S-Corp / Payroll', description: 'Salary paid to owner-officers' },
  { number: '6040', name: 'Payroll Tax Expense', type: 'EXP', statementClassification: 'Operating expense', parentNumber: '6010', posting: 'Posting', wizardTrigger: 'Payroll', description: 'Employer share of payroll taxes' },
  { number: '6050', name: 'Employee Benefits', type: 'EXP', statementClassification: 'Operating expense', parentNumber: '6010', posting: 'Posting', wizardTrigger: 'Payroll', description: 'Health, retirement, and other benefits' },
  { number: '6060', name: 'Contract Labor (1099)', type: 'EXP', statementClassification: 'Operating expense', parentNumber: '6010', posting: 'Posting', wizardTrigger: 'Always', description: 'Payments to contractors' },
  { number: '6100', name: 'Occupancy', type: 'EXP', statementClassification: 'Operating expense', parentNumber: '6000', posting: 'Summary', wizardTrigger: 'Always', description: 'Premises-related costs' },
  { number: '6110', name: 'Rent Expense', type: 'EXP', statementClassification: 'Operating expense', parentNumber: '6100', posting: 'Posting', wizardTrigger: 'Always', description: 'Office / facility rent' },
  { number: '6120', name: 'Utilities', type: 'EXP', statementClassification: 'Operating expense', parentNumber: '6100', posting: 'Posting', wizardTrigger: 'Always', description: 'Electricity, water, gas' },
  { number: '6130', name: 'Repairs & Maintenance', type: 'EXP', statementClassification: 'Operating expense', parentNumber: '6100', posting: 'Posting', wizardTrigger: 'Always', description: 'Upkeep of premises and equipment' },
  { number: '6140', name: 'Property Tax', type: 'EXP', statementClassification: 'Operating expense', parentNumber: '6100', posting: 'Posting', wizardTrigger: 'Fixed Assets', description: 'Tax on owned property' },
  { number: '6200', name: 'Office & Admin', type: 'EXP', statementClassification: 'Operating expense', parentNumber: '6000', posting: 'Summary', wizardTrigger: 'Always', description: 'General office and administrative costs' },
  { number: '6210', name: 'Office Supplies', type: 'EXP', statementClassification: 'Operating expense', parentNumber: '6200', posting: 'Posting', wizardTrigger: 'Always', description: 'Consumable office supplies' },
  { number: '6220', name: 'Software & Subscriptions', type: 'EXP', statementClassification: 'Operating expense', parentNumber: '6200', posting: 'Posting', wizardTrigger: 'Always', description: 'SaaS tools and software licenses' },
  { number: '6230', name: 'Telephone & Internet', type: 'EXP', statementClassification: 'Operating expense', parentNumber: '6200', posting: 'Posting', wizardTrigger: 'Always', description: 'Communications services' },
  { number: '6240', name: 'Postage & Shipping', type: 'EXP', statementClassification: 'Operating expense', parentNumber: '6200', posting: 'Posting', wizardTrigger: 'Always', description: 'Outbound postage and courier' },
  { number: '6300', name: 'Sales & Marketing', type: 'EXP', statementClassification: 'Operating expense', parentNumber: '6000', posting: 'Summary', wizardTrigger: 'Always', description: 'Customer acquisition costs' },
  { number: '6310', name: 'Advertising & Promotion', type: 'EXP', statementClassification: 'Operating expense', parentNumber: '6300', posting: 'Posting', wizardTrigger: 'Always', description: 'Advertising and promotional spend' },
  { number: '6320', name: 'Travel', type: 'EXP', statementClassification: 'Operating expense', parentNumber: '6300', posting: 'Posting', wizardTrigger: 'Always', description: 'Business travel' },
  { number: '6330', name: 'Meals & Entertainment', type: 'EXP', statementClassification: 'Operating expense', parentNumber: '6300', posting: 'Posting', wizardTrigger: 'Always', description: 'Business meals and entertainment' },
  { number: '6400', name: 'Professional Services', type: 'EXP', statementClassification: 'Operating expense', parentNumber: '6000', posting: 'Summary', wizardTrigger: 'Always', description: 'Outside professional fees' },
  { number: '6410', name: 'Legal Fees', type: 'EXP', statementClassification: 'Operating expense', parentNumber: '6400', posting: 'Posting', wizardTrigger: 'Always', description: 'Legal counsel fees' },
  { number: '6420', name: 'Accounting Fees', type: 'EXP', statementClassification: 'Operating expense', parentNumber: '6400', posting: 'Posting', wizardTrigger: 'Always', description: 'Accounting and audit fees' },
  { number: '6430', name: 'Consulting Fees', type: 'EXP', statementClassification: 'Operating expense', parentNumber: '6400', posting: 'Posting', wizardTrigger: 'Always', description: 'Consulting and advisory fees' },
  { number: '6500', name: 'Insurance Expense', type: 'EXP', statementClassification: 'Operating expense', parentNumber: '6000', posting: 'Posting', wizardTrigger: 'Always', description: 'Business insurance premiums' },
  { number: '6510', name: 'Bank Service Charges', type: 'EXP', statementClassification: 'Operating expense', parentNumber: '6000', posting: 'Posting', wizardTrigger: 'Always', description: 'Bank and merchant fees' },
  { number: '6600', name: 'Depreciation Expense', type: 'EXP', statementClassification: 'Operating expense', parentNumber: '6000', posting: 'Posting', wizardTrigger: 'Fixed Assets', description: 'Periodic depreciation of fixed assets' },
  { number: '6610', name: 'Amortization Expense', type: 'EXP', statementClassification: 'Operating expense', parentNumber: '6000', posting: 'Posting', wizardTrigger: 'Fixed Assets', description: 'Periodic amortization of intangibles' },
  { number: '6700', name: 'Bad Debt Expense', type: 'EXP', statementClassification: 'Operating expense', parentNumber: '6000', posting: 'Posting', wizardTrigger: 'Accrual', description: 'Receivables written off as uncollectible' },
  { number: '6800', name: 'Dues & Subscriptions', type: 'EXP', statementClassification: 'Operating expense', parentNumber: '6000', posting: 'Posting', wizardTrigger: 'Always', description: 'Memberships and professional dues' },
  { number: '6810', name: 'Training & Education', type: 'EXP', statementClassification: 'Operating expense', parentNumber: '6000', posting: 'Posting', wizardTrigger: 'Always', description: 'Staff training and development' },
  { number: '6900', name: 'Miscellaneous Expense', type: 'EXP', statementClassification: 'Operating expense', parentNumber: '6000', posting: 'Posting', wizardTrigger: 'Always', description: 'Uncategorized operating costs' },
  { number: '8000', name: 'Other Expense', type: 'EXP', statementClassification: 'Other expense', parentNumber: null, posting: 'Summary', wizardTrigger: 'Always', description: 'Costs outside core operations' },
  { number: '8010', name: 'Interest Expense', type: 'EXP', statementClassification: 'Other expense', parentNumber: '8000', posting: 'Posting', wizardTrigger: 'Loans / Financing', description: 'Interest paid on debt' },
  { number: '8020', name: 'Realized FX Loss', type: 'EXP', statementClassification: 'Other expense', parentNumber: '8000', posting: 'Posting', wizardTrigger: 'Multi-Currency', description: 'Losses on settled foreign-currency transactions' },
  { number: '8030', name: 'Unrealized FX Loss', type: 'EXP', statementClassification: 'Other expense', parentNumber: '8000', posting: 'Posting', wizardTrigger: 'Multi-Currency', description: 'Losses on revaluing open FX balances' },
  { number: '8040', name: 'Loss on Sale of Assets', type: 'EXP', statementClassification: 'Other expense', parentNumber: '8000', posting: 'Posting', wizardTrigger: 'Fixed Assets', description: 'Loss on disposal of fixed assets' },
  { number: '8100', name: 'Income Tax Expense', type: 'EXP', statementClassification: 'Income tax expense', parentNumber: '8000', posting: 'Posting', wizardTrigger: 'Entity: Corp', description: 'Corporate income tax expense' },
  { number: '8900', name: 'Other Miscellaneous Expense', type: 'EXP', statementClassification: 'Other expense', parentNumber: '8000', posting: 'Posting', wizardTrigger: 'Always', description: 'Other non-operating costs' },
]

// The recognized identity (Account role) each master-chart posting account is
// published with, keyed by master number. Only accounts whose part in the
// business is unambiguous appear here; everything else publishes unclassified.
//
// Bank and Credit Card are deliberately absent: BR-009 requires bank details
// before an account can be marked reconcilable, and none of the setup paths
// collect them, so those accounts are tagged when banking is set up.
export const MASTER_CHART_ROLES: Record<string, AccountRole> = {
  '1050': 'Payments to Deposit',
  '1100': 'Accounts Receivable',
  '1210': 'Inventory', '1220': 'Inventory', '1230': 'Inventory',
  '2020': 'Accounts Payable',
  '2300': 'Sales Tax Payable',
  '2450': 'Customer Deposits',
  '3500': 'Opening Balance Equity',
  '3900': 'Retained Earnings',
  // Not a master entry: guided setup authors it beside 3900 (decision 101).
  '3910': 'Retained Earnings Adjustments',
  '4010': 'Sales Revenue', '4020': 'Sales Revenue',
  '4520': 'Exchange Gain', '4530': 'Exchange Gain',
  // Direct cost of what's sold. Merchant fees (5060) and shrinkage (5070) sit in
  // the same section but aren't item-cost accounts, so they stay unclassified.
  '5010': 'Cost of Goods Sold', '5020': 'Cost of Goods Sold', '5030': 'Cost of Goods Sold',
  '5040': 'Cost of Goods Sold', '5050': 'Cost of Goods Sold', '5100': 'Cost of Goods Sold',
  '8020': 'Exchange Loss', '8030': 'Exchange Loss',
}

// Entries now store AccountType codes directly. This identity map is kept so the
// many existing `TYPE_TO_CODE[entry.type]` call sites stay valid after the
// five-Category migration (entry.type is already the code).
export const TYPE_TO_CODE: Record<AccountType, AccountType> = {
  AST: 'AST', LIA: 'LIA', EQT: 'EQT', REV: 'REV', EXP: 'EXP',
}
