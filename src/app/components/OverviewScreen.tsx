import {
  useState,
  useEffect,
  useCallback,
  useRef,
  type ComponentType,
  type CSSProperties,
  type MouseEvent as ReactMouseEvent,
} from 'react';
import { DndProvider, useDrag, useDrop } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
import { toast } from 'sonner';
import {
  FileText,
  Receipt,
  CreditCard,
  Banknote,
  BarChart3,
  Plus,
  Upload,
  FilePlus,
  RotateCcw,
  Save,
  ArrowRight,
  ExternalLink,
  Coins,
  Landmark,
  BookOpen,
  LayoutDashboard,
} from 'lucide-react';
import type { AppView } from './Layout';
import { palette } from '@/styles/tokens';

// External destination for cross-module accounting features that live in
// the sibling Cash Management Lovable app.
const ACCOUNTING_EXTERNAL_URL = 'https://cash-management-v2.lovable.app/accounting';

interface ModuleCard {
  title: string;
  description: string;
  icon: ComponentType<{ className?: string; style?: CSSProperties }>;
  iconColor: string;
  iconBg: string;
  /** In-app view to switch to. Optional when externalHref is set. */
  view?: AppView;
  /** When set, clicking the card opens this URL in a new tab. */
  externalHref?: string;
  enabled: boolean;
  /** Renders the sidebar-style "Coming soon" chip on a disabled card. */
  comingSoon?: boolean;
}

// Module cards mirror the sidebar Accounting & Finance IA exactly (excluding
// Overview, which is the page itself). Order matches Layout.tsx FINANCE_CHILDREN.
const modules: ModuleCard[] = [
  {
    // Mirrors the sidebar's new Dashboard entry — the configurable
    // KPI + widget board covering invoicing and payments together.
    title: 'Dashboard',
    description: 'KPIs, trends, and charts across invoicing and payments.',
    icon: LayoutDashboard,
    iconColor: 'hsl(var(--violet))',
    iconBg: palette.violet[50],
    view: 'dashboard',
    enabled: true,
  },
  {
    // Design feedback 7/9/26 — the Modules card reads "Vendor
    // Invoicing" so it names the module the card opens, matching the
    // sidebar entry. AR copy stays dropped (parked behind usability
    // testing).
    title: 'Vendor Invoicing',
    description: 'Create, review, and manage vendor invoices.',
    // Receipt matches the module's own listing heading (7/15/26).
    icon: Receipt,
    iconColor: 'hsl(var(--primary))',
    iconBg: 'hsl(var(--accent))',
    view: 'invoices',
    enabled: true,
  },
  {
    title: 'Vendor Payments',
    description: 'Record and settle vendor payments, vendor by vendor.',
    icon: Banknote,
    iconColor: palette.green[700],
    iconBg: palette.green[50],
    view: 'payments-v2',
    enabled: true,
  },
  // AR mirrors — live modules since 7/17/26, so the cards navigate like
  // their sidebar entries do.
  {
    // Module name, vendor parity (Vendor Invoicing / Customer Invoicing).
    title: 'Customer Invoicing',
    description: 'Bill customers for shipments, advances and charges',
    icon: FileText,
    iconColor: palette.sky[700],
    iconBg: palette.sky[50],
    view: 'customer-invoices',
    enabled: true,
  },
  {
    title: 'Customer Payments',
    description: 'Record and reconcile customer payments.',
    icon: CreditCard,
    iconColor: palette.purple[700],
    iconBg: palette.purple[50],
    view: 'customer-payments',
    enabled: true,
  },
  // ─── External — Cash Management Lovable app ───
  // Combined modules match the sidebar's IA: Chart of Accounts +
  // General Ledger live together, Currency Library + Exchange Rate
  // Library live together. Costing Methods has moved out of
  // Accounting & Finance into Company Setup (one-time setup) and
  // therefore is no longer in this grid.
  {
    title: 'Chart of Accounts & General Ledger',
    description: 'Browse accounts and review journal entries.',
    icon: BookOpen,
    iconColor: palette.indigo[700],
    iconBg: palette.indigo[50],
    externalHref: ACCOUNTING_EXTERNAL_URL,
    enabled: true,
  },
  {
    title: 'Currency Library & Exchange Rate Library',
    description: 'Manage currencies and exchange rates.',
    icon: Coins,
    iconColor: palette.teal[700],
    iconBg: palette.teal[50],
    externalHref: ACCOUNTING_EXTERNAL_URL,
    enabled: true,
  },
  {
    title: 'Cash Management',
    description: 'Bank accounts, feeds, transactions, and reconciliation.',
    icon: Landmark,
    iconColor: palette.pink[700],
    iconBg: palette.pink[50],
    externalHref: ACCOUNTING_EXTERNAL_URL,
    enabled: true,
  },
  {
    title: 'Financial Reporting',
    description: 'View P&L, balance sheet, and cash-flow reports.',
    icon: BarChart3,
    iconColor: palette.cyan[700],
    iconBg: palette.cyan[50],
    externalHref: ACCOUNTING_EXTERNAL_URL,
    enabled: true,
  },
];

