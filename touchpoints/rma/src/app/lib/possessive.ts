/**
 * The possessive of a company name.
 *
 * Vendor names arrive from the data, so a dialog that writes "<name>'s
 * standard" has to cope with the ones that already end in s. Juniper Freight
 * Systems takes a bare apostrophe; Acme takes 's. Everything else about the
 * sentence stays where the caller put it.
 */
export const possessive = (name: string): string =>
  /s$/i.test(name.trim()) ? `${name}’` : `${name}’s`;
