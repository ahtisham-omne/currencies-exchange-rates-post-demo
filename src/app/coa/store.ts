// Ported from chart-of-accounts-v2.1/src/store.ts; adapted: only the comms slices and actions the comms port reads (commsSent, commsThreads, commsArchived, commsPinned, commsUnread, commsTransferred), kept in memory like the currency contexts; pushToast routed to the kit toast stack; the record directory reads currencies and exchange rates in place of accounts, journal entries and transactions.
import { useEffect } from 'react'
import { create } from 'zustand'
import type { CommMessage, CommRecordKind, CommThread } from './lib/comms'
import { CURRENT_USER, previewOf, shortDate, stampOf } from './lib/comms'
import { pushToast, type ToastMsg } from './lib/toast'
import { uid } from './lib/utils'
import { SEED_CURRENCIES, type Currency } from '../data/currencies'
import { SEED_MID_MARKET_RATES, SEED_STANDARD_RATES, type MidMarketRate, type StandardRate } from '../data/exchangeRates'

interface State {
  /* The records a thread can be filed against, read by the record picker and
     the record chip's hover card. The currency contexts own them; detail pages
     hand their current copy over with `useCommsDirectorySync`. */
  currencies: Currency[]
  midMarketRates: MidMarketRate[]
  standardRates: StandardRate[]
  setCommsDirectory: (records: { currencies: Currency[]; midMarketRates: MidMarketRate[]; standardRates: StandardRate[] }) => void

  // Ephemeral toasts (auto-dismiss). pushToast returns the id.
  pushToast: (message: string, tone?: ToastMsg['tone'], description?: string, action?: ToastMsg['action']) => string

  /* What was said about a record, beyond what the demo derives for it. Like the
     notes, the demo threads are derived from the record (seededThreads).

     Replies and whole new threads are kept apart because they arrive
     differently - a reply names the thread it answers, a composed message
     starts one. Archive and pin are stored rather than held in component state,
     since a thread that un-archives itself when the tab is closed reads as a
     bug. */
  commsSent: CommMessage[]
  commsThreads: CommThread[]
  commsArchived: string[]
  commsPinned: string[]
  /** Whether the reader has read a thread, where they have said so - by opening
   *  it, or with Mark as unread / Mark as read. Over the seeded flag, per thread id. */
  commsUnread: Record<string, boolean>
  /** Threads moved onto another record. Held by id so the record they left
   *  stops offering them: a thread in two places is a thread whose answer the
   *  reader has to look for twice. */
  commsTransferred: string[]
  addCommMessage: (input: Omit<CommMessage, 'id' | 'timestamp' | 'dateIso' | 'from' | 'fromEmail' | 'isOutbound'>) => CommMessage
  addCommThread: (input: Omit<CommThread, 'messages'> & { first: Omit<CommMessage, 'id' | 'timestamp' | 'dateIso' | 'from' | 'fromEmail' | 'isOutbound' | 'threadId'> }) => CommThread
  toggleCommArchived: (threadId: string) => void
  toggleCommPinned: (messageId: string) => void
  setCommUnread: (threadId: string, unread: boolean) => void
  transferCommThread: (input: {
    thread: CommThread
    /** Where it lands. Omitted for an unlink, which leaves it on this record
     *  with no record of its own to belong to. */
    destination?: { subjectId: string; ref: string; label: string; kind: CommRecordKind }
  }) => void
}

