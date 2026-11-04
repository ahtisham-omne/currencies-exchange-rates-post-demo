import { useState } from 'react';
import { Star, Plus, X, Check, Trash2, LayoutGrid, Info } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/app/components/ui/dialog';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/app/components/ui/tooltip';
import { Button } from '@/app/components/ui/button';
import { Input } from '@/app/components/ui/input';
import { toast } from 'sonner';

export interface SavedView {
  id: string;
  name: string;
  filters: any;
  /** Starred views (up to MAX_STARRED_VIEWS) surface as quick-apply
   *  chips in the Filters panel; the rest live only in the dialog. */
  starred: boolean;
}

export const MAX_STARRED_VIEWS = 3;

// Facet labels for the row summaries. Keys cover both the invoice and
// payment filter shapes; date/amount pairs collapse into one facet so
// "From + To" reads as a single range.
const FILTER_FACET_LABELS: Record<string, string> = {
  statuses: 'Status',
  status: 'Status',
  types: 'Type',
  type: 'Type',
  payment: 'Payment Status',
  createdBy: 'Created By',
  vendors: 'Vendor',
  customers: 'Customer',
  methods: 'Method',
  accounts: 'Account',
  currencies: 'Currency',
  dateFrom: 'Invoice Date',
  dateTo: 'Invoice Date',
  dueFrom: 'Due Date',
  dueTo: 'Due Date',
  amountMin: 'Amount',
  amountMax: 'Amount',
  period: 'Period',
  periodCustom: 'Period',
};

// "Is this facet doing anything?" — 'all' is the payments period default,
// so it counts as inactive just like an empty string or array. Object
// facets (per-column filter states, date/period ranges) ignore their
// 'kind' discriminator, which is always set.
function facetActive(value: any): boolean {
  if (Array.isArray(value)) return value.length > 0;
  if (value && typeof value === 'object') {
    return Object.entries(value).some(([k, x]) =>
      k !== 'kind' && (Array.isArray(x) ? x.length > 0 : String(x ?? '').trim() !== ''));
  }
  if (typeof value === 'string') return value.trim() !== '' && value !== 'all';
  return Boolean(value);
}

// Unknown facet keys fall back to a humanized camelCase split, so the
// per-column filter shapes (dueDate, outstandingBalance, ...) summarize
// without registering every table's columns.
const humanizeKey = (key: string) =>
  (key.charAt(0).toUpperCase() + key.slice(1)).replace(/([a-z0-9])([A-Z])/g, (_m, a, b) => `${a} ${b}`);

export function summarizeFilters(filters: any): string {
  if (!filters) return 'No filters';
  const parts: string[] = [];
  const seen = new Set<string>();
  for (const [key, value] of Object.entries(filters)) {
    const label = FILTER_FACET_LABELS[key] ?? humanizeKey(key);
    if (seen.has(label)) continue;
    if (!facetActive(value)) continue;
    seen.add(label);
    const count = Array.isArray(value)
      ? value.length
      : Array.isArray((value as any)?.values) && (value as any).values.length > 0
        ? (value as any).values.length
        : null;
    parts.push(count ? `${label} ${count}` : label);
  }
  return parts.length > 0 ? parts.join(' · ') : 'No filters';
}

// Order-insensitive filter equality so the chip row can tell which saved
// view (if any) exactly matches what's currently set.
const normFacet = (v: any): string =>
  Array.isArray(v)
    ? [...v].map(String).sort().join('|')
    : v && typeof v === 'object'
      ? JSON.stringify(v)
      : String(v ?? '');

export function filtersEqual(a: any, b: any): boolean {
  const keys = new Set([...Object.keys(a ?? {}), ...Object.keys(b ?? {})]);
  for (const key of keys) {
    if (normFacet(a?.[key]) !== normFacet(b?.[key])) return false;
  }
  return true;
}

