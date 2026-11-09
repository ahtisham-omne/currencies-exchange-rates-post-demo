import { ReactNode, useState } from 'react'
import { createPortal } from 'react-dom'
import { BookOpen, X, ArrowRight, ArrowLeft, Check, Minus, Maximize2, Minimize2 } from 'lucide-react'
import { Button, ConfirmModal, Tooltip, HowItWorksButton } from './ui'
import { cn } from '../lib/utils'

// The persistent chrome around every wizard step: a module header bar (identity
// + step counter + close), a scrolling body, and a footer with a progress dot
// trail and generic Previous / Next navigation. Mirrors the Figma Make
// "Standard vs Custom Roles" pattern. Rendered as a full-screen overlay so the
// app sidebar is hidden while the wizard is active.
//
// The `modal` variant renders a centered dialog panel instead - used by the
// first-time Build-from-scratch and Guided setup flows so they match the sibling
// ERP modules (compact circular step indicator + Back / Cancel / Continue
// footer). Both used to render through a third variant that was this same panel
// pinned edge-to-edge with the Full view toggle taken out. Setting up a chart is
// long work that wants the whole screen, but that is the reader's call to make
// and unmake, not a state to be held in: full view is where these flows are
// most useful, not the only place they are usable.
// What the close button asks. Two different exits wear this dialog, and the
// difference is worth saying: leaving a wizard reached by its own route drops
// unpublished progress, while leaving one opened from "Choose how to begin" also
// puts the reader back in front of that choice. Naming the consequence is the
// whole job here, so neither version asks whether the reader is sure.
export const DISCARD_SETUP_CONFIRM = {
  badge: 'Discard setup',
  title: 'Discard setup?',
  description: "You haven't published your chart yet. Closing will discard your progress.",
  confirmLabel: 'Discard',
  dismissLabel: 'Continue editing',
}
export const LEAVE_SETUP_PATH_CONFIRM = {
  badge: 'Discard setup',
  title: 'Leave this setup path?',
  description: "You'll lose the accounts you've entered so far and choose a setup path again.",
  confirmLabel: 'Discard and choose again',
  dismissLabel: 'Stay on this path',
}

/* The step trail every wizard in the module wears: a tab bar of circular badge +
   label pairs, the current and completed ones underlined with a 2px bar
   (matching the Partners / Cash Management "Create" modal). Completed and
   current tabs jump backward when the wizard supplies onJump.

   A step the reader's own answers made unnecessary is marked skipped rather than
   dropped. The trail's whole job is to say how long this will take before it
   starts, so a step disappearing out of the middle of it would take that back.
 */
export function StepIndicator({ labels, stepIndex, maxStep, onJump, skipped }: {
  labels: string[]
  stepIndex: number
  // Highest step reached - steps up to it are backward-clickable.
  maxStep?: number
  onJump?: (i: number) => void
  skipped?: number[]
}) {
  return (
    <div className="flex items-center gap-4 sm:gap-6 overflow-x-auto -mb-px scrollbar-thin">
      {labels.map((label, i) => {
        const isSkipped = !!skipped?.includes(i)
        const done = !isSkipped && i < stepIndex
        const current = i === stepIndex
        const reachable = !!onJump && !isSkipped && i <= (maxStep ?? stepIndex)
        return (
          <button
            key={label}
            type="button"
            disabled={!reachable}
            onClick={() => reachable && onJump?.(i)}
            className={cn('relative flex items-center gap-2 pb-2.5 sm:pb-3 shrink-0', reachable && !current ? 'cursor-pointer' : 'cursor-default')}
          >
            <span className={cn('w-[22px] h-[22px] sm:w-6 sm:h-6 rounded-full flex items-center justify-center text-[11px] sm:text-xs shrink-0 transition-all',
              current ? 'bg-primary text-white'
                : done ? 'bg-emerald-500 text-white'
                : isSkipped ? 'border-[1.5px] border-dashed border-slate-300 text-slate-400 bg-white'
                : 'border-[1.5px] border-slate-300 text-slate-500 bg-white')}
              style={{ fontWeight: 600 }}>{done ? <Check size={12} /> : isSkipped ? <Minus size={12} /> : i + 1}</span>
            <span className={cn('text-xs sm:text-[13px] whitespace-nowrap transition-colors',
              current ? 'text-primary' : done ? 'text-emerald-500' : isSkipped ? 'text-slate-400' : 'text-slate-700')}
              style={{ fontWeight: current || done ? 600 : 500 }}>{label}</span>
            {(current || done) && <span className={cn('absolute bottom-0 left-0 right-0 h-[2px] rounded-t-full', done ? 'bg-emerald-500' : 'bg-primary')} />}
          </button>
        )
      })}
    </div>
  )
}

