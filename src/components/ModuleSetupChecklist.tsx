import { Package, Users, ShoppingCart, Receipt, Check, CircleDot, Circle, X, ArrowRight } from 'lucide-react'
import type { ReactNode } from 'react'
import type { Account } from '../types'
import { GUIDED_CONTROL_NUMBERS } from '../lib/guidedSetup'
import { useStore } from '../store'
import { Badge, Button, Card } from './ui'
import { cn } from '../lib/utils'

// The "Configure in your modules" bridge: some accounts the guided wizard
// creates exist now but have no meaning until a module knows how to use them.
// This module owns both the post-publish screen table and the persistent
// dismissible checklist card on the Chart of Accounts.

export type ModuleId = 'items' | 'partners' | 'purchasing' | 'tax'
export type ModuleStatus = 'todo' | 'partial' | 'ready'
export interface ModuleChecklistItem { moduleId: ModuleId; status: ModuleStatus }

interface ModuleMeta {
  id: ModuleId
  name: string
  icon: ReactNode
  accounts: string
  youSet: string
}

export const MODULE_META: Record<ModuleId, ModuleMeta> = {
  items: { id: 'items', name: 'Items', icon: <Package size={16} />, accounts: 'Inventory, COGS, Revenue', youSet: 'Which account each item posts to' },
  partners: { id: 'partners', name: 'Partners', icon: <Users size={16} />, accounts: 'A/R, A/P, tax code', youSet: 'Which control account and tax applies per customer / vendor' },
  purchasing: { id: 'purchasing', name: 'Purchasing', icon: <ShoppingCart size={16} />, accounts: 'AP Accrual', youSet: 'Confirm the clearing account (already defaulted)' },
  tax: { id: 'tax', name: 'Tax', icon: <Receipt size={16} />, accounts: 'Sales Tax / VAT Payable', youSet: 'Link the payable to each tax code' },
}

const STATUS_META: Record<ModuleStatus, { label: string; tone: 'success' | 'warning' | 'neutral'; icon: ReactNode }> = {
  ready: { label: 'Ready', tone: 'success', icon: <Check size={11} /> },
  partial: { label: 'Partial', tone: 'warning', icon: <CircleDot size={11} /> },
  todo: { label: 'Not configured', tone: 'neutral', icon: <Circle size={11} /> },
}

function hasAccount(accounts: Account[], number: string): boolean {
  return accounts.some(a => a.accountNumber === number || a.masterChartRef === number)
}

// Derive module readiness from the published chart. Company-level control
// accounts (AP Accrual, Sales Tax Payable) come pre-wired, so Purchasing / Tax
// are Ready the moment those accounts exist. Per-item and per-partner mapping
// only the user can do, so Items / Partners start Not configured.
export function deriveModuleChecklist(accounts: Account[]): ModuleChecklistItem[] {
  const purchasing: ModuleStatus = hasAccount(accounts, GUIDED_CONTROL_NUMBERS.apAccrual) ? 'ready' : 'todo'
  const tax: ModuleStatus = hasAccount(accounts, GUIDED_CONTROL_NUMBERS.salesTaxPayable) ? 'ready' : 'todo'
  return [
    { moduleId: 'items', status: 'todo' },
    { moduleId: 'partners', status: 'todo' },
    { moduleId: 'purchasing', status: purchasing },
    { moduleId: 'tax', status: tax },
  ]
}

function StatusPill({ status }: { status: ModuleStatus }) {
  const m = STATUS_META[status]
  return <Badge tone={m.tone}>{m.icon} {m.label}</Badge>
}

// The full table used on the wizard's final "Configure in your modules" screen.
export function ModuleSetupTable({ items }: { items: ModuleChecklistItem[] }) {
  return (
    <div className="rounded-xl border border-border overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-bg-subtle text-left text-fg-muted">
            <th className="px-4 py-2.5 font-medium">Module</th>
            <th className="px-4 py-2.5 font-medium">Accounts</th>
            <th className="px-4 py-2.5 font-medium">You set</th>
            <th className="px-4 py-2.5 font-medium text-right">Status</th>
          </tr>
        </thead>
        <tbody>
          {items.map(({ moduleId, status }) => {
            const meta = MODULE_META[moduleId]
            return (
              <tr key={moduleId} className="border-t border-border">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2 font-medium text-fg">
                    <span className="w-7 h-7 rounded-lg bg-brand-50 text-primary flex items-center justify-center shrink-0">{meta.icon}</span>
                    {meta.name}
                  </div>
                </td>
                <td className="px-4 py-3 text-fg-muted">{meta.accounts}</td>
                <td className="px-4 py-3 text-fg-muted">{meta.youSet}</td>
                <td className="px-4 py-3 text-right"><StatusPill status={status} /></td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

// The persistent, dismissible checklist card on the Chart of Accounts. Reads
// state from the store; renders nothing when there's no checklist, it's been
// dismissed, or every module is already Ready.
export function ModuleSetupChecklistCard() {
  const company = useStore(s => s.company)
  const dismiss = useStore(s => s.dismissModuleChecklist)
  const checklist = company.moduleSetupChecklist
  if (!checklist || checklist.dismissed) return null
  const items = checklist.items
  const allReady = items.every(i => i.status === 'ready')
  if (allReady) return null
  const remaining = items.filter(i => i.status !== 'ready').length

  return (
    <Card className="p-4 mb-4 border-brand-100 bg-brand-50/40">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold text-fg">Finish setting up your modules</h3>
            <Badge tone="brand">{remaining} left</Badge>
          </div>
          <p className="text-xs text-fg-muted mt-0.5">
            Your chart is live. A few accounts still need to be wired up in their modules before they do anything.
          </p>
        </div>
        <button onClick={dismiss} aria-label="Dismiss" className="btn-icon shrink-0 -mr-1 -mt-1"><X size={16} /></button>
      </div>
      <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2">
        {items.map(({ moduleId, status }) => {
          const meta = MODULE_META[moduleId]
          return (
            <div key={moduleId} className={cn('flex items-center justify-between gap-2 rounded-lg border px-3 py-2 bg-white',
              status === 'ready' ? 'border-border/60' : 'border-border')}>
              <div className="flex items-center gap-2 min-w-0">
                <span className="w-6 h-6 rounded-md bg-brand-50 text-primary flex items-center justify-center shrink-0">{meta.icon}</span>
                <div className="min-w-0">
                  <div className="text-sm font-medium text-fg truncate">{meta.name}</div>
                  <div className="text-2xs text-fg-subtle truncate">{meta.accounts}</div>
                </div>
              </div>
              <StatusPill status={status} />
            </div>
          )
        })}
      </div>
    </Card>
  )
}

// Compact "next steps" footer shown on the wizard's modules screen, above the
// primary "Go to Chart of Accounts" action.
export function ModuleSetupHint() {
  return (
    <div className="flex items-start gap-2 text-xs text-fg-muted">
      <ArrowRight size={14} className="text-primary mt-0.5 shrink-0" />
      <span>None of this blocks you - it reappears as a checklist on the Chart of Accounts until each module is ready.</span>
    </div>
  )
}
