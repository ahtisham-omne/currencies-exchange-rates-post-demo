import { useEffect, useMemo, useState } from 'react'
import { Lock, Scale, Unlock } from 'lucide-react'
import { Banner, Button, FormModal, Input, Select, Toggle } from './ui'
import { useStore } from '../store'
import { CONTROL_ACCOUNT_LOCK_LINE, type Account } from '../types'
import {
  ADJUSTMENT_ACCEPTS_ENTRIES,
  ADJUSTMENT_REDUCE_HINT,
  ADJUSTMENT_REDUCE_QUESTION,
  ADJUSTMENT_DIMENSION_NAME,
  ADJUSTMENT_TARGET_HINT,
  ADJUSTMENT_TARGET_LABEL,
  ADJUSTMENT_WHY,
  adjustmentDimensionFor,
  adjustmentTargets,
  buildAdjustmentInput,
  suggestAdjustment,
  validateAdjustment,
  type AdjustmentDraft,
} from '../lib/adjustmentAccount'
import { cn } from '../lib/utils'

/**
 * Create the account a hand entry goes into when the sealed one beside it
 * cannot take it. Its own modal rather than a branch of the create wizard: the
 * wizard's job is to ask what kind of account this is, and here every one of
 * those answers is already known from the account it stands beside. What is left
 * is the target, the direction, and a name.
 *
 * Opened from a control account, in which case that account is the target and
 * the picker is there to be changed rather than filled in.
 */
