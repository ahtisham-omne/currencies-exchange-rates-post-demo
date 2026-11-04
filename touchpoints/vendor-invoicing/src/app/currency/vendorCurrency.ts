import { resolveRegistryVendor } from '@/app/data/mockVendors';
import { currencyForVendorName } from './invoiceFx';

/** A vendor's default currency, read from its partner record (spec 4.2). */
export const vendorCurrencyOf = (name: string | null | undefined): string =>
  resolveRegistryVendor(name)?.currency ?? currencyForVendorName(name ?? '');
