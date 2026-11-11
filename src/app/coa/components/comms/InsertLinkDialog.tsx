/* Ported from the financial reporting module (components/fr/comms/InsertLinkDialog.tsx).

   The shared "Insert link" flow for the comms rich-text editor. Two stacked
   fields - a required URL and an optional display text - and the DOM insertion
   against the given editor:

     • Display text provided (or no selection) → insert a fresh anchor labelled
       with the display text, falling back to the URL.
     • Display text blank but text was selected → wrap the selection, keeping
       its text as the link label.

   The outer wrapper's positioning and surface come from `containerClassName` so
   each host can place it as an inline bar or a floating popover while the fields
   themselves stay identical.

   Colours are the source's own primitives, which resolve because this renders
   inside the tab's `data-comms` root. */
import { useEffect, useRef, useState } from 'react'

export function InsertLinkDialog({
  open,
  editorRef,
  savedSelection,
  initialText,
  onClose,
  onInserted,
  containerClassName,
}: {
  open: boolean
  editorRef: React.RefObject<HTMLElement | null>
  /** Selection captured before the dialog stole focus, restored on insert. */
  savedSelection: Range | null
  /** Highlighted text, used to pre-fill the display-text field. */
  initialText?: string
  onClose: () => void
  /** Called after a successful insert, for draft tracking and refocus. */
  onInserted?: () => void
  containerClassName?: string
}) {
  const [url, setUrl] = useState('')
  const [text, setText] = useState('')
  const urlRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!open) return undefined
    setUrl('')
    setText(initialText ?? '')
    const t = window.setTimeout(() => urlRef.current?.focus(), 0)
    return () => window.clearTimeout(t)
  }, [open, initialText])

  if (!open) return null

  const reset = () => { setUrl(''); setText('') }
  const cancel = () => { reset(); onClose() }

  const insert = () => {
    const u = url.trim()
    if (!u) return
    // Normalise a bare domain to a real href, or the anchor is not clickable.
    const href = /^[a-z][a-z0-9+.-]*:|^\//i.test(u) ? u : `https://${u}`
    const label = text.trim()

    editorRef.current?.focus()
    const sel = window.getSelection()
    if (sel && savedSelection) {
      sel.removeAllRanges()
      sel.addRange(savedSelection)
    } else if (sel && editorRef.current) {
      // Opened without a caret in the editor: drop it at the very end so the
      // link appends where the reader can see it.
      const range = document.createRange()
      range.selectNodeContents(editorRef.current)
      range.collapse(false)
      sel.removeAllRanges()
      sel.addRange(range)
    }

    const hadSelection = !!savedSelection && !savedSelection.collapsed
    if (label || !hadSelection) {
      const shown = label || u
      const safe = shown.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      // The trailing space puts the caret outside the anchor, so what the
      // reader types next is not swallowed into the link.
      document.execCommand(
        'insertHTML',
        false,
        `<a href="${href}" target="_blank" rel="noopener noreferrer">${safe}</a>&nbsp;`,
      )
    } else {
      document.execCommand('createLink', false, href)
    }

    onInserted?.()
    reset()
    onClose()
  }

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') { e.preventDefault(); insert() }
    if (e.key === 'Escape') { e.preventDefault(); cancel() }
  }

  const inputClass =
    'flex-1 text-[13px] text-gray-700 outline-none py-1.5 px-2.5 border border-gray-200 rounded-md bg-white focus:border-[var(--color-sky-500)] focus:ring-1 focus:ring-[var(--color-sky-500)]/20 transition-colors'
  const labelClass = 'text-[12px] text-gray-500 w-[92px] shrink-0'

  return (
    <div className={containerClassName}>
      <div className="flex items-center gap-2">
        <label className={labelClass} style={{ fontWeight: 500 }}>URL</label>
        <input
          ref={urlRef}
          type="text"
          value={url}
          onChange={e => setUrl(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder="https://…"
          className={inputClass}
        />
      </div>
      <div className="flex items-center gap-2">
        <label className={labelClass} style={{ fontWeight: 500 }}>Display Text</label>
        <input
          type="text"
          value={text}
          onChange={e => setText(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder="Optional"
          className={inputClass}
        />
      </div>
      <div className="flex items-center justify-end gap-3 pt-0.5">
        <button onClick={cancel} className="text-[12px] text-gray-500 hover:text-gray-700" style={{ fontWeight: 500 }}>Cancel</button>
        <button
          onClick={insert}
          disabled={!url.trim()}
          className="text-[12px] px-3 py-1.5 rounded-md bg-[var(--color-sky-500)] text-white hover:bg-[var(--color-brand-600)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          style={{ fontWeight: 500 }}
        >
          Insert
        </button>
      </div>
    </div>
  )
}
