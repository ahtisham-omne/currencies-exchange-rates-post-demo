import { createPortal } from 'react-dom'
import { ReadingRoom, type ReadingRoomConfig } from './walkthrough/ReadingRoom'

/* The Reading Room on a page rather than in a modal. The room positions itself
   against the modal it slides over; a page has no such frame, so this gives it
   one the size of the window, above the app shell. */
export function GuideSheet({ open, onClose, config }: { open: boolean; onClose: () => void; config: ReadingRoomConfig }) {
  if (!open) return null
  return createPortal(
    <div className="fixed inset-0 z-[70]">
      <ReadingRoom open onClose={onClose} config={config} />
    </div>,
    document.body,
  )
}