// One list shared by the in-panel chip row and the dialog, so saving from
// either surface shows up in both.
export function useSavedViews(seedViews: SavedView[]) {
  const [views, setViews] = useState<SavedView[]>(seedViews);

  // New views auto-star while a chip slot is free, so the save is
  // immediately visible in the panel; past the cap they land in the list.
  const saveView = (name: string, filters: any): SavedView => {
    const starred = views.filter((v) => v.starred).length < MAX_STARRED_VIEWS;
    const view: SavedView = { id: Date.now().toString(), name, filters, starred };
    setViews((prev) => [...prev, view]);
    return view;
  };

  const deleteView = (id: string) => setViews((prev) => prev.filter((v) => v.id !== id));

  const toggleStar = (id: string): 'starred' | 'unstarred' | 'limit' => {
    const target = views.find((v) => v.id === id);
    if (!target) return 'limit';
    if (!target.starred && views.filter((v) => v.starred).length >= MAX_STARRED_VIEWS) {
      return 'limit';
    }
    setViews((prev) => prev.map((v) => (v.id === id ? { ...v, starred: !v.starred } : v)));
    return target.starred ? 'unstarred' : 'starred';
  };

  return { views, saveView, deleteView, toggleStar };
}

/* ─── In-panel section (9/4/26): ONLY the starred views render as chips,
   keeping the panel light — the full list stays in the Saved Views
   dialog. The exact-match chip reads active, and once the filters drift
   from every saved view a "Save as view" affordance appears so the tweak
   can be kept as a new one. ─── */
interface SavedViewsSectionProps {
  views: SavedView[];
  currentFilters: any;
  hasActiveFilters: boolean;
  onApply: (view: SavedView) => void;
  onSaveCurrent: (name: string) => SavedView;
}

