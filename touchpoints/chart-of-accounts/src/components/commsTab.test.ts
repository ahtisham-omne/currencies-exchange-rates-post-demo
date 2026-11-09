import { describe, expect, it } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { CommsTab } from './CommsTab'
import { longDate, threadsFor } from '../lib/comms'
import { formatEntityRef } from './comms/entityRef'
import type { CommChannel } from '../lib/comms'

/* The tab is the surface, so what is pinned here is what the reader can see
   without touching anything. Rendering it at all is half the point: a two-pane
   shell with a resize hook, a portal-rendered modal and a store read is exactly
   the shape that typechecks and then throws on mount. */

interface Subject { subjectId: string; kind: 'account'; label: string; anchorIso: string }

const subjectFor = (id: string): Subject => ({
  subjectId: id,
  kind: 'account',
  label: `${1000 + Number(id.replace('acct-', ''))} Test Account`,
  anchorIso: '2026-03-14',
})

const threadsOf = (s: Subject) => threadsFor([], [], s.subjectId, s.kind, s.label, s.anchorIso)

// Records are found by the shape the test needs rather than named, so these pin
// the rule and not the seed. A named account stops being the right one the
// moment the templates change.
const find = (want: (s: Subject) => boolean): Subject => {
  for (let i = 0; i < 120; i++) {
    const s = subjectFor(`acct-${i}`)
    if (want(s)) return s
  }
  throw new Error('no seeded account matched what the test needs')
}

// An account that actually carries correspondence: more than one thread, and a
// thread with more than one message in it.
const busy = find(s => {
  const t = threadsOf(s)
  return t.length > 1 && t.some(x => x.messages.length > 1)
})

const endingIn = (channel: CommChannel) => find(s => {
  const t = threadsOf(s)
  if (t.length < 2 || t[0].messages.length < 2) return false
  return t[0].messages[t[0].messages.length - 1].channel === channel
})

/* renderToStaticMarkup escapes apostrophes to &#x27;, so every assertion would
   otherwise have to be written in entities. Decoding once here keeps the
   expected strings readable as the copy they are pinning. */
const decode = (html: string) => html
  .replace(/&#x27;/g, "'")
  .replace(/&quot;/g, '"')
  .replace(/&amp;/g, '&')

const render = (subject: Subject = busy) =>
  decode(renderToStaticMarkup(createElement(CommsTab, subject)))

describe('CommsTab', () => {
  /* The thread has to be open on arrival, not selected by an effect a frame
     later: an effect runs after the first paint, so the reader would watch the
     empty pane be replaced. Asserting on the detail pane's own header is what
     catches that, since the subject alone also appears in the list. */
  it('opens on the newest thread rather than an empty pane', () => {
    const html = render()
    const newest = threadsOf(busy)[0]
    expect(html).toContain(`Last updated ${longDate(newest.dateIso)}`)
    expect(html).not.toContain('Select a message to read it')
  })

  /* All four of the source's mailboxes. Unmatched reads zero on a filed record,
     and shipping it saying zero is the point: it is a place mail can be, not a
     filter the reader is offered. */
  it('offers the source\'s four mailboxes', () => {
    const html = render()
    for (const label of ['All', 'Sent', 'Archived', 'Unmatched']) expect(html).toContain(`${label}<`)
  })

  it('switches between the mail and chat surfaces', () => {
    const html = render()
    expect(html).toContain('Emails')
    expect(html).toContain('Chat')
  })

  it('gives the reader a way to read, narrow and add', () => {
    const html = render()
    expect(html).toContain('Search emails')
    expect(html).toContain('Compose New Email')
    expect(html).toContain('aria-label="Filters"')
  })

  /* The three count pills above the thread. Each states a number that can be
     zero, which is what stops a reader wondering whether the control exists. */
  it('states what is pinned, commented on and attached', () => {
    const html = render()
    for (const label of ['Pinned', 'Comments', 'Attachments']) expect(html).toContain(label)
  })

  /* Comfort is the landing density, because the row's body preview only renders
     in comfort and a reader arriving at a dense list of subject lines cannot
     tell the threads apart. */
  it('lands in comfort, showing the preview under each row', () => {
    const html = render()
    expect(html).toContain('Comfort')
    expect(html).toContain(threadsOf(busy)[0].bodyPreview.slice(0, 30))
  })

  /* The ref is stored prefixed and shown bare. The chip's own colour and the
     type printed beside it already name the kind, so an "ACC-" inside the chip
     says the same word twice. */
  it('shows the record ref without the prefix it is stored under', () => {
    const html = render()
    const ref = threadsOf(busy)[0].entityRef
    expect(ref).toMatch(/^ACC-/)
    expect(html).toContain(`>${formatEntityRef(ref)}<`)
    expect(html).not.toContain('>ACC-')
  })

  /* Both halves of this matter. A reply is two acts, so it says so. And a note
     was never sent to anyone, so it has nothing to reply to: the only way to put
     it in front of someone is to send it out, and the button has to say that
     before it is pressed. */
  it('says what a reply does, and calls a note what it is', () => {
    const email = endingIn('Email')
    expect(render(email)).toContain(`Replies stay on ${email.label} as well as going out.`)

    const note = endingIn('Note')
    const html = render(note)
    expect(html).toContain(`Sending this out leaves the note on ${note.label}.`)
    expect(html).not.toContain(`Replies stay on ${note.label}`)
  })

  /* A record nobody has written on must say so rather than showing an empty
     shell with four zero pills and no explanation. */
  it('tells a silent record it is silent, in both panes', () => {
    const html = render({ subjectId: '', kind: 'account', label: '', anchorIso: '2026-03-14' })
    expect(html).toContain('Nothing has been said about this yet')
    expect(html).toContain('stays with the record instead of in an inbox')
  })
})