export const useStore = create<State>()((set) => ({
  currencies: SEED_CURRENCIES,
  midMarketRates: SEED_MID_MARKET_RATES,
  standardRates: SEED_STANDARD_RATES,
  setCommsDirectory: ({ currencies, midMarketRates, standardRates }) => set(s => (
    s.currencies === currencies && s.midMarketRates === midMarketRates && s.standardRates === standardRates
      ? s
      : { currencies, midMarketRates, standardRates }
  )),

  // One toast stack for the app: the kit's.
  pushToast: (message, tone = 'success', description, action) => pushToast(message, tone, description, action),

  commsSent: [],
  commsThreads: [],
  commsArchived: [],
  commsPinned: [],
  commsUnread: {},
  commsTransferred: [],

  addCommMessage: (input) => {
    const now = new Date()
    const message: CommMessage = {
      ...input,
      id: uid('msg'),
      // Sender and time are stamped here rather than passed in, so a message
      // cannot claim to have been written by someone else, or at a time it
      // was not.
      from: CURRENT_USER.name,
      fromEmail: CURRENT_USER.email,
      isOutbound: true,
      dateIso: now.toISOString(),
      // Written the way a seeded message's is, not as the raw ISO string.
      timestamp: stampOf(now.toISOString()),
    }
    set(s => ({ commsSent: [...s.commsSent, message] }))
    return message
  },

  addCommThread: (input) => {
    const now = new Date()
    const { first, ...rest } = input
    const message: CommMessage = {
      ...first,
      id: uid('msg'),
      threadId: rest.id,
      from: CURRENT_USER.name,
      fromEmail: CURRENT_USER.email,
      isOutbound: true,
      dateIso: now.toISOString(),
      // Written the way a seeded message's is, not as the raw ISO string.
      timestamp: stampOf(now.toISOString()),
    }
    // The list row's own fields are derived from the message that starts the
    // thread, not asked for twice. A preview that disagreed with the message
    // under it would be the caller's to keep in step, and it would drift.
    const thread: CommThread = {
      ...rest,
      lastSender: message.from,
      lastSenderEmail: message.fromEmail,
      bodyPreview: previewOf(message.body),
      lastDate: shortDate(message.dateIso),
      dateIso: message.dateIso,
      isUnread: false,
      hasAttachments: !!message.attachments?.length,
      attachmentCount: message.attachments?.length ?? 0,
      messages: [message],
    }
    set(s => ({ commsThreads: [...s.commsThreads, thread] }))
    return thread
  },

  toggleCommArchived: (threadId) => set(s => ({
    commsArchived: s.commsArchived.includes(threadId)
      ? s.commsArchived.filter(id => id !== threadId)
      : [...s.commsArchived, threadId],
  })),

  setCommUnread: (threadId, unread) => set(s => (s.commsUnread[threadId] === unread ? s : { commsUnread: { ...s.commsUnread, [threadId]: unread } })),

  toggleCommPinned: (messageId) => set(s => ({
    commsPinned: s.commsPinned.includes(messageId)
      ? s.commsPinned.filter(id => id !== messageId)
      : [...s.commsPinned, messageId],
  })),

  transferCommThread: ({ thread, destination }) => {
    const id = uid('thread')
    /* A copy under a new id, because the original id is what marks the thread
       as gone from where it was. Reusing it would suppress the copy too. */
    const moved: CommThread = {
      ...thread,
      id,
      messages: thread.messages.map(m => ({ ...m, threadId: id })),
      subjectId: destination?.subjectId ?? thread.subjectId,
      // Unlinking leaves the thread where it is and files it as Other, which is
      // what the Unmatched mailbox reads. There is no inbox outside a record
      // here for it to go to instead.
      entityType: destination?.kind ?? 'Other',
      entityRef: destination?.ref ?? 'Unmatched',
      entityLabel: destination?.label ?? thread.entityLabel,
    }
    set(s => ({
      commsThreads: [...s.commsThreads, moved],
      commsTransferred: [...s.commsTransferred, thread.id],
    }))
  },
}))

/** Hands the contexts' current records to the comms record directory, so the
 *  picker and the record chips read what the library and the rate list show. */
export function useCommsDirectorySync(currencies: Currency[], midMarketRates: MidMarketRate[], standardRates: StandardRate[]) {
  const setCommsDirectory = useStore(s => s.setCommsDirectory)
  useEffect(() => {
    setCommsDirectory({ currencies, midMarketRates, standardRates })
  }, [currencies, midMarketRates, standardRates, setCommsDirectory])
}