export function WizardChrome({
  variant = 'fullscreen',
  moduleName = 'Chart of Accounts',
  subtitle,
  stepIndex,
  stepLabels,
  maxStep,
  onJump,
  confirmOnClose,
  onDiscard,
  discardCopy = DISCARD_SETUP_CONFIRM,
  onLearn,
  learnOpen = false,
  onPrev,
  prevDisabled,
  onNext,
  nextDisabled,
  nextLabel = 'Next',
  footerMessage,
  footerExtra,
  fixedHeight,
  overlay,
  children,
}: {
  variant?: 'fullscreen' | 'modal'
  moduleName?: string
  subtitle: string
  stepIndex: number
  stepLabels: string[]
  // Highest step reached - steps up to it are backward-clickable (modal variant).
  maxStep?: number
  onJump?: (i: number) => void
  // When false (Overview, no changes), the close button exits immediately;
  // otherwise it prompts the discard confirmation.
  confirmOnClose: boolean
  onDiscard: () => void
  // Which consequence the close button names. Defaults to losing unpublished
  // progress; a wizard opened from the setup-path chooser passes the version that
  // also says the reader lands back on that choice.
  discardCopy?: typeof DISCARD_SETUP_CONFIRM
  // Opens the "How it works" guide (modal variant only).
  onLearn?: () => void
  // Whether that guide is showing. The button holds its pressed shading while it
  // is, so the header says which of the two panels the reader is looking at.
  learnOpen?: boolean
  onPrev: () => void
  prevDisabled?: boolean
  onNext: () => void
  nextDisabled?: boolean
  // "Next" on most steps, "Publish" on the last interactive step.
  nextLabel?: string
  // Optional warning / status text shown just left of the nav buttons.
  footerMessage?: ReactNode
  // Optional extra control left of Previous / Next.
  footerExtra?: ReactNode
  /* Holds the panel at one height on every step instead of letting it shrink to
     the shortest one. A wizard whose panel resizes between steps makes the reader
     re-find the footer each time, and the button they are heading for moves while
     they are heading for it.

     That height is capped rather than being 90vh outright. On a tall display the
     viewport share alone left the tallest step ending halfway down the panel and
     the footer stranded a screenful below it, which reads as a panel waiting for
     content that never arrives. The cap is the room that step actually asks for;
     past it the body scrolls, which it is built to do. */
  fixedHeight?: boolean
  /* A sheet drawn over the panel: the Learn guide, which is a panel of its own
     rather than a second modal. Rendered inside the panel, so it is clipped to
     the panel's rounded corners and rides its full-view transition. */
  overlay?: ReactNode
  children: ReactNode
}) {
  const [confirmOpen, setConfirmOpen] = useState(false)
  // "Full view" expands the modal panel to (near) full-screen, mirroring the
  // sibling Partners "Create Partner" modal.
  const [isFullScreen, setIsFullScreen] = useState(false)
  const stepCount = stepLabels.length

  const requestClose = () => {
    if (confirmOnClose) setConfirmOpen(true)
    else onDiscard()
  }

  const stepTrail = <StepIndicator labels={stepLabels} stepIndex={stepIndex} maxStep={maxStep} onJump={onJump} />

  const discardModal = (
    <ConfirmModal
      open={confirmOpen}
      tone="danger"
      badge={discardCopy.badge}
      title={discardCopy.title}
      description={discardCopy.description}
      confirmLabel={discardCopy.confirmLabel}
      dismissLabel={discardCopy.dismissLabel}
      onConfirm={() => { setConfirmOpen(false); onDiscard() }}
      onDismiss={() => setConfirmOpen(false)}
    />
  )

  if (variant === 'modal') {
    // Portal to <body>: the routed page sits under AppShell's `animate-page-in`
    // wrapper, whose `both` fill retains `transform: translateY(0)`. That
    // transform makes the wrapper the containing block for our `fixed` overlay,
    // collapsing it to the (short) page's height and stranding the footer
    // mid-screen. Portalling escapes the transformed ancestor.
    return createPortal(
      <>
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
          <div className="absolute inset-0 coa-scrim animate-overlay-in" onClick={requestClose} />
          <div
            className={cn(
              'relative bg-white flex flex-col overflow-hidden',
              'animate-modal-in transition-[max-width,max-height,border-radius] duration-300 ease-[cubic-bezier(0.32,0.72,0,1)]',
              isFullScreen
                ? 'rounded-2xl w-full h-full max-w-full max-h-full'
                : 'rounded-none sm:rounded-2xl w-full max-w-[100%] sm:max-w-[min(70vw,1320px)] max-h-[100dvh] sm:max-h-[90vh]',
              !isFullScreen && fixedHeight && 'h-[100dvh] sm:h-[min(90vh,760px)]',
            )}
            style={{ boxShadow: '0 24px 48px -12px rgba(0,0,0,0.18), 0 0 0 1px rgba(0,0,0,0.05)' }}
          >
            {/* Header: title + subtitle + How it works + close, with the step tab
                bar sitting on the bottom border. */}
            <div className="px-4 sm:px-5 pt-3 sm:pt-4 pb-0 shrink-0 bg-white border-b border-[#F1F5F9]">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h2 className="text-[15px] sm:text-lg text-fg leading-tight" style={{ fontWeight: 700 }}>{moduleName}</h2>
                  <p className="text-[11px] sm:text-xs text-slate-500 mt-0.5">{subtitle}</p>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  {onLearn && <HowItWorksButton place="wizard" walkthrough="wizard-learn" open={learnOpen} onClick={onLearn} />}
                  <button
                    type="button"
                    onClick={() => setIsFullScreen(v => !v)}
                    className="hidden sm:inline-flex items-center gap-1.5 h-8 sm:h-9 px-2.5 sm:px-3 rounded-lg border border-border bg-white text-xs sm:text-[13px] text-fg-muted hover:bg-slate-50 hover:border-slate-300 transition-all"
                    style={{ fontWeight: 500 }}
                  >
                    {isFullScreen ? <Minimize2 size={15} /> : <Maximize2 size={15} />}
                    {isFullScreen ? 'Exit full' : 'Full view'}
                  </button>
                  <button onClick={requestClose} aria-label="Close" className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-500 hover:bg-muted transition-all"><X size={18} /></button>
                </div>
              </div>
              {/* StepIndicator is shared with every other wizard, so the tour's
                  handle on the trail hangs outside it rather than being threaded
                  through its props. */}
              {stepCount > 1 && <div data-walkthrough="wizard-stepper" className="mt-3 sm:mt-3.5">{stepTrail}</div>}
            </div>
            {/* Body - keyed on step so each step change re-triggers the
                fade/rise transition. */}
            <div className="flex-1 min-h-0 overflow-y-auto bg-[#F8FAFC] scrollbar-thin px-4 sm:px-5 py-4 sm:py-5">
              <div key={stepIndex} className="animate-step-in">{children}</div>
            </div>
            {/* Footer */}
            <div className="shrink-0 border-t border-[#F1F5F9] bg-white px-4 sm:px-5 py-2.5 sm:py-3 flex items-center gap-2 sm:gap-2.5">
              {!prevDisabled && <Button variant="ghost" onClick={onPrev} icon={<ArrowLeft size={14} />}>Back</Button>}
              <div className="flex items-center gap-2 sm:gap-2.5 ml-auto">
                {footerMessage}
                {footerExtra}
                {/* The tour's last card points here, so the two buttons the
                    reader can leave the step by wear the handle together. */}
                <span data-walkthrough="wizard-footer" className="inline-flex items-center gap-2 sm:gap-2.5">
                  <Button variant="secondary" onClick={requestClose}>Cancel</Button>
                  <Button onClick={onNext} disabled={nextDisabled} iconRight={<ArrowRight size={14} />}>{nextLabel}</Button>
                </span>
              </div>
            </div>

            {overlay}
          </div>
        </div>
        {discardModal}
      </>,
      document.body,
    )
  }

  return createPortal(
    <div className="fixed inset-0 z-50 bg-white flex flex-col animate-fade-in">
      {/* Module header bar */}
      <header className="shrink-0 h-16 px-6 py-4 border-b border-border bg-white flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 rounded-lg bg-brand-50 text-primary flex items-center justify-center shrink-0">
            <BookOpen size={18} />
          </div>
          <div className="min-w-0">
            <div className="text-base font-semibold text-fg leading-tight truncate">{moduleName}</div>
            <div className="text-xs text-fg-muted">{subtitle}</div>
          </div>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          {stepCount > 1 && <span className="text-sm text-fg-muted tabular-nums">{stepIndex + 1} / {stepCount}</span>}
          <button onClick={requestClose} aria-label="Close wizard" className="btn-icon"><X size={18} /></button>
        </div>
      </header>

      {/* Body */}
      <main className="flex-1 overflow-y-auto scrollbar-thin">
        <div key={stepIndex} className="animate-step-in">{children}</div>
      </main>

      {/* Footer */}
      <footer className="shrink-0 h-16 px-6 py-4 border-t border-border bg-white flex items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          {stepCount > 1 && stepLabels.map((label, i) => {
            const done = i <= stepIndex
            const current = i === stepIndex
            return (
              <Tooltip key={label} content={label}>
                <span
                  className={cn(
                    'w-2 h-2 rounded-full transition-colors',
                    done ? 'bg-primary' : 'bg-bg-muted border border-border',
                    current && 'ring-2 ring-primary/20',
                  )}
                />
              </Tooltip>
            )
          })}
        </div>
        <div className="flex items-center gap-3">
          {footerMessage}
          {footerExtra}
          {stepCount > 1 && <Button variant="secondary" onClick={onPrev} disabled={prevDisabled}>Previous</Button>}
          <Button onClick={onNext} disabled={nextDisabled} iconRight={<ArrowRight size={14} />}>{nextLabel}</Button>
        </div>
      </footer>

      {discardModal}
    </div>,
    document.body,
  )
}
