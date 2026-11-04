/* ── How it works: the import guide (9/15/26 PM) ──────────────────────
 * A slide-over inside the modal shell, the role-zen "Users Import
 * Guide" pattern: eyebrow, title, scrollable sections, quick-start
 * steps in bold. Long-form explanation lives HERE so the working
 * screens can stay quiet and lean on tooltips.
 */

import { X } from 'lucide-react';
import { GuideAccordion } from './GuideAccordion';

function Step({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <p>
      <span className="text-foreground" style={{ fontWeight: 600 }}>Step {n}: {title}.</span>{' '}
      {children}
    </p>
  );
}

export function ImportGuidePanel({ onClose }: { onClose: () => void }) {
  return (
    <>
      {/* Click-catcher over the working screen. */}
      <div className="absolute inset-0 z-20 bg-slate-900/10 animate-in fade-in duration-150" onClick={onClose} />
      <div
        className="absolute inset-y-0 right-0 z-30 w-full sm:w-[420px] bg-white border-l border-border flex flex-col animate-in slide-in-from-right duration-200"
        style={{ boxShadow: '-24px 0 48px rgba(2,6,23,0.10)' }}
      >
        <div className="flex items-start justify-between gap-3 px-5 pt-5 pb-4 border-b border-slate-100 shrink-0">
          <div>
            <p className="text-[10.5px] tracking-[0.08em]" style={{ fontWeight: 600, color: 'hsl(var(--primary))' }}>
              How This Works
            </p>
            <h3 className="text-[16px] text-foreground mt-0.5" style={{ fontWeight: 700 }}>
              Vendor Invoice Import Guide
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-500 hover:bg-muted transition-all cursor-pointer shrink-0"
            aria-label="Close guide"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto px-5 py-4 space-y-4">
          {/* Title + answer as accordions (user 9/25): the wall of prose
              collapses into scannable sections, first one open. */}
          <GuideAccordion
            items={[
              {
                title: 'How the Import Works',
                body: (
                  <>
                    <p>
                      Importing brings a batch of vendor invoices into Omne in one pass through a staged pipeline: upload, map, validate, then commit. Nothing writes to the ledger until the final click, and a committed run can be rolled back for 72 hours.
                    </p>
                    <p>
                      One file is all it takes: the export from your old system, CSV or Excel. Both real-world shapes work, one row per invoice or one row per line item with the invoice columns repeated. Rows sharing a vendor and invoice number group into one invoice, and if repeated columns disagree inside a group, that exact cell is flagged instead of silently creating a second invoice.
                    </p>
                    <p>
                      Migration runs can bring payments and credit memos along too, as separate files or as extra sheets inside the same Excel workbook, and everything validates against everything else before anything commits.
                    </p>
                  </>
                ),
              },
              {
                title: 'Migration vs Ongoing Batch',
                body: (
                  <>
                    <p>
                      <span className="text-foreground" style={{ fontWeight: 600 }}>Migration</span> bulk-loads history once, at go-live. Every invoice posts into the go-live period against a clearing account, and one entry reverses the whole load, so the GL balance you migrated separately is untouched. Historical statuses, holds and payments come along; duplicates warn, because legacy data is messy.
                    </p>
                    <p>
                      <span className="text-foreground" style={{ fontWeight: 600 }}>Ongoing batch</span> bulk-enters this period's invoices any time. Everything lands at Pending Approval and routes through the normal approval flow; duplicates block.
                    </p>
                  </>
                ),
              },
              {
                title: 'Columns and Defaults',
                body: (
                  <>
                    <p>
                      Only three columns are truly required: vendor name, invoice number and invoice date, plus some amount, a subtotal or line amounts. Everything else has a sensible default: blank statuses land as Approved on a migration and Pending Approval on an ongoing batch, blank payment status is Unpaid, blank terms import as N/A, and the due date derives from the trigger date plus the term days.
                    </p>
                    <p>
                      Columns auto-match on upload by header name, including common legacy names like Supplier, Bill Number, Description or Amount; anything that misses is remapped by hand or by dragging a leftover column onto a field. The Excel template is one workbook carrying the Invoices, Payments and Credit memos sheets with the rules attached.
                    </p>
                    <p>
                      Save the finished mapping as a profile: a migration is never one file, and the third upload should not be a remap.
                    </p>
                  </>
                ),
              },
              {
                title: 'Review and Severities',
                body: (
                  <>
                    <p>
                      Validation grades every row three ways. <span style={{ fontWeight: 600, color: '#B91C1C' }}>Blockers</span> never import and must be fixed or excluded. <span style={{ fontWeight: 600, color: '#C2410C' }}>Exceptions</span> import into the Exception queue and stay out of payment runs and aging until cleared. <span style={{ fontWeight: 600, color: '#475569' }}>Warnings</span> import normally, flagged on the report.
                    </p>
                    <p>
                      Errors are per cell. Click one and it becomes an editor pre-filled with the engine's suggestion; when the same bad value sits on other rows, the toast offers to fix them all at once. Near duplicates show both rows side by side with three decisions. The failed rows download as a CSV with an error column for anyone who would rather fix in Excel.
                    </p>
                  </>
                ),
              },
              {
                title: 'Before Commit',
                body: (
                  <p>
                    Simulate is a dry run: what will be created, the accounting preview, and the AP tie-out, where you type the closing balance from the legacy system and see the difference before commit instead of chasing it vendor by vendor after.
                  </p>
                ),
              },
              {
                title: 'Quick Start',
                body: (
                  <>
                    <Step n={1} title="Pick the Mode">Migration for a cutover, Ongoing batch for this period's invoices.</Step>
                    <Step n={2} title="Upload Your Export">One file, straight from your old system. Or hit Use Sample Data to walk the whole flow with a realistic messy export.</Step>
                    <Step n={3} title="Map the Columns">Auto-matched where headers agree; unmapped required fields sit at the top in orange.</Step>
                    <Step n={4} title="Fix What the Engine Flags">Click flagged cells, accept suggestions, exclude what should not come.</Step>
                    <Step n={5} title="Simulate, Then Commit">Tie out the AP balance, commit, and roll back within 72 hours if anything looks wrong.</Step>
                  </>
                ),
              },
            ]}
          />

          <div className="rounded-lg border border-slate-200 bg-slate-50/70 px-3.5 py-3">
            <p className="text-[11.5px] text-slate-500" style={{ fontWeight: 400, lineHeight: 1.6 }}>
              <span style={{ fontWeight: 600 }}>Not in this version:</span> inventory invoices matched to a PO or receipt, pre-invoices and prepayments, tax codes and withholding, attachments, customer invoices.
            </p>
          </div>
        </div>
      </div>
    </>
  );
}
