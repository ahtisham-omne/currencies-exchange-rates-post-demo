/* ───────────────────── Taking a reader to what is wrong ─────────────────────
   The error rule, as Eli set it in the design review of 2026-10-02 and asked to
   go into the design system:

   - A form that refuses to submit says what is wrong and how many things are,
     in one place, next to the button.
   - And it takes the reader to the first of them: *"when you push the button,
     it should take you to the error message that it is and highlight it."*
   - Always the first one left, in page order: *"If I hit post, always take me
     to the first error on the message. Once I fix that, then take me to the
     next one that is the first one on the message."* Nothing is remembered
     between presses, so the page is the only state.

   This is the "take me there" half. The form decides which field is first; this
   scrolls it into the middle of the view, puts the cursor in it where it takes
   one, and blinks the field's own border red so the eye lands on it after the
   scroll. The blink is a class on the control itself (`form-error-flash`, in
   index.css) - the box with the border, not the block around its label and
   message - and the field's own red border, the lasting state, is left to the
   form. Design review, 2026-10-08 - Eli, of the ring that used to be drawn round
   the whole block: *"it should be the perimeter of this, not like a weird square
   box around it ... the actual perimeter should blink at you ... two, three
   times, and then it should stay red."* */

const prefersReducedMotion = () =>
  typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

const FOCUSABLE = 'input:not([disabled]), textarea:not([disabled]), select:not([disabled]), button:not([disabled])'
/* The control whose border blinks: the bordered box itself where the field has
   one, the element handed over where it has none. */
const BORDERED = '.input, textarea, select, input:not([type="hidden"]):not([type="checkbox"]):not([type="radio"])'

export const ERROR_FLASH_CLASS = 'form-error-flash'
const FLASH_MS = 1500

export function jumpToError(el: HTMLElement | null | undefined) {
  if (!el) return
  el.scrollIntoView({ block: 'center', behavior: prefersReducedMotion() ? 'auto' : 'smooth' })
  const focusable = el.matches(FOCUSABLE) ? el : el.querySelector<HTMLElement>(FOCUSABLE)
  focusable?.focus({ preventScroll: true })
  const target = el.matches(BORDERED) ? el : el.querySelector<HTMLElement>(BORDERED) ?? el
  // Restarted, not stacked, when the same field is pressed for twice in a row.
  target.classList.remove(ERROR_FLASH_CLASS)
  void target.offsetWidth
  target.classList.add(ERROR_FLASH_CLASS)
  window.setTimeout(() => target.classList.remove(ERROR_FLASH_CLASS), FLASH_MS)
}
