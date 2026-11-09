import { useEffect, useState } from 'react'
import { ListFilter } from 'lucide-react'
import { useStore } from '../store'
import { Button, FormModal } from './ui'
import { DimensionDefaultsEditor } from '../pages/CreateAccount'
import { missingDefaults } from '../lib/dimensionDefaults'
import type { Account } from '../types'

type DimensionValues = Account['defaultDimensionValues']

/* ─────────────────────── One account's dimensions ───────────────────────
   The modal an account's dimensions are given in, on its own: the same editor
   the account form's Dimensions step uses, so a value set here and one set at
   creation are set the same way.

   Two doors. An account's detail page, from its Dimensions card, where a
   dimension the chart does not have yet can be made on the spot. And the row
   menu on the Accounts step of Build from scratch and Guided setup - "Add
   dimensions", under Edit account - which only links the dimensions already
   defined on the Dimensions step (Mahad, 2026-10-08: *"only the dimension modal
   should open, allowing us to link the already created dimensions to that
   account"*). There the account is still a draft, so the modal hands the values
   back rather than writing them. */
export function AccountDimensionsModal({ open, account, value, onClose, onSave, allowNewDimension }: {
  open: boolean
  /** Named in the subtitle. */
  account: Pick<Account, 'accountNumber' | 'accountName'>
  value: DimensionValues
  onClose: () => void
  onSave: (values: DimensionValues) => void
  /** Offer "Create new dimension" in the picker. Off in setup, where the step
   *  before is where dimensions are made. */
  allowNewDimension?: boolean
}) {
  const dimensions = useStore(s => s.dimensions)
  const addDimension = useStore(s => s.addDimension)
  const updateDimension = useStore(s => s.updateDimension)
  const [draft, setDraft] = useState(value)
  // Each opening starts from what the account holds now.
  useEffect(() => { if (open) setDraft(value) }, [open]) // eslint-disable-line react-hooks/exhaustive-deps

  const active = dimensions.filter(d => d.status === 'Active')
  const draftMissing = missingDefaults(draft).length > 0

  return (
    <FormModal
      open={open}
      onClose={onClose}
      icon={<ListFilter size={16} />}
      title="Dimensions"
      subtitle={`The values ${account.accountNumber} ${account.accountName} carries. A journal line on it starts on each dimension’s default, and can switch to the others.`}
      widthClass="max-w-[760px]"
      hideFullView
      footer={
        <div className="flex items-center justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={() => onSave(draft)} disabled={draftMissing}>Save dimensions</Button>
        </div>
      }
    >
      <div className="px-6 py-5" data-account-dimensions-modal>
        <DimensionDefaultsEditor
          dimensions={active}
          value={draft}
          onChange={setDraft}
          onAddValue={(id, v) => {
            const d = dimensions.find(x => x.id === id)
            if (d) updateDimension(id, { values: [...d.values, v] })
          }}
          onCreateDimension={allowNewDimension ? d => addDimension(d) : undefined}
        />
      </div>
    </FormModal>
  )
}
