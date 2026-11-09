/* Naming the field an activity entry changed.
 *
 * The log stores the property name, because that is what `updateAccount` has to
 * hand when it diffs a patch. Read back, that gives lines like "updated
 * accountnumber" and "updated defaultdimensionvalues" - the reader is being
 * shown the shape of the data rather than told what happened.
 *
 * So the log keeps the property name and this names it in the reader's words. It
 * is a lookup rather than a rule because the two are not the same vocabulary:
 * `accountType` is the GL account category on every screen, and no amount of
 * splitting camelCase gets there. The split is the fallback, so a field added to
 * the account and forgotten here still reads as words.
 */

const LABELS: Record<string, string> = {
  accountNumber: 'GL account no.',
  accountName: 'GL account name',
  accountType: 'GL account category',
  glAccountType: 'GL account type',
  accountRole: 'account role',
  statementClassification: 'statement classification',
  subType: 'sub-type',
  isContra: 'contra setting',
  normalBalance: 'normal balance',
  parentId: 'parent account',
  subsidiaryId: 'subsidiary',
  currencyCode: 'currency',
  status: 'status',
  effectiveDate: 'effective date',
  defaultDimensionValues: 'default dimensions',
  description: 'description',
  postingRestrictions: 'posting restrictions',
  taxCodeId: 'tax code',
  bankAccountType: 'bank account type',
  creditLimit: 'credit limit',
  bankName: 'bank name',
  bankAccountTitle: 'bank account title',
  bankNickname: 'bank nickname',
  bankRouting: 'routing number',
  bankAccountNumber: 'bank account number',
  balance: 'balance',
  originalCode: 'number it arrived as',
  numberRangeStart: 'number range start',
  numberRangeEnd: 'number range end',
}

/** camelCase to words, for a field nobody has named yet. */
function fromCamelCase(field: string): string {
  return field
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/^./, c => c.toLowerCase())
}

export function auditFieldLabel(field: string): string {
  return LABELS[field] ?? fromCamelCase(field)
}