interface RecommendedAction {
  title: string;
  description: string;
  icon: ComponentType<{ className?: string; style?: CSSProperties }>;
  iconColor: string;
  iconBg: string;
  view?: AppView;
}

const recommendedActions: RecommendedAction[] = [
  {
    title: 'Create New Vendor Invoice',
    description: 'Start a new vendor invoice from scratch.',
    icon: Plus,
    iconColor: 'hsl(var(--primary))',
    iconBg: 'hsl(var(--accent))',
    view: 'invoices',
  },
  {
    title: 'Import Invoices',
    description: 'Bulk import from a spreadsheet.',
    icon: Upload,
    iconColor: 'hsl(var(--violet))',
    iconBg: palette.violet[50],
  },
  {
    title: 'Record Prepayment',
    description: 'Log a new vendor prepayment.',
    icon: FilePlus,
    iconColor: palette.orange[600],
    iconBg: palette.orange[50],
    view: 'prepayments',
  },
];

interface ActivityItem {
  label: string;
  time: string;
  dotColor: string;
}

const recentActivity: ActivityItem[] = [
  { label: 'Invoice Created: INV-000043', time: '2h ago', dotColor: 'hsl(var(--primary))' },
  { label: 'Payment Posted: UPS Corp', time: '4h ago', dotColor: 'hsl(var(--success))' },
  { label: 'Prepayment Logged: Toyota Intl.', time: '1d ago', dotColor: 'hsl(var(--muted-foreground))' },
  { label: 'GRN Matched: PO-7741', time: '1d ago', dotColor: 'hsl(var(--violet))' },
  { label: 'Invoice Flagged: INV-000024', time: '2d ago', dotColor: palette.orange[600] },
];

// v3: Vendor Payments split into V1/V2 and the Customer placeholders were
// inserted mid-grid, which shifts every module index — a bumped key drops
// stale saved orders.
const STORAGE_KEY_MODULES = 'vendor-invoicing-home-module-order-v3';
const DND_MODULE = 'MODULE_CARD';

const DEFAULT_MODULE_ORDER = modules.map((_, i) => i);

function loadFromStorage<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (raw) return JSON.parse(raw) as T;
  } catch {
    /* ignore */
  }
  return fallback;
}

