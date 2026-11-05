import { useState } from 'react';
import {
  X, ArrowLeft, Maximize2, Minimize2, Pencil, Archive, Lock, Info, Check,
  TrendingDown, TrendingUp, Search, Plus, Package, FolderOpen, Users, FileText,
  Paperclip, Clock, BookOpen, CircleSlash, Copy,
} from 'lucide-react';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/app/components/ui/dialog';
import { Input } from '@/app/components/ui/input';
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from '@/app/components/ui/tooltip';
import { toast } from 'sonner';
import type { PricingRule } from '@/app/components/so/PricingRulesLibrary';

interface PricingRuleDetailModalProps {
  rule: PricingRule | null;
  isOpen: boolean;
  onClose: () => void;
  onEdit?: (rule: PricingRule) => void;
  onDuplicate?: (rule: PricingRule) => void;
  onApply?: (rule: PricingRule) => void;
}

export function PricingRuleDetailModal({ rule, isOpen, onClose, onEdit, onDuplicate, onApply }: PricingRuleDetailModalProps) {
  const [tab, setTab] = useState<string>('overview');
  const [isFullscreen, setIsFullscreen] = useState(false);

  if (!rule) return null;
  const isDis = rule.category === 'discount';
  const isPreset = rule.isPreset;
  const theme = isDis
    ? { text: '#047857', pillBg: '#ECFDF5', pillBorder: '#D1FAE5' }
    : { text: '#6D28D9', pillBg: '#F5F3FF', pillBorder: '#EDE9FE' };

  const tabs = [
    { id: 'overview', label: 'Overview', icon: FileText },
    { id: 'items', label: 'Items', icon: Package, count: rule.itemCount },
    { id: 'categories', label: 'Categories', icon: FolderOpen, count: rule.categoryCount },
    { id: 'partners', label: 'Partners', icon: Users, count: rule.partnerCount },
    { id: 'notes', label: 'Notes', icon: BookOpen },
    { id: 'attachments', label: 'Attachments', icon: Paperclip },
    { id: 'activity', label: 'Recent Activity', icon: Clock },
  ];

  const creatorInitials = rule.createdBy.split(' ').map((n) => n[0]).join('');

  const close = () => {
    onClose();
    setIsFullscreen(false);
    setTab('overview');
  };

  return (
    <TooltipProvider delayDuration={150}>
      <Dialog open={isOpen} onOpenChange={(v) => { if (!v) close(); }}>
        <DialogContent
          hideCloseButton
          overlayClassName="z-[12150]"
          className={`flex flex-col p-0 gap-0 border-0 sm:border !z-[12151] transition-[max-width,max-height,border-radius] duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] ${
            isFullscreen
              ? '!fixed !inset-0 !translate-x-0 !translate-y-0 !m-auto !w-full !h-full !max-w-[calc(100%-1rem)] sm:!max-w-[calc(100%-1.5rem)] lg:!max-w-[calc(100%-2rem)] !max-h-[calc(100%-1rem)] sm:!max-h-[calc(100%-1.5rem)] lg:!max-h-[calc(100%-2rem)] !rounded-2xl'
              : '!fixed !inset-0 !translate-x-0 !translate-y-0 !m-auto !w-full !h-full !max-w-[100%] sm:!max-w-[min(75vw,1480px)] !max-h-[100dvh] sm:!max-h-[min(88vh,1180px)] sm:!min-h-[640px] rounded-none sm:!rounded-2xl'
          }`}
          style={{ boxShadow: '0 24px 48px -12px rgba(0,0,0,0.18), 0 0 0 1px rgba(0,0,0,0.05)' }}
        >
          <DialogTitle className="sr-only">Pricing Rule Details — {rule.name}</DialogTitle>
          <DialogDescription className="sr-only">Detailed view of pricing rule {rule.name}</DialogDescription>

          {/* Header */}
          <div className="shrink-0 bg-white rounded-t-none sm:rounded-t-2xl border-b border-border">
            <div className="px-4 sm:px-5 pt-3 pb-3">
              <div className="flex items-start gap-3">
                <button onClick={close} className="w-8 h-8 rounded-lg border border-border bg-white flex items-center justify-center hover:bg-slate-50 transition-colors cursor-pointer shrink-0 mt-0.5">
                  <ArrowLeft className="w-3.5 h-3.5 text-slate-700" />
                </button>
                {/* Themed avatar */}
                <div
                  className="w-[52px] h-[52px] rounded-xl flex flex-col items-center justify-center shrink-0 gap-0.5"
                  style={{ backgroundColor: theme.pillBg, border: `1px solid ${theme.pillBorder}` }}
                >
                  {isDis ? <TrendingDown className="w-4 h-4" style={{ color: theme.text }} /> : <TrendingUp className="w-4 h-4" style={{ color: theme.text }} />}
                  <span className="text-[11px] tabular-nums leading-none" style={{ color: theme.text, fontWeight: 700 }}>
                    {rule.tiers[0]?.discount || '—'}
                  </span>
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex items-center flex-wrap gap-2">
                    <h1 className="text-[17px] text-foreground truncate" style={{ fontWeight: 700 }}>{rule.name}</h1>
                    {/* Type segmented pill */}
                    <span className="inline-flex items-stretch rounded-full overflow-hidden border shrink-0" style={{ borderColor: theme.pillBorder }}>
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10.5px]" style={{ fontWeight: 600, color: theme.text, backgroundColor: theme.pillBg }}>
                        {isDis ? <TrendingDown className="w-3 h-3" /> : <TrendingUp className="w-3 h-3" />}
                        {isDis ? 'Discount' : 'Premium'}
                      </span>
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10.5px] bg-white text-slate-500 border-l" style={{ fontWeight: 500, borderColor: theme.pillBorder }}>
                        {rule.basis === 'volume' ? 'Volume' : 'Value'}-Based
                      </span>
                    </span>
                    {/* Status */}
                    <span
                      className="inline-flex items-center px-2 py-0.5 rounded-full text-[10.5px] border"
                      style={{
                        fontWeight: 500,
                        backgroundColor: rule.status === 'Active' ? '#ECFDF5' : '#FFFBEB',
                        color: rule.status === 'Active' ? '#065F46' : '#92400E',
                        borderColor: rule.status === 'Active' ? '#A7F3D0' : '#FDE68A',
                      }}
                    >
                      {rule.status}
                    </span>
                    {/* Template / Custom marker */}
                    <span className={`inline-flex items-center gap-1 px-1.5 py-[3px] rounded-md border text-[9px] ${isPreset ? 'bg-muted border-slate-300 text-slate-500' : 'border-slate-300 bg-white text-slate-500'}`} style={{ fontWeight: 600 }}>
                      {isPreset ? <><Lock className="w-2.5 h-2.5" /> TEMPLATE</> : 'CUSTOM'}
                    </span>
                  </div>
                  {rule.description && (
                    <p className="text-[12px] text-slate-500 mt-1.5 leading-relaxed line-clamp-1">{rule.description}</p>
                  )}
                </div>

                {/* Right-side actions */}
                <div className="flex items-center gap-1.5 shrink-0">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span tabIndex={0} className="hidden sm:inline-flex">
                        <button
                          onClick={() => { if (!isPreset && onEdit) { onEdit(rule); close(); } }}
                          disabled={isPreset}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border bg-white text-xs text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-white disabled:pointer-events-none"
                          style={{ fontWeight: 500 }}
                        >
                          <Pencil className="w-3.5 h-3.5" /> Edit
                        </button>
                      </span>
                    </TooltipTrigger>
                    {isPreset && (
                      <TooltipContent side="bottom" sideOffset={6} className="max-w-[260px] text-center leading-relaxed z-[12200]">
                        This rule ships as a system template, so it can&rsquo;t be edited directly. Use <span className="font-semibold">Duplicate</span> to create a custom copy you can edit.
                      </TooltipContent>
                    )}
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span tabIndex={0} className="hidden sm:inline-flex">
                        <button
                          onClick={() => !isPreset && toast.info(`"${rule.name}" archived`)}
                          disabled={isPreset}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-red-200 bg-red-50 text-xs text-red-700 hover:bg-red-100 hover:border-[#FCA5A5] transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-red-50 disabled:pointer-events-none"
                          style={{ fontWeight: 500 }}
                        >
                          <Archive className="w-3.5 h-3.5" /> Archive
                        </button>
                      </span>
                    </TooltipTrigger>
                    {isPreset && (
                      <TooltipContent side="bottom" sideOffset={6} className="max-w-[260px] text-center leading-relaxed z-[12200]">
                        System templates can&rsquo;t be archived because they ship with the software. <span className="font-semibold">Duplicate</span> the template if you need a version you can manage.
                      </TooltipContent>
                    )}
                  </Tooltip>
                  <button
                    onClick={() => toast.info(`"${rule.name}" disabled`)}
                    className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-amber-200 bg-amber-50 text-xs text-amber-800 hover:bg-[#FEF3C7] hover:border-[#FCD34D] transition-colors cursor-pointer"
                    style={{ fontWeight: 500 }}
                  >
                    <CircleSlash className="w-3.5 h-3.5" /> Disable
                  </button>
                  <button
                    onClick={() => setIsFullscreen(!isFullscreen)}
                    className="w-8 h-8 rounded-lg border border-border bg-white flex items-center justify-center text-slate-500 hover:text-slate-700 hover:bg-slate-50 transition-all cursor-pointer"
                  >
                    {isFullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
                  </button>
                  <button
                    onClick={close}
                    className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-500 hover:text-slate-700 hover:bg-slate-50 transition-all cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Body — tabs */}
          <div className="flex flex-1 overflow-hidden min-h-0">
            <div className="flex-1 flex flex-col overflow-hidden bg-slate-50">
              <div className="flex items-center border-b border-border shrink-0 px-1 bg-white overflow-x-auto">
                {tabs.map((t) => {
                  const active = tab === t.id;
                  return (
                    <button
                      key={t.id}
                      onClick={() => setTab(t.id)}
                      className={`inline-flex items-center px-4 py-3 text-xs border-b-2 transition-all cursor-pointer whitespace-nowrap ${
                        active ? 'border-primary text-primary' : 'border-transparent text-slate-500 hover:text-slate-700'
                      }`}
                      style={{ fontWeight: active ? 600 : 500 }}
                    >
                      {t.label}
                      {t.count !== undefined && (
                        <span className={`ml-1.5 text-[10px] rounded-full px-1.5 py-0.5 ${active ? 'bg-primary/10 text-primary' : 'bg-muted text-slate-500'}`} style={{ fontWeight: 600 }}>
                          {t.count}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>

              {/* Overview Tab */}
              {tab === 'overview' && (
                <div className="flex-1 overflow-y-auto bg-[#FAFBFC]">
                  <div className="max-w-[820px] mx-auto px-4 sm:px-6 py-5 space-y-5">
                    {/* Mode banner */}
                    <div className="rounded-lg border border-[#E8ECF1] bg-white px-3.5 py-2.5 flex items-start gap-2.5">
                      <div className="w-7 h-7 rounded-md flex items-center justify-center shrink-0 bg-slate-50 border border-[#E8ECF1] text-slate-500">
                        <Lock className="w-3.5 h-3.5" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-[12.5px] text-foreground" style={{ fontWeight: 600 }}>
                          {isPreset ? 'System template (read-only)' : 'Custom rule (read-only)'}
                        </p>
                        <p className="text-[11.5px] text-slate-500 mt-0.5 leading-relaxed">
                          {isPreset
                            ? "This rule ships with the software, so it can't be edited or archived. Duplicate it to create a customizable version."
                            : "Click Edit in the header to modify this rule's details."}
                        </p>
                      </div>
                    </div>

                    {/* Pricing Rule Type */}
                    <div>
                      <div className="flex items-center gap-1.5 mb-3">
                        <span className="text-sm text-foreground" style={{ fontWeight: 600 }}>Pricing Rule Type</span>
                        <Tooltip>
                          <TooltipTrigger asChild><span><Info className="w-3.5 h-3.5 text-slate-300 cursor-help" /></span></TooltipTrigger>
                          <TooltipContent side="bottom" sideOffset={6} className="max-w-[260px] text-[11px] leading-[1.5] z-[12200]">
                            <p className="text-slate-500">Type is fixed once a rule is created. To change it, duplicate and pick a new type.</p>
                          </TooltipContent>
                        </Tooltip>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        {([
                          { key: 'discount', label: 'Discount', desc: 'Lower price adjustment', icon: TrendingDown, color: '#047857', bg: '#ECFDF5', border: '#D1FAE5', activeBg: '#16A34A' },
                          { key: 'premium', label: 'Premium', desc: 'Higher price adjustment', icon: TrendingUp, color: '#6D28D9', bg: '#F5F3FF', border: '#EDE9FE', activeBg: '#8B5CF6' },
                        ] as const).map((t) => {
                          const isActive = rule.category === t.key;
                          return (
                            <div key={t.key} className={`relative rounded-xl overflow-hidden border transition-all duration-200 ${isActive ? 'bg-white shadow-[0_1px_4px_rgba(0,0,0,0.06)]' : 'border-border bg-white opacity-50'}`} style={isActive ? { borderColor: `${t.border}b3` } : undefined}>
                              {isActive && <div className="absolute inset-0 pointer-events-none" style={{ background: `linear-gradient(135deg, ${t.bg}80 0%, transparent 70%)` }} />}
                              <div className="relative flex items-center gap-3 pl-3.5 pr-3 py-3">
                                <div className="w-9 h-9 rounded-[10px] flex items-center justify-center shrink-0" style={{ background: `linear-gradient(135deg, ${t.bg}, ${t.border}40)`, color: t.color }}>
                                  <t.icon className="w-[18px] h-[18px]" />
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className="text-[13px]" style={{ fontWeight: 600, color: isActive ? t.color : '#475569' }}>{t.label}</p>
                                  <p className="text-[11px] mt-0.5 truncate" style={{ color: isActive ? t.color : '#94A3B8' }}>{t.desc}</p>
                                </div>
                                <div className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 ${isActive ? '' : 'border-[1.5px] border-[#D1D5DB] bg-white'}`} style={isActive ? { backgroundColor: t.activeBg, boxShadow: `0 0 0 2px ${t.activeBg}26` } : {}}>
                                  {isActive && <Check className="w-3 h-3 text-white" strokeWidth={2.5} />}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* Pricing Rule Details */}
                    <div>
                      <div className="flex items-center gap-1.5 mb-3">
                        <span className="text-sm text-foreground" style={{ fontWeight: 600 }}>Pricing Rule Details</span>
                        <Tooltip>
                          <TooltipTrigger asChild><span><Info className="w-3.5 h-3.5 text-slate-300 cursor-help" /></span></TooltipTrigger>
                          <TooltipContent side="bottom" sideOffset={6} className="max-w-[260px] text-[11px] leading-[1.5] z-[12200]">
                            <p className="text-slate-500">Name, basis, and description as they appear on POs and invoices.</p>
                          </TooltipContent>
                        </Tooltip>
                      </div>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <div className="rounded-xl border border-[#E8ECF1] bg-white p-4">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-3">
                              <div>
                                <label className="text-[12px] text-foreground block" style={{ fontWeight: 500 }}>{isDis ? 'Discount' : 'Premium'} Name</label>
                                <Input value={rule.name} disabled className="mt-1 !h-10 text-sm" />
                              </div>
                              <div>
                                <label className="text-[12px] text-foreground block" style={{ fontWeight: 500 }}>Calculation Basis</label>
                                <Input value={rule.basis === 'volume' ? 'Volume-Based' : 'Value-Based'} disabled className="mt-1 !h-10 text-sm" />
                              </div>
                              <div className="sm:col-span-2">
                                <label className="text-[12px] text-foreground block" style={{ fontWeight: 500 }}>Description</label>
                                <Input value={rule.description} disabled placeholder="—" className="mt-1 !h-10 text-sm" />
                              </div>
                              {rule.hasDateLimit && (
                                <>
                                  <div>
                                    <label className="text-[12px] text-foreground block" style={{ fontWeight: 500 }}>Valid From</label>
                                    <Input value={rule.validFrom} disabled className="mt-1 !h-10 text-sm" />
                                  </div>
                                  <div>
                                    <label className="text-[12px] text-foreground block" style={{ fontWeight: 500 }}>Valid To</label>
                                    <Input value={rule.validTo} disabled className="mt-1 !h-10 text-sm" />
                                  </div>
                                </>
                              )}
                            </div>
                          </div>
                        </TooltipTrigger>
                        <TooltipContent side="top" sideOffset={6} className="max-w-[260px] text-center leading-relaxed text-xs z-[12200]">
                          {isPreset
                            ? <>This is a system template and can&rsquo;t be edited. Use <span className="font-semibold">Duplicate</span> to make a custom version.</>
                            : <>Click <span className="font-semibold">Edit</span> in the header to modify this rule.</>}
                        </TooltipContent>
                      </Tooltip>
                    </div>

                    {/* Tier Details */}
                    <div>
                      <div className="flex items-center gap-1.5 mb-3">
                        <span className="text-sm text-foreground" style={{ fontWeight: 600 }}>{isDis ? 'Discount' : 'Premium'} Tiers</span>
                        <span className="text-[10px] rounded-full px-1.5 py-0.5 bg-muted text-slate-500" style={{ fontWeight: 600 }}>{rule.tiers.length}</span>
                      </div>
                      <div className="rounded-xl border border-[#E8ECF1] bg-white p-4 space-y-2">
                        {rule.tiers.map((tier, idx) => (
                          <div key={idx} className="flex items-center justify-between px-3 py-2.5 rounded-lg border border-[#E8ECF1] bg-[#FAFBFC]">
                            <div className="flex items-center gap-2.5 text-[12px]">
                              <span className="w-5 h-5 rounded flex items-center justify-center text-[10px] shrink-0" style={{ backgroundColor: theme.pillBg, color: theme.text, fontWeight: 700 }}>{idx + 1}</span>
                              <span className="text-slate-500">{tier.minQty}</span>
                              <span className="text-slate-300">–</span>
                              <span className="text-slate-500">{tier.maxQty}</span>
                            </div>
                            <span className="text-[12px] text-foreground tabular-nums" style={{ fontWeight: 600 }}>{tier.discount}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Metadata footer */}
                    <div className="flex items-center gap-3 pt-2 text-[11.5px] text-slate-500" style={{ fontWeight: 500 }}>
                      <span className="inline-flex items-center gap-2">
                        <div className="w-6 h-6 rounded-full flex items-center justify-center text-[10px]" style={{ fontWeight: 700, backgroundColor: isPreset ? '#E7F0FF' : theme.pillBg, color: isPreset ? '#0A77FF' : theme.text }}>
                          {isPreset ? 'OS' : creatorInitials}
                        </div>
                        <span>Created by <span className="text-slate-700" style={{ fontWeight: 600 }}>{isPreset ? 'Omnesoft' : rule.createdBy}</span></span>
                      </span>
                      <span className="w-1 h-1 rounded-full bg-slate-300" />
                      <span>Created <span className="text-slate-700" style={{ fontWeight: 600 }}>{rule.createdDate}</span></span>
                    </div>
                  </div>
                </div>
              )}

              {/* Other tabs — placeholder content (full data tables not yet wired) */}
              {tab !== 'overview' && (
                <div className="flex-1 overflow-y-auto bg-white">
                  <div className="max-w-[820px] mx-auto px-4 sm:px-6 py-5">
                    <div className="flex items-center gap-2 mb-4">
                      <div className="relative flex-1 max-w-xs">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                        <Input placeholder={`Search ${tab}...`} className="pl-9 rounded-lg border-border bg-slate-50 text-[13px] h-9" />
                      </div>
                      {(tab === 'items' || tab === 'categories' || tab === 'partners') && (
                        <button
                          onClick={() => toast.info('Wire SO data source to enable.')}
                          className="inline-flex items-center gap-1.5 h-9 px-3 rounded-lg bg-primary hover:bg-[#0862D0] text-white text-[12px] shadow-sm transition-colors cursor-pointer"
                          style={{ fontWeight: 600 }}
                        >
                          <Plus className="w-3.5 h-3.5" /> Add {tab === 'items' ? 'Item' : tab === 'categories' ? 'Category' : 'Partner'}
                        </button>
                      )}
                    </div>
                    <div className="py-12 text-center">
                      <div className="w-12 h-12 rounded-xl bg-slate-50 border border-[#E8ECF1] flex items-center justify-center mx-auto mb-3">
                        {tab === 'items' && <Package className="w-5 h-5 text-slate-400" />}
                        {tab === 'categories' && <FolderOpen className="w-5 h-5 text-slate-400" />}
                        {tab === 'partners' && <Users className="w-5 h-5 text-slate-400" />}
                        {tab === 'notes' && <BookOpen className="w-5 h-5 text-slate-400" />}
                        {tab === 'attachments' && <Paperclip className="w-5 h-5 text-slate-400" />}
                        {tab === 'activity' && <Clock className="w-5 h-5 text-slate-400" />}
                      </div>
                      <p className="text-[13px] text-slate-700 mb-1" style={{ fontWeight: 600 }}>
                        {tab === 'items' && `${rule.itemCount} items linked`}
                        {tab === 'categories' && `${rule.categoryCount} categories linked`}
                        {tab === 'partners' && `${rule.partnerCount} partners using this rule`}
                        {tab === 'notes' && 'No notes yet'}
                        {tab === 'attachments' && 'No attachments yet'}
                        {tab === 'activity' && 'No recent activity'}
                      </p>
                      <p className="text-[11px] text-slate-400 max-w-[320px] mx-auto">
                        Detailed tables for this section are not yet wired in the Sales Order module. The aggregate count is shown above.
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Footer */}
          <div className="shrink-0 border-t border-[#EEF2F6] bg-white px-4 sm:px-5 py-3 flex items-center justify-between gap-2 sm:rounded-b-2xl">
            <p className="text-[11px] text-slate-400" style={{ fontWeight: 500 }}>Reviewing: <span className="text-slate-700" style={{ fontWeight: 600 }}>{rule.name}</span></p>
            <div className="flex items-center gap-2" />

          </div>
        </DialogContent>
      </Dialog>
    </TooltipProvider>
  );
}
