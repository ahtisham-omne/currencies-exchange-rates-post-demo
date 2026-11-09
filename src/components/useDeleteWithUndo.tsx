import { useState } from 'react'
import { useStore } from '../store'
import type { Account } from '../types'
import { ConfirmModal } from './ui'

// Delete flow for the setup wizards (Build-from-Scratch, Guided Setup), which
// hold their accounts in local component state. Wraps a removal behind a
// confirmation modal and, once confirmed, fires a toast with an "Undo" that
// splices the removed account(s) back where they were. Descendants are removed
// alongside their parent so the draft tree never orphans.
//
// The same restore is also returned as `lastDelete`, for a toolbar button: the
// toast fades after a few seconds, and a draft chart is exactly where someone
// deletes a row, looks at the result, and only then wants it back.
export function useDeleteWithUndo(
  accounts: Account[],
  setAccounts: (updater: (prev: Account[]) => Account[]) => void,
) {
  const [pending, setPending] = useState<Account | null>(null)
  // The last deletion, restorable until it is used. Wrapped in an object because
  // a bare function in state would be read as a setState updater.
  const [lastDelete, setLastDelete] = useState<{ restore: () => void } | null>(null)
  const pushToast = useStore(s => s.pushToast)

  const requestDelete = (a: Account) => setPending(a)

  const confirm = () => {
    if (!pending) return
    const target = pending
    setPending(null)

    // Collect the target plus every descendant.
    const toRemove = new Set<string>([target.id])
    let grew = true
    while (grew) {
      grew = false
      accounts.forEach(x => {
        if (x.parentId && toRemove.has(x.parentId) && !toRemove.has(x.id)) { toRemove.add(x.id); grew = true }
      })
    }
    // Snapshot the removed rows and where the first one sat, so Undo can splice
    // them back at their original position without clobbering later edits.
    const removed: Account[] = []
    let insertAt = accounts.length
    accounts.forEach((x, i) => {
      if (toRemove.has(x.id)) { if (removed.length === 0) insertAt = i; removed.push(x) }
    })

    setAccounts(prev => prev.filter(x => !toRemove.has(x.id)))
    const restore = () => {
      setAccounts(prev => {
        const next = [...prev]
        next.splice(Math.min(insertAt, next.length), 0, ...removed)
        return next
      })
      setLastDelete(null)
    }
    setLastDelete({ restore })
    pushToast(
      `Deleted “${target.accountName}”`,
      'success',
      removed.length > 1 ? `${removed.length} accounts removed` : undefined,
      { label: 'Undo', onClick: restore },
    )
  }

  const confirmModal = (
    <ConfirmModal
      open={!!pending}
      tone="danger"
      badge="Delete account"
      title={pending ? `Delete “${pending.accountName}”?` : ''}
      description={pending
        ? [`${pending.accountNumber} · ${pending.accountName}`, 'This removes it from your draft chart. You can undo right after.']
        : ''}
      confirmLabel="Delete account"
      dismissLabel="Cancel"
      onConfirm={confirm}
      onDismiss={() => setPending(null)}
    />
  )

  return { requestDelete, confirmModal, lastDelete }
}
