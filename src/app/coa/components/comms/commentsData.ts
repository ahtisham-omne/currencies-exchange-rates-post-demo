// Ported from chart-of-accounts-v2.1/src/components/comms/commentsData.ts; adapted: the comment copy is about rates, variance and rounding.
/* Ported from the financial reporting module's comms cluster
   (components/fr/comms/communications-comments-data.ts).

   The seed the Comments panel reads. Shape and distribution are the source's
   verbatim: five comments over four messages, one of them carrying two, one
   resolved, three unread. The people and the copy are this module's, because a
   comment about push bumper pricing on a currency reads as a demo of
   somebody else's product. */

export interface CommentReply {
  id: string
  authorName: string
  authorInitials: string
  text: string
  timestamp: string
}

export interface EmailComment {
  id: string
  /** The message the comment hangs on. A `CommMessage.id` once seeded against
   *  a real thread; the literals below when it is not. */
  emailId: string
  authorName: string
  authorInitials: string
  text: string
  timestamp: string
  isRead: boolean
  isResolved: boolean
  replies: CommentReply[]
}

/* Which message each comment lands on, as offsets into a thread rather than
   ids. The source hung its five on messages 2, 3, 3, 4 and 5, and that
   grouping is what the panel's per-message cards are showing. */
const MESSAGE_OFFSETS = [2, 3, 3, 4, 5]

/** The comments a thread carries in the demo.
 *
 *  Called bare it returns the source's own seeding, keyed on its literal ids.
 *  Passed the thread's message ids it hangs the same five comments on real
 *  messages instead, keeping the source's grouping: two land on the same one. */
export function generateMockComments(messageIds?: string[]): EmailComment[] {
  const idAt = (i: number) => {
    if (!messageIds || messageIds.length === 0) return `t1-${MESSAGE_OFFSETS[i]}`
    return messageIds[Math.min(MESSAGE_OFFSETS[i] - 1, messageIds.length - 1)]
  }
  return [
    {
      id: 'c1',
      emailId: idAt(0),
      authorName: 'Daniel Osei',
      authorInitials: 'DO',
      text: 'Good read on the variance. Should we flag the rate change to treasury before it goes into the pack?',
      timestamp: 'Jun 21, 2026, 3:15 PM',
      isRead: true,
      isResolved: false,
      replies: [
        {
          id: 'c1-r1',
          authorName: 'Mahad Ejaz',
          authorInitials: 'ME',
          text: 'Already raised it with treasury and they are happy with where it sits.',
          timestamp: 'Jun 21, 2026, 4:02 PM',
        },
      ],
    },
    {
      id: 'c2',
      emailId: idAt(1),
      authorName: 'Priya Raman',
      authorInitials: 'PR',
      text: 'The variance threshold on this alert looks tight for a currency this volatile. Did anyone agree it with the controller?',
      timestamp: 'Jun 25, 2026, 11:40 AM',
      isRead: false,
      isResolved: false,
      replies: [],
    },
    {
      id: 'c3',
      emailId: idAt(2),
      authorName: 'Daniel Osei',
      authorInitials: 'DO',
      text: 'The rounding looks right to me. Worth naming the decimal places we used so the next reader does not ask again.',
      timestamp: 'Jun 25, 2026, 12:10 PM',
      isRead: true,
      isResolved: true,
      replies: [
        {
          id: 'c3-r1',
          authorName: 'Mahad Ejaz',
          authorInitials: 'ME',
          text: 'Noted it on the currency itself.',
          timestamp: 'Jun 25, 2026, 1:30 PM',
        },
      ],
    },
    {
      id: 'c4',
      emailId: idAt(3),
      authorName: 'Tom Brennan',
      authorInitials: 'TB',
      text: 'Good news that the review cleared. Make sure the rate approval is on the pair before close.',
      timestamp: 'Jul 2, 2026, 6:00 PM',
      isRead: false,
      isResolved: false,
      replies: [
        {
          id: 'c4-r1',
          authorName: 'Daniel Osei',
          authorInitials: 'DO',
          text: 'I will attach it. Should be on there by the end of the day.',
          timestamp: 'Jul 2, 2026, 6:30 PM',
        },
        {
          id: 'c4-r2',
          authorName: 'Mahad Ejaz',
          authorInitials: 'ME',
          text: 'Thanks Daniel, I have copied group reporting on the summary as well.',
          timestamp: 'Jul 2, 2026, 7:00 PM',
        },
      ],
    },
    {
      id: 'c5',
      emailId: idAt(4),
      authorName: 'Priya Raman',
      authorInitials: 'PR',
      text: 'The backdated effective date might need a word with treasury. Should I set up a call?',
      timestamp: 'Jul 3, 2026, 11:00 AM',
      isRead: false,
      isResolved: false,
      replies: [],
    },
  ]
}