function DraggableModuleCard({
  mod,
  index,
  moveCard,
  onNavigate,
}: {
  mod: ModuleCard;
  index: number;
  moveCard: (from: number, to: number) => void;
  onNavigate: (view: AppView) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);

  const [{ isDragging }, drag, preview] = useDrag({
    type: DND_MODULE,
    item: () => ({ index }),
    collect: (monitor) => ({ isDragging: monitor.isDragging() }),
  });

  const [{ isOver }, drop] = useDrop({
    accept: DND_MODULE,
    hover(item: { index: number }, monitor) {
      if (!ref.current) return;
      const dragIndex = item.index;
      const hoverIndex = index;
      if (dragIndex === hoverIndex) return;
      const hoverRect = ref.current.getBoundingClientRect();
      const hoverMiddleX = (hoverRect.right - hoverRect.left) / 2;
      const hoverMiddleY = (hoverRect.bottom - hoverRect.top) / 2;
      const clientOffset = monitor.getClientOffset();
      if (!clientOffset) return;
      const hoverClientX = clientOffset.x - hoverRect.left;
      const hoverClientY = clientOffset.y - hoverRect.top;
      if (dragIndex < hoverIndex && hoverClientY < hoverMiddleY && hoverClientX < hoverMiddleX) return;
      if (dragIndex > hoverIndex && hoverClientY > hoverMiddleY && hoverClientX > hoverMiddleX) return;
      moveCard(dragIndex, hoverIndex);
      item.index = hoverIndex;
    },
    collect: (monitor) => ({ isOver: monitor.isOver() }),
  });

  preview(drop(ref));
  drag(ref);

  const Icon = mod.icon;

  const mouseDownPos = useRef<{ x: number; y: number } | null>(null);

  const handleMouseDown = (e: ReactMouseEvent) => {
    mouseDownPos.current = { x: e.clientX, y: e.clientY };
  };

  const handleClick = (e: ReactMouseEvent) => {
    if (!mouseDownPos.current) return;
    const dx = Math.abs(e.clientX - mouseDownPos.current.x);
    const dy = Math.abs(e.clientY - mouseDownPos.current.y);
    mouseDownPos.current = null;
    if (dx < 5 && dy < 5 && mod.enabled) {
      // External links (Cash Management app) open in a new tab; in-app
      // views switch the active screen.
      if (mod.externalHref) {
        window.open(mod.externalHref, '_blank', 'noopener');
      } else if (mod.view) {
        onNavigate(mod.view);
      }
    }
  };

  if (isDragging) {
    return (
      <div
        ref={ref}
        className="rounded-xl border border-dashed border-primary/20 bg-primary/[0.02] min-h-[88px] opacity-40 pointer-events-none"
      >
        <div className="px-3.5 pt-3 pb-3">
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center mb-2 opacity-50"
            style={{ backgroundColor: mod.iconBg }}
          >
            <Icon className="w-4 h-4" style={{ color: mod.iconColor }} />
          </div>
          <p className="text-[13px] mb-0.5 opacity-50" style={{ fontWeight: 500 }}>
            {mod.title}
          </p>
          <p className="text-[11px] text-muted-foreground leading-relaxed opacity-50">
            {mod.description}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={ref}
      onMouseDown={handleMouseDown}
      onClick={handleClick}
      className={`group/card relative text-left bg-card border rounded-xl px-3.5 pt-3 pb-3 transition-all duration-200 cursor-pointer active:cursor-grabbing ${
        isOver
          ? 'border-primary/40 bg-primary/[0.04] shadow-[0_0_0_2px_rgba(10,119,255,0.10)] scale-[1.02]'
          : 'border-border hover:shadow-md hover:border-primary/20'
      } ${!mod.enabled ? 'opacity-70' : ''}`}
    >
      {isOver && (
        <div className="absolute inset-0 rounded-xl bg-primary/[0.03] pointer-events-none" />
      )}

      {mod.enabled && (
        <div className="absolute top-2.5 right-2.5 flex items-center gap-2 opacity-0 group-hover/card:opacity-100 transition-opacity z-10">
          <span
            className="inline-flex items-center gap-0.5 text-[11px]"
            style={{ color: 'hsl(var(--primary))', fontWeight: 500 }}
          >
            Open
            {mod.externalHref ? (
              <ExternalLink className="w-3 h-3" />
            ) : (
              <ArrowRight className="w-3 h-3" />
            )}
          </span>
        </div>
      )}

      {mod.comingSoon && (
        <span
          className="absolute top-2.5 right-2.5 inline-flex items-center whitespace-nowrap px-1.5 py-0 rounded-md text-[10px] bg-slate-50 text-slate-400 border border-slate-200"
          style={{ fontWeight: 500 }}
        >
          Coming Soon
        </span>
      )}

      <div
        className="w-8 h-8 rounded-lg flex items-center justify-center mb-2"
        style={{ backgroundColor: mod.iconBg }}
      >
        <Icon className="w-4 h-4" style={{ color: mod.iconColor }} />
      </div>
      <p className="text-[13px] mb-0.5" style={{ fontWeight: 500 }}>
        {mod.title}
      </p>
      <p className="text-[11px] text-muted-foreground leading-relaxed">{mod.description}</p>
    </div>
  );
}

interface OverviewScreenProps {
  onNavigate: (view: AppView) => void;
}

export function OverviewScreen({ onNavigate }: OverviewScreenProps) {
  // Backfill any module indices added after the user last saved a custom
  // order — otherwise the new Cash Management / Currency Library / Exchange
  // Rates cards wouldn't appear for returning users with a saved layout.
  const initialOrder = (() => {
    const saved = loadFromStorage(STORAGE_KEY_MODULES, DEFAULT_MODULE_ORDER);
    const seen = new Set(saved);
    const missing = DEFAULT_MODULE_ORDER.filter((i) => !seen.has(i));
    return missing.length > 0 ? [...saved, ...missing] : saved;
  })();
  const [moduleOrder, setModuleOrder] = useState<number[]>(initialOrder);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const savedModuleOrder = useRef(initialOrder);

  useEffect(() => {
    const changed = JSON.stringify(moduleOrder) !== JSON.stringify(savedModuleOrder.current);
    setHasUnsavedChanges(changed);
  }, [moduleOrder]);

  const moveModuleCard = useCallback((from: number, to: number) => {
    setModuleOrder((prev) => {
      const next = [...prev];
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      return next;
    });
  }, []);

  const saveLayout = useCallback(() => {
    localStorage.setItem(STORAGE_KEY_MODULES, JSON.stringify(moduleOrder));
    savedModuleOrder.current = moduleOrder;
    setHasUnsavedChanges(false);
    toast.success('Layout saved', { description: 'Your custom layout has been saved.' });
  }, [moduleOrder]);

  const resetLayout = useCallback(() => {
    setModuleOrder(DEFAULT_MODULE_ORDER);
    localStorage.removeItem(STORAGE_KEY_MODULES);
    savedModuleOrder.current = DEFAULT_MODULE_ORDER;
    setHasUnsavedChanges(false);
    toast.info('Layout reset', { description: 'Restored to default layout.' });
  }, []);

  const orderedModules = moduleOrder.map((i) => modules[i]).filter(Boolean);

  return (
    <div className="bg-slate-50 min-h-full">
      <DndProvider backend={HTML5Backend}>
        <div className="px-4 sm:px-5 lg:px-6 py-3 sm:py-4 w-full max-w-[1120px] mx-auto">
          {/* Page Header */}
          <div className="mb-3 sm:mb-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-0.5">
              <h1 className="text-xl sm:text-2xl font-bold">Accounting &amp; Finance</h1>
              <div className="flex items-center gap-1.5">
                {hasUnsavedChanges && (
                  <button
                    onClick={saveLayout}
                    className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg border border-primary/20 bg-primary/5 hover:bg-primary/10 transition-colors cursor-pointer"
                    style={{ color: 'hsl(var(--primary))', fontWeight: 500 }}
                  >
                    <Save className="w-3 h-3" />
                    Save Layout
                  </button>
                )}
                <button
                  onClick={resetLayout}
                  className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg border border-border hover:bg-muted/40 text-muted-foreground transition-colors cursor-pointer"
                  style={{ fontWeight: 500 }}
                >
                  <RotateCcw className="w-3 h-3" />
                  <span className="hidden sm:inline">Reset</span>
                </button>
              </div>
            </div>
            <p className="text-xs sm:text-sm text-muted-foreground">
              Manage AP invoices, prepayments, payments, receiving documents,
              currencies, exchange rates, and cash management, all your
              financial operations in one place.{' '}
              <button
                // An honest destination (GPT QC09, 9/30: the control did
                // nothing on click or Enter) — the guide isn't written
                // yet, so the click says so instead of staying silent.
                onClick={() =>
                  toast.info('The module guide is on its way', {
                    description: 'A walkthrough of Accounting & Finance is being written. Until it lands, each screen’s tooltips and helpers carry the explanations.',
                  })
                }
                className="inline-flex items-center gap-1 text-xs sm:text-sm hover:underline cursor-pointer"
                style={{ color: 'hsl(var(--primary))', fontWeight: 500 }}
              >
                Learn More
                <ExternalLink className="w-3 h-3" />
              </button>
            </p>
          </div>

          {/* Modules */}
          <div className="mb-4 sm:mb-5">
            <h4 className="text-sm text-muted-foreground mb-2 sm:mb-2.5" style={{ fontWeight: 500 }}>
              Modules
            </h4>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-3 gap-2.5">
              {orderedModules.map((mod, idx) => (
                <DraggableModuleCard
                  key={mod.title}
                  mod={mod}
                  index={idx}
                  moveCard={moveModuleCard}
                  onNavigate={onNavigate}
                />
              ))}
            </div>
          </div>

          {/* Recommended Actions + Recent Activity */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-2.5">
            <div className="lg:col-span-2">
              <h4 className="text-sm text-muted-foreground mb-2 sm:mb-2.5" style={{ fontWeight: 500 }}>
                Recommended Actions
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {recommendedActions.map((action) => {
                  const Icon = action.icon;
                  return (
                    <button
                      key={action.title}
                      onClick={() => action.view && onNavigate(action.view)}
                      className={`flex items-center gap-3 bg-card border border-border rounded-xl px-3.5 py-3 text-left transition-all ${
                        action.view
                          ? 'hover:shadow-sm hover:border-primary/20 cursor-pointer'
                          : 'opacity-60 cursor-default'
                      }`}
                    >
                      <div
                        className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                        style={{ backgroundColor: action.iconBg }}
                      >
                        <Icon className="w-4 h-4" style={{ color: action.iconColor }} />
                      </div>
                      <div className="min-w-0">
                        <p className="text-[13px]" style={{ fontWeight: 500 }}>
                          {action.title}
                        </p>
                        <p className="text-[11px] text-muted-foreground">{action.description}</p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="lg:col-span-1">
              <div className="flex items-center justify-between mb-2 sm:mb-2.5">
                <h4 className="text-sm text-muted-foreground" style={{ fontWeight: 500 }}>
                  Recent Activity
                </h4>
                <button
                  className="text-xs hover:underline"
                  style={{ color: 'hsl(var(--primary))', fontWeight: 500 }}
                >
                  View More
                </button>
              </div>
              <div className="bg-card border border-border rounded-xl divide-y divide-border">
                {recentActivity.map((item, idx) => (
                  <div key={idx} className="flex items-center gap-2.5 px-3.5 py-2.5">
                    <span
                      className="w-1.5 h-1.5 rounded-full shrink-0"
                      style={{ backgroundColor: item.dotColor }}
                    />
                    <span className="text-[13px] flex-1 min-w-0 truncate">{item.label}</span>
                    <span
                      className="text-[11px] text-muted-foreground shrink-0"
                      style={{ fontWeight: 400 }}
                    >
                      {item.time}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </DndProvider>
    </div>
  );
}
