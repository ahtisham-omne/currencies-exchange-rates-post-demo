/* ─── Whose company UAC is showing ───
 *
 * The sample data is the Omnesoft company. When Omne Home's onboarding
 * hand-off carries a company (see onboarding-handoff.ts), UAC opens as that
 * company instead: only the people setup created, signed in as the person
 * using Home, under the company's legal name.
 *
 * Set once at boot, before the first render, and never changed while the app
 * is open (a new hand-off reloads the page), so nothing here is reactive.
 *
 * This is the tenant's own name. Omnesoft as the vendor of Omne (the sender
 * of notification emails, for one) is not this and stays as it is. */

const SAMPLE_COMPANY_NAME = "Omnesoft";

/** What Omne Home calls a company whose legal name setup hasn't saved yet
 *  (omne-home setupStore.ts, companyDisplayName), so the two apps agree. */
const UNNAMED_COMPANY = "Your Company";

let newCompanyName: string | null = null;

/** Open as the company onboarding set up. */
export function openAsCompany(legalName: string): void {
  newCompanyName = legalName.trim() || UNNAMED_COMPANY;
}

/** The tenant's name: the company from onboarding, or the sample's. */
export function getCompanyName(): string {
  return newCompanyName ?? SAMPLE_COMPANY_NAME;
}

/** True when UAC opened as a company from onboarding, not the sample. */
export function isNewTenant(): boolean {
  return newCompanyName !== null;
}

/** Content that only the sample company has: its notes, attachments,
 *  activity, imports and the like. A company that onboarding just set up
 *  starts with none of it, so this reads as empty there. Ask at render or
 *  call time, not when a module loads. */
export function sampleOnly<T>(items: readonly T[]): T[] {
  return isNewTenant() ? [] : [...items];
}
