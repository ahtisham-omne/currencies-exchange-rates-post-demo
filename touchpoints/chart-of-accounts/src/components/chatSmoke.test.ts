import { describe, expect, it } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { writeFileSync } from 'fs'
import { ChatPanel } from './comms/ChatPanel'

describe('ChatPanel smoke', () => {
  it('renders', () => {
    const html = renderToStaticMarkup(createElement(ChatPanel, {
      subjectId: 'acct-7',
      kind: 'account' as const,
      label: '1007 Test Account',
      anchorIso: '2026-03-14',
      density: 'comfort' as const,
      composeOpen: false,
      onComposeClose: () => {},
    }))
    writeFileSync('/tmp/chat.html', html)
    expect(html.length).toBeGreaterThan(500)
  })
})