export function SavedViewsSection({
  views,
  currentFilters,
  hasActiveFilters,
  onApply,
  onSaveCurrent,
}: SavedViewsSectionProps) {
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState('');

  const starredViews = views.filter((v) => v.starred);
  // Match against ALL views (not just starred) so an unstarred twin never
  // invites a duplicate save.
  const activeId = views.find((v) => filtersEqual(v.filters, currentFilters))?.id ?? null;
  const canSave = hasActiveFilters && !activeId;

  if (starredViews.length === 0 && !canSave) return null;

  const handleSave = () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    const saved = onSaveCurrent(trimmed);
    setName('');
    setSaving(false);
    toast.success('View saved', {
      description: saved.starred
        ? `"${trimmed}" is starred and shows in this panel.`
        : `"${trimmed}" is in Saved Views. Star it there to show it here.`,
    });
  };

  return (
    <div>
      {/* Helper copy lives in the info tooltip (9/4 review) — the two-line
          subtitle wasted vertical space at the top of every modal. */}
      <div className="flex items-center gap-1.5 mb-2.5">
        <p className="text-[13px]" style={{ fontWeight: 600, color: 'hsl(var(--foreground))' }}>
          Saved Views
        </p>
        <Tooltip>
          <TooltipTrigger asChild>
            <span className="text-slate-400 hover:text-slate-500 transition-colors cursor-help inline-flex">
              <Info className="w-3.5 h-3.5" />
            </span>
          </TooltipTrigger>
          <TooltipContent side="right" sideOffset={6} className="max-w-[250px] text-[11px] leading-[1.5] z-[300]">
            Your starred views, one click applies the whole combination. Adjust anything below, then save it as a new view.
          </TooltipContent>
        </Tooltip>
      </div>
      <div className="flex flex-wrap gap-1.5 items-center">
        {starredViews.map((view) => {
          const active = view.id === activeId;
          return (
            <button
              key={view.id}
              type="button"
              onClick={() => onApply(view)}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs cursor-pointer transition-colors ${
                active
                  ? 'border-primary bg-accent text-primary'
                  : 'border-border bg-white text-foreground hover:bg-muted/50'
              }`}
              style={{ fontWeight: 500 }}
            >
              <Star className={`w-3 h-3 ${active ? 'fill-primary text-primary' : 'fill-slate-300 text-slate-300'}`} />
              {view.name}
              {active && <Check className="w-3.5 h-3.5" />}
            </button>
          );
        })}
        {canSave && !saving && (
          <button
            type="button"
            onClick={() => setSaving(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-dashed border-primary/40 text-primary text-xs hover:bg-accent transition-colors cursor-pointer"
            style={{ fontWeight: 500 }}
          >
            <Plus className="w-3 h-3" />
            Save as View
          </button>
        )}
      </div>
      {saving && (
        <div className="flex items-center gap-2 mt-2.5">
          <Input
            autoFocus
            placeholder="Name this view..."
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="h-8 flex-1 text-[12px] bg-white border-border/80"
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleSave();
              if (e.key === 'Escape') { setSaving(false); setName(''); }
            }}
          />
          <Button size="sm" className="h-8 text-[12px]" onClick={handleSave} disabled={!name.trim()}>
            Save
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-8 text-[12px] text-muted-foreground"
            onClick={() => { setSaving(false); setName(''); }}
          >
            Cancel
          </Button>
        </div>
      )}
    </div>
  );
}

/* ─── Saved Views dialog — partner FiltersModal chrome (centered title,
   round close button on the left, divided rows, sticky footer). The row
   itself applies the view; the star pins it to the Filters panel (max
   MAX_STARRED_VIEWS); delete shows on hover. ─── */
interface SavedViewsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentFilters: any;
  onApplyView: (filters: any) => void;
  views: SavedView[];
  onSaveView: (name: string) => void;
  onDeleteView: (id: string) => void;
  onToggleStar: (id: string) => 'starred' | 'unstarred' | 'limit';
}

export function SavedViewsDialog({
  open,
  onOpenChange,
  currentFilters,
  onApplyView,
  views,
  onSaveView,
  onDeleteView,
  onToggleStar,
}: SavedViewsDialogProps) {
  const [showSaveForm, setShowSaveForm] = useState(false);
  const [newViewName, setNewViewName] = useState('');

  const handleSaveCurrentView = () => {
    if (!newViewName.trim()) {
      toast.error('View name required', {
        description: 'Please enter a name for this view.'
      });
      return;
    }
    const name = newViewName.trim();
    onSaveView(name);
    setNewViewName('');
    setShowSaveForm(false);
    toast.success('View saved', {
      description: `"${name}" has been saved to your views.`
    });
  };

  const handleDeleteView = (id: string) => {
    const view = views.find(v => v.id === id);
    onDeleteView(id);
    toast.success('View deleted', {
      description: `"${view?.name}" has been removed.`
    });
  };

  const handleToggleStar = (id: string) => {
    const view = views.find(v => v.id === id);
    const result = onToggleStar(id);
    if (result === 'limit') {
      toast.error('Star limit reached', {
        description: `Up to ${MAX_STARRED_VIEWS} views can be starred. Unstar one first.`
      });
    } else if (result === 'starred') {
      toast.success('View starred', {
        description: `"${view?.name}" now shows in the Filters panel.`
      });
    } else {
      toast.success('Star removed', {
        description: `"${view?.name}" no longer shows in the Filters panel.`
      });
    }
  };

  const handleApplyView = (view: SavedView) => {
    onApplyView(view.filters);
    onOpenChange(false);
    toast.success('View applied', {
      description: `Filters from "${view.name}" have been applied.`
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        // Stacks above the Filters modal (content z-[210]) — without the
        // lifted overlay the dim lands BEHIND the parent and the two
        // modals visually merge. Softer dim per the stacked-modal
        // precedent (CreatePaymentTermModal).
        className="max-w-[520px] p-0 gap-0 overflow-hidden border-0 rounded-2xl shadow-[0_24px_60px_rgba(0,0,0,0.18)] bg-white flex flex-col max-h-[80vh] z-[230]"
        overlayClassName="z-[220] !bg-black/30"
        showCloseButton={false}
      >
        <DialogTitle className="sr-only">Saved Views</DialogTitle>
        <DialogDescription className="sr-only">
          Save and manage filter combinations for quick access.
        </DialogDescription>

        {/* Header */}
        <div className="relative flex items-center justify-center h-12 border-b border-border/60 shrink-0">
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="absolute left-3 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full flex items-center justify-center hover:bg-muted/60 transition-colors cursor-pointer"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
          <span className="text-[14px]" style={{ fontWeight: 600 }}>Saved Views</span>
          {views.length > 0 && (
            <span
              className="ml-2 min-w-[20px] h-5 rounded-full text-[11px] flex items-center justify-center px-1.5 bg-muted text-muted-foreground "
              style={{ fontWeight: 600 }}
            >
              {views.length}
            </span>
          )}
        </div>

        {/* View rows */}
        <div className="flex-1 overflow-y-auto overscroll-contain">
          {views.length === 0 ? (
            <div className="px-6 py-12 text-center">
              <LayoutGrid className="w-5 h-5 text-slate-300 mx-auto mb-2.5" />
              <p className="text-[13px] text-foreground" style={{ fontWeight: 600 }}>No saved views yet</p>
              <p className="text-[12px] text-muted-foreground mt-1">
                Set some filters, then save them here for quick access.
              </p>
            </div>
          ) : (
            <>
              <p className="px-5 pt-3 pb-1 text-[11px] text-muted-foreground">
                Starred views (up to {MAX_STARRED_VIEWS}) show as quick chips in the Filters panel.
              </p>
              <div className="divide-y divide-border/50">
                {views.map((view) => (
                  <div
                    key={view.id}
                    onClick={() => handleApplyView(view)}
                    className="group flex items-center gap-3 px-5 py-3.5 hover:bg-slate-50/80 transition-colors cursor-pointer"
                  >
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); handleToggleStar(view.id); }}
                      className="w-7 h-7 -ml-1.5 rounded-md flex items-center justify-center hover:bg-primary/[0.06] transition-colors shrink-0 cursor-pointer"
                      aria-label={view.starred ? 'Unstar view' : 'Star view'}
                    >
                      <Star
                        className={`w-4 h-4 transition-colors ${
                          view.starred
                            ? 'text-primary fill-primary'
                            : 'text-slate-300 hover:text-primary'
                        }`}
                      />
                    </button>

                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] text-foreground truncate" style={{ fontWeight: 600 }}>
                        {view.name}
                      </p>
                      <p className="text-[11px] text-muted-foreground mt-0.5 truncate">
                        {summarizeFilters(view.filters)}
                      </p>
                    </div>

                    <span
                      className="shrink-0 text-[12px] text-primary opacity-0 group-hover:opacity-100 transition-opacity"
                      style={{ fontWeight: 500 }}
                    >
                      Apply
                    </span>
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); handleDeleteView(view.id); }}
                      className="w-7 h-7 rounded-md flex items-center justify-center text-slate-300 hover:text-rose-600 hover:bg-rose-50 opacity-0 group-hover:opacity-100 transition-all shrink-0 cursor-pointer"
                      aria-label="Delete view"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Sticky footer — save the filters currently set in the Filters
            modal. The summary shows exactly what would be captured. */}
        <div className="border-t border-border/60 shrink-0 bg-white">
          {showSaveForm ? (
            <div className="flex items-center gap-2 px-5 py-3">
              <Input
                autoFocus
                placeholder="Name this view..."
                value={newViewName}
                onChange={(e) => setNewViewName(e.target.value)}
                className="h-9 flex-1 text-[13px] bg-white border-border/80"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleSaveCurrentView();
                  if (e.key === 'Escape') { setShowSaveForm(false); setNewViewName(''); }
                }}
              />
              <Button size="sm" className="h-9 text-[12px]" onClick={handleSaveCurrentView}>
                Save View
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-9 text-[12px] text-muted-foreground"
                onClick={() => { setShowSaveForm(false); setNewViewName(''); }}
              >
                Cancel
              </Button>
            </div>
          ) : (
            <div className="flex items-center justify-between gap-3 px-5 h-14">
              <p className="text-[11px] text-muted-foreground truncate">
                Current Filters: {summarizeFilters(currentFilters)}
              </p>
              <Button size="sm" className="h-9 text-[12px] shrink-0" onClick={() => setShowSaveForm(true)}>
                <Plus className="w-3.5 h-3.5 mr-1.5" />
                Save Current Filters
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
