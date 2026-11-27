/* ── OMNE currency kit ────────────────────────────────────────────────
 * Import everything from here: `import { DocMoney, CurrencyBlock } from
 * '@/app/currency-kit'`. Installed by the omne-currencies skill
 * (install-currency-kit.mjs); kit.lock.json holds each file's hash and
 * check-currencies.mjs fails when one is edited. Never edit these files in
 * a module: a change goes to the kit's owner so every module gets it.
 *
 * Shared file. Do not edit it in a module. */

export * from './currencies';
export * from './rates';
export * from './moneyFormat';
export * from './FlagImage';
export * from './ProviderLink';
export * from './FxCard';
export * from './CurrencyChip';
export * from './CurrencyCodeCell';
export * from './Money';
export * from './docCurrencyContext';
export * from './docView';
export * from './DocCurrency';
export * from './CurrencySwitch';
export * from './RateType';
export * from './CompareRates';
export * from './CurrencyBlock';
export * from './columnCurrencyView';
export * from './ShowValuesAs';
export * from './companyAccounts';
export * from './PayFromAccountPicker';
export * from './BankRateField';

export const CURRENCY_KIT_VERSION = '0.1.0';
