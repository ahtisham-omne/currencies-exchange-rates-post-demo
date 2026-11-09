import { useEffect, useState } from 'react'
import { Hash } from 'lucide-react'
import { Button, FormModal, Toggle } from './ui'
import { AccountNumberingStep, schemeFromNumberWidth } from './AccountNumberingStep'
import { useStore } from '../store'
import { numberProtectionOn } from '../types'

/* ──────────────────────────────────────────────────────────────────
 * ACCOUNT NUMBERS, THE MODULE SETTINGS
 *
 * The two settings the chart's numbers run on after setup: how long a suggested
 * number is, and number protection. Opened from the chart's Actions menu, and
 * closed back onto the chart - Actions holds the jobs that end where they
 * started (see the chart header).
 *
 * Number protection is a module setting, on by default, and needed a place to
 * be switched: decision 91; module review, 2026-10-06 (COA-23); Outline 09,
 * Where the prototype differs. Category ranges are not set here: after setup
 * each category's block is on its own row, edited from the chart.
 * ────────────────────────────────────────────────────────────────── */
export const NUMBER_PROTECTION_HINT =
  "Keeps the numbers from a summary's own number to its last account for that summary's accounts, even where no range was typed, so an unrelated account can't be slotted in between them. On by default. Turn it off for a chart brought in from a system that numbered things another way."

export function NumberSettingsModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const scheme = useStore(s => s.numberingScheme)
  const company = useStore(s => s.company)
  const setNumberingScheme = useStore(s => s.setNumberingScheme)
  const setCompany = useStore(s => s.setCompany)
  const pushToast = useStore(s => s.pushToast)

  const savedDigits = Math.max(4, scheme.segments[0]?.length ?? 5)
  const [digits, setDigits] = useState(savedDigits)
  const [protection, setProtection] = useState(numberProtectionOn(company))
  // Seeded on the way open: between opening and saving the draft is the reader's.
  useEffect(() => {
    if (!open) return
    setDigits(savedDigits)
    setProtection(numberProtectionOn(company))
  }, [open]) // eslint-disable-line react-hooks/exhaustive-deps
  const changed = digits !== savedDigits || protection !== numberProtectionOn(company)

  const save = () => {
    if (digits !== savedDigits) setNumberingScheme({ ...scheme, ...schemeFromNumberWidth(digits), categoryRanges: scheme.categoryRanges })
    if (protection !== numberProtectionOn(company)) setCompany({ numberProtection: protection })
    pushToast('Account number settings saved', 'success')
    onClose()
  }

  return (
    <FormModal
      open={open}
      onClose={onClose}
      icon={<Hash size={16} />}
      title="Account numbers"
      subtitle="How long the numbers Omne suggests are, and whether a summary's numbers are kept for its own accounts."
      widthClass="max-w-[640px]"
      hideFullView
      footer={
        <div className="flex items-center justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={save} disabled={!changed}>Save changes</Button>
        </div>
      }
    >
      <div className="px-6 py-5 space-y-4">
        <AccountNumberingStep digits={digits} onChange={setDigits} lengthOnly />
        <div className="rounded-2xl border border-border bg-white p-4 sm:p-5" data-number-protection>
          <Toggle checked={protection} onChange={setProtection} label="Number protection" hint={NUMBER_PROTECTION_HINT} />
        </div>
      </div>
    </FormModal>
  )
}
