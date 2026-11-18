/* Options for a Quotes / Sales Orders cell that names another module's record
 * (customer, location, contact, item, pricing rule, payment term or method,
 * sales rep, unit). The cell opens the shared ChoiceCellDropdown with these,
 * in place, instead of the full-screen customer search or the resolve dialog:
 * the same rule as every other Data Imports grid. The values are exactly the
 * catalog the import validates against, so a pick always passes.
 *
 * Descriptions are the record's own facts, never new copy: a customer's
 * default address, a location's address, a contact's title and customer, an
 * item's description, a user's email, a unit's full name. */
import type { ChoiceOption } from "../../import-review/ChoiceCellDropdown";
import { CATALOG, ITEM_BY_CODE, UOM_FULL_NAMES, USER_EMAILS, type CatalogKey } from "./importCatalog";
import { MOCK_CONTACTS, MOCK_CUSTOMERS } from "./customerData";

const same = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

function customerAddress(name: string): string | undefined {
  const c = MOCK_CUSTOMERS.find((x) => same(x.name, name));
  const loc = c?.locations.find((l) => l.isDefault) ?? c?.locations[0];
  return loc?.address;
}

function locationAddress(value: string): string | undefined {
  const [customer, site] = value.includes(">") ? value.split(">").map((s) => s.trim()) : ["", value.trim()];
  for (const c of MOCK_CUSTOMERS) {
    if (customer && !same(c.name, customer)) continue;
    const loc = c.locations.find((l) => same(l.name, site));
    if (loc) return loc.address;
  }
  return undefined;
}

function contactLine(name: string): string | undefined {
  const c = MOCK_CONTACTS.find((x) => same(x.name, name) || same(x.email, name));
  if (!c) return undefined;
  return [c.title, c.customerName].filter(Boolean).join(" · ") || undefined;
}

/** "jane.doe@x.com" → "Jane Doe", as the rep selector names people. */
function personName(email: string): string {
  return email
    .split("@")[0]
    .split(".")
    .filter(Boolean)
    .map((w) => w[0].toUpperCase() + w.slice(1))
    .join(" ");
}

export function sheetChoiceOptions(entity: CatalogKey): ChoiceOption[] {
  switch (entity) {
    case "customer":
      return CATALOG.customer.options.map((v) => ({ value: v, description: customerAddress(v) }));
    case "location":
      return CATALOG.location.options.map((v) => ({ value: v, description: locationAddress(v) }));
    case "contact":
      return CATALOG.contact.options.map((v) => ({ value: v, description: contactLine(v) }));
    case "item":
      return CATALOG.item.options.map((v) => ({ value: v, description: ITEM_BY_CODE[v]?.description }));
    case "user":
      return USER_EMAILS.map((email) => ({ value: email, label: personName(email), description: email }));
    case "uom":
      return CATALOG.uom.options.map((v) => ({ value: v, description: UOM_FULL_NAMES[v] }));
    default:
      return CATALOG[entity].options.map((v) => ({ value: v }));
  }
}
