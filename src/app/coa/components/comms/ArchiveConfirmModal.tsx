/* Ported from the financial reporting module (components/fr/comms/ArchiveConfirmModal.tsx).

   The confirmation for the sensitive comms moves - archive (single or batch),
   report spam, leave channel, remove member, transfer ownership. `kind` swaps
   the icon, the accent, the tag and the copy so one component covers every one
   of them, which is the source's whole point: five confirmations that look and
   read alike because they are the same act.

   The source hand-rolled its chrome - radial header, centred icon, uppercase
   tag, stacked CTAs. This module's `ConfirmModal` already IS that chrome, down
   to the glow and the stacked buttons, so this file supplies only the copy and
   the tone. Re-implementing the shell would have meant two versions of one
   pattern drifting apart.

   This portals to <body>, outside the tab's `data-comms` root, so the source's
   `var(--color-*)` primitives would not resolve here. The tone comes from
   ConfirmModal's own danger/warning accents instead. */
import { AlertTriangle, Archive, Crown, LogOut, UserMinus } from 'lucide-react'
import { ConfirmModal } from '../ui'

export type ArchiveConfirmKind = 'archive' | 'spam' | 'leave' | 'remove-member' | 'transfer-ownership'
export type ArchiveConfirmTarget = 'thread' | 'email' | 'channel'

export function ArchiveConfirmModal({
  open,
  onClose,
  target = 'thread',
  kind = 'archive',
  count,
  channelName,
  userName,
  onConfirm,
}: {
  open: boolean
  onClose: () => void
  /** The surface being acted on. Drives the copy only: the flow is identical,
   *  a soft warning and a destructive CTA. */
  target?: ArchiveConfirmTarget
  /** The action. Each kind picks its own icon, accent, copy and CTA label while
   *  reusing the same chrome. */
  kind?: ArchiveConfirmKind
  /** Batch size. Above one, the copy pluralises to "Archive 4 email threads?". */
  count?: number
  /** Named in the leave / remove / transfer copy, so the reader knows which
   *  channel they are acting on. */
  channelName?: string
  /** Named in the remove-member and transfer-ownership copy. */
  userName?: string
  onConfirm: () => void
}) {
  if (!open) return null

  const batch = (count ?? 1) > 1
  const n = count ?? 1
  const noun = target === 'channel' ? 'channel' : target === 'email' ? 'email' : 'email thread'
  const nounPlural = `${noun}s`
  const channelLabel = channelName ? `#${channelName}` : 'this channel'
  const userLabel = userName ?? 'this member'

  /* Transferring ownership is a permission change, not a destruction, so it
     reads amber. Everything else takes something out of the reader's view and
     reads red. */
  const tone = kind === 'transfer-ownership' ? 'warning' : 'danger'
  const iconClass = kind === 'transfer-ownership' ? 'text-warning-600' : 'text-danger-600'

  const title = kind === 'leave'
    ? `Leave ${channelLabel}?`
    : kind === 'remove-member'
      ? `Remove ${userLabel} from ${channelLabel}?`
      : kind === 'transfer-ownership'
        ? `Transfer ${channelLabel} to ${userLabel}?`
        : kind === 'spam'
          ? batch
            ? `Report ${n} ${nounPlural} as spam?`
            : `Report this ${noun} as spam?`
          : batch
            ? `Archive ${n} ${nounPlural}?`
            : target === 'channel'
              ? `Archive ${channelLabel}?`
              : `Archive this ${noun}?`

  const description = kind === 'leave'
    ? `You'll stop receiving messages from ${channelLabel}. You can be re-added by another member later.`
    : kind === 'remove-member'
      ? `${userLabel} will lose access to ${channelLabel} and any new messages. You can add them back at any time.`
      : kind === 'transfer-ownership'
        ? `${userLabel} will become the channel owner and gain the ability to archive ${channelLabel} or change its visibility. You'll stay as a regular member.`
        : kind === 'spam'
          ? batch
            ? `These ${n} ${nounPlural} will be reported as spam and moved to the archive. You can still find them later in Archived emails.`
            : `This ${noun} will be reported as spam and moved to the archive. You can still find it later in Archived emails.`
          : batch
            ? target === 'channel'
              ? `These ${n} channels will be moved to the archive. You can still find them later under the Archived tab.`
              : `These ${n} ${nounPlural} will be moved to the archive. You can still find them later in Archived emails.`
            : target === 'channel'
              ? 'This channel will be moved to the archive. You can still find it later under the Archived tab.'
              : `This ${noun} will be moved to the archive. You can still find it later in Archived emails.`

  const Icon = kind === 'leave'
    ? LogOut
    : kind === 'remove-member'
      ? UserMinus
      : kind === 'transfer-ownership'
        ? Crown
        : kind === 'spam'
          ? AlertTriangle
          : Archive

  const badge = kind === 'leave'
    ? 'Leave'
    : kind === 'remove-member'
      ? 'Remove'
      : kind === 'transfer-ownership'
        ? 'Transfer Ownership'
        : kind === 'spam'
          ? 'Spam'
          : 'Archive'

  const confirmLabel = kind === 'leave'
    ? 'Leave Channel'
    : kind === 'remove-member'
      ? 'Remove Member'
      : kind === 'transfer-ownership'
        ? 'Transfer Ownership'
        : kind === 'spam'
          ? batch ? `Report ${n} as Spam` : 'Report as Spam'
          : batch ? `Archive ${n}` : 'Archive'

  const dismissLabel = kind === 'leave'
    ? 'Stay in Channel'
    : kind === 'remove-member'
      ? 'Keep as Member'
      : kind === 'transfer-ownership'
        ? 'Keep Me as Owner'
        : kind === 'spam'
          ? 'Keep in Inbox'
          : target === 'channel' ? 'Keep Active' : 'Keep in Inbox'

  return (
    <ConfirmModal
      open={open}
      tone={tone}
      icon={<Icon size={26} strokeWidth={1.75} className={iconClass} />}
      badge={badge}
      title={title}
      description={description}
      confirmLabel={confirmLabel}
      dismissLabel={dismissLabel}
      onConfirm={onConfirm}
      onDismiss={onClose}
    />
  )
}
