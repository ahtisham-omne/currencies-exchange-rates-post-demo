// Saved charge templates for Standalone invoices (PRD §9.2, §9.3): a
// template fills the line's description, rate, revenue account and
// notes. Typed lines stay available alongside.

export interface ChargeTemplate {
  id: string;
  name: string;
  description: string;
  rate: number;
  revenueAccount: string;
  notes?: string;
}

export const CHARGE_TEMPLATES: ChargeTemplate[] = [
  { id: 'ct-commission', name: 'On-site commissioning', description: 'On-site commissioning service, per technician day', rate: 1375, revenueAccount: '4100 Service Fee Income', notes: 'Travel billed separately.' },
  { id: 'ct-tooling', name: 'Tooling charge', description: 'Custom tooling and fixture build for the order', rate: 2400, revenueAccount: '4150 Tooling Income' },
  { id: 'ct-calibration', name: 'Quarterly calibration', description: 'Quarterly calibration visit under the service contract', rate: 650, revenueAccount: '4100 Service Fee Income' },
  { id: 'ct-recharge', name: 'Recharge: rework', description: 'Recharge for rework requested by the customer', rate: 180, revenueAccount: '4300 Fee and Other Income' },
  { id: 'ct-setup', name: 'Setup fee', description: 'One-time setup fee for a new item configuration', rate: 450, revenueAccount: '4300 Fee and Other Income' },
  { id: 'ct-restock', name: 'Restocking fee', description: 'Restocking fee on returned goods', rate: 95, revenueAccount: '4300 Fee and Other Income' },
];