export function AdjustmentAccountModal({ open, onClose, target: fixedTarget, onCreated }: {
  open: boolean
  onClose: () => void
  /* The sealed account to open on. Left out, the user picks from every sealed
     account in the chart. */
  target?: Account | null
  onCreated?: (account: Account) => void
}) {
  const accounts = useStore(s => s.accounts)
  const dimensions = useStore(s => s.dimensions)
  const scheme = useStore(s => s.numberingScheme)
  const addDimension = useStore(s => s.addDimension)
  const updateDimension = useStore(s => s.updateDimension)
  const createAccount = useStore(s => s.createAccount)
  const validateAccount = useStore(s => s.validateAccount)
  const pushToast = useStore(s => s.pushToast)

  const targets = useMemo(() => adjustmentTargets(accounts), [accounts])
  const [draft, setDraft] = useState<AdjustmentDraft>({ targetId: '', accountName: '', accountNumber: '', reducesTotal: false })
  /* Whether the user has touched the name or number. Both are suggested from the
     target, so changing the target has to re-suggest them - but only while they
     are still suggestions, or a rename would be undone by a re-pick. */
  const [touched, setTouched] = useState<{ name: boolean; number: boolean }>({ name: false, number: false })
  const [attempted, setAttempted] = useState(false)

  const target = useMemo(() => accounts.find(a => a.id === draft.targetId) ?? null, [accounts, draft.targetId])
  const parent = useMemo(() => accounts.find(a => a.id === target?.parentId) ?? null, [accounts, target])

  // Open on the account the user came from, or the only candidate there is.
  useEffect(() => {
    if (!open) return
    const initial = fixedTarget?.id ?? (targets.length === 1 ? targets[0].id : '')
    setDraft({ targetId: initial, accountName: '', accountNumber: '', reducesTotal: false })
    setTouched({ name: false, number: false })
    setAttempted(false)
  }, [open, fixedTarget?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  /* The suggestion follows the target. It runs on every target change rather
     than once on open, because picking a different sealed account moves which
     summary the adjustment lands under, and a number from the old one would sit
     outside the new block. */
  useEffect(() => {
    if (!open || !target) return
    const s = suggestAdjustment(target, accounts, scheme)
    setDraft(d => ({
      ...d,
      accountName: touched.name ? d.accountName : s.accountName,
      accountNumber: touched.number ? d.accountNumber : s.accountNumber,
    }))
  }, [open, target?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  const errors = useMemo(() => {
    const e = validateAdjustment(draft)
    if (!target || Object.keys(e).length) return e
    // The chart-wide rules on top of the ones that are ours: a number already in
    // use, or one that does not fit the scheme.
    for (const v of validateAccount(buildAdjustmentInput(draft, target, 'dim_pending', 'pending'))) {
      if (!e[v.field]) e[v.field] = v.message
    }
    return e
  }, [draft, target, validateAccount])

  const shown = (field: keyof typeof errors) => (attempted ? errors[field] : undefined)

  const submit = () => {
    setAttempted(true)
    if (!target || Object.keys(errors).length) return

    /* One dimension for every adjustment in the chart, gaining a value per sealed
       account it is pointed at. A dimension per target would make the question "which
       accounts are adjustments" unanswerable without knowing every dimension's name. */
    const { dimension, values, value } = adjustmentDimensionFor(dimensions, target)
    const dimensionId = dimension
      ? (updateDimension(dimension.id, { values }), dimension.id)
      : addDimension({ name: ADJUSTMENT_DIMENSION_NAME, values, status: 'Active' }).id

    const account = createAccount(buildAdjustmentInput(draft, target, dimensionId, value))
    pushToast(
      `${account.accountNumber} ${account.accountName} created`,
      'success',
      `${ADJUSTMENT_DIMENSION_NAME} is set to ${value}. Hand-typed entries are allowed here.`,
    )
    onCreated?.(account)
    onClose()
  }

  const noTargets = !targets.length

  return (
    <FormModal
      open={open}
      onClose={onClose}
      title="Add an adjustment account"
      subtitle="An ordinary posting account beside a sealed one, for the entries the sealed one cannot take."
      icon={<Scale size={15} />}
      widthClass="max-w-[620px]"
      hideFullView
      footer={
        <div className="flex items-center justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button onClick={submit} disabled={noTargets}>Create account</Button>
        </div>
      }
    >
      <div className="p-5 space-y-4 overflow-y-auto scrollbar-thin">
        {noTargets ? (
          <Banner tone="info" title="Nothing to adjust yet">
            No account in this chart has its balance owned by a subledger, so every posting account already takes hand-typed entries. An adjustment account has nothing to stand beside.
          </Banner>
        ) : (
          <>
            <p className="text-xs text-fg-muted leading-relaxed">{ADJUSTMENT_WHY}</p>

            <Select
              label={ADJUSTMENT_TARGET_LABEL}
              required
              searchable={targets.length > 6}
              placeholder="Pick the sealed account"
              hint={ADJUSTMENT_TARGET_HINT}
              error={shown('targetId')}
              value={draft.targetId}
              onChange={e => setDraft(d => ({ ...d, targetId: e.target.value }))}
            >
              {targets.map(a => (
                <option key={a.id} value={a.id}>
                  {`${a.accountNumber} · ${a.accountName} · ${a.accountRole}`}
                </option>
              ))}
            </Select>

            {/* What was decided for the user, and why. Both facts come from the
                target, so showing them as fields would be four disabled inputs
                asking to be edited. */}
            {target && (
              <div className="rounded-lg border border-border bg-bg-subtle/60 p-3 space-y-2">
                <Row icon={<Lock size={11} />} label={`${target.accountNumber} ${target.accountName}`} value={CONTROL_ACCOUNT_LOCK_LINE} muted />
                <Row
                  icon={<Unlock size={11} className="text-primary" />}
                  label={parent ? `Sits under ${parent.accountNumber} ${parent.accountName}` : 'Sits at the top of the chart'}
                  value={ADJUSTMENT_ACCEPTS_ENTRIES}
                />
              </div>
            )}

            <div className="grid grid-cols-[1fr_150px] gap-3">
              <Input
                label="Account name"
                required
                value={draft.accountName}
                error={shown('accountName')}
                onChange={e => { setTouched(t => ({ ...t, name: true })); setDraft(d => ({ ...d, accountName: e.target.value })) }}
              />
              <Input
                label="Account number"
                required
                className="font-mono"
                value={draft.accountNumber}
                error={shown('accountNumber')}
                onChange={e => { setTouched(t => ({ ...t, number: true })); setDraft(d => ({ ...d, accountNumber: e.target.value })) }}
              />
            </div>

            <div className={cn('rounded-lg border p-3', draft.reducesTotal ? 'border-primary/40 bg-primary/[0.04]' : 'border-border')}>
              <Toggle
                checked={draft.reducesTotal}
                onChange={v => setDraft(d => ({ ...d, reducesTotal: v }))}
                label={ADJUSTMENT_REDUCE_QUESTION}
                hint={ADJUSTMENT_REDUCE_HINT}
              />
            </div>

            <Input
              label="Description"
              placeholder="Optional. What this account is for."
              value={draft.description ?? ''}
              onChange={e => setDraft(d => ({ ...d, description: e.target.value }))}
            />
          </>
        )}
      </div>
    </FormModal>
  )
}

function Row({ icon, label, value, muted }: { icon: React.ReactNode; label: string; value: string; muted?: boolean }) {
  return (
    <div className="flex items-start gap-2">
      <span className={cn('mt-[3px] shrink-0', muted && 'text-fg-subtle')}>{icon}</span>
      <div className="min-w-0">
        <p className={cn('text-2xs truncate', muted ? 'text-fg-muted' : 'text-fg')} style={{ fontWeight: 600 }}>{label}</p>
        <p className="text-2xs text-fg-subtle leading-relaxed">{value}</p>
      </div>
    </div>
  )
}
