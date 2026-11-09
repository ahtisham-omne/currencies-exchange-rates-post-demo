/* Features that are built but switched off. Each one stays in the code, whole and
   working, behind its flag here, so bringing it back is one line rather than a
   rebuild. Search the codebase for the flag's name to find every place it gates.

   ME_MODE - the "Me mode" quick filter on the Chart of Accounts (only the
   accounts you created) and the user icon beside a row's checkbox on accounts you
   created, which is the same idea marked on the row. Mahad, 2026-09-30: *"Hide me
   mode feature from this entire module for now please ... We might use it in the
   future, so let's hide this feature for now but do keep it in the code."* Off, the
   filter is ignored too, so a pill left on in an earlier visit (it is remembered
   per browser) cannot go on narrowing the chart with no control showing it. */
export const ME_MODE = false
