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
  Plus,
  Upload,
  FilePlus,
  RotateCcw,
  Save,
  ArrowRight,
  ExternalLink,
  PackageCheck,
  Truck,
  Undo2,
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
  /** Whether the card navigates. All cards look alike; the ones with nowhere
   *  to go simply drop the hover affordance and swallow the click. */
  enabled: boolean;
}

// Module cards mirror the sidebar Supply Chain Management IA. RMA is the
// only module that leads anywhere in this port.
const modules: ModuleCard[] = [
  {
    title: 'Vendor Returns',
    description: 'Track goods returning to vendors, from draft through resolution.',
    icon: Undo2,
    iconColor: palette.amber[700],
    iconBg: palette.amber[50],
    view: 'rma',
    enabled: true,
  },
  {
    title: 'Receiving',
    description: 'Log goods received against purchase orders (GRN).',
    icon: PackageCheck,
    iconColor: palette.green[700],
    iconBg: palette.green[50],
    enabled: false,
  },
  {
    title: 'Purchase Orders',
    description: 'Create and track POs across vendors.',
    icon: FileText,
    iconColor: palette.sky[700],
    iconBg: palette.sky[50],
    enabled: false,
  },
  {
    title: 'Shipments',
    description: 'Outbound shipments and carrier tracking.',
    icon: Truck,
    iconColor: palette.violet[600],
    iconBg: palette.violet[50],
    enabled: false,
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
    title: 'Create New RMA',
    description: 'Raise a return against a source PO.',
    icon: Plus,
    iconColor: 'hsl(var(--primary))',
    iconBg: 'hsl(var(--accent))',
    view: 'rma',
  },
  {
    title: 'Ship pending returns',
    description: 'Ship approved RMAs waiting on the dock.',
    icon: Upload,
    iconColor: palette.violet[600],
    iconBg: palette.violet[50],
    view: 'rma',
  },
  {
    title: 'Receive returned goods',
    description: 'Log incoming returned units from vendors.',
    icon: FilePlus,
    iconColor: palette.orange[600],
    iconBg: palette.orange[50],
    view: 'rma',
  },
];


// v4: Inventory and Vendor Catalog were dropped from the grid, which shifts
// every module index after them — a bumped key drops stale saved orders.
const STORAGE_KEY_MODULES = 'vendor-invoicing-home-module-order-v4';
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
      className={`group/card relative text-left bg-card border rounded-xl px-3.5 pt-3 pb-3 transition-all duration-200 active:cursor-grabbing ${
        isOver
          ? 'border-primary/40 bg-primary/[0.04] shadow-[0_0_0_2px_rgba(10,119,255,0.10)] scale-[1.02]'
          : mod.enabled
            ? 'border-border hover:shadow-md hover:border-primary/20'
            : 'border-border'
      } ${mod.enabled ? 'cursor-pointer' : 'cursor-default'}`}
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

interface SupplyChainOverviewScreenProps {
  onNavigate: (view: AppView) => void;
}

export function SupplyChainOverviewScreen({ onNavigate }: SupplyChainOverviewScreenProps) {
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
              <h1 className="text-xl sm:text-2xl font-bold">Supply Chain Management</h1>
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
              Raise, ship, and close vendor returns, receive goods against
              purchase orders, and keep every downstream inventory movement
              traceable back to the source PO.{' '}
              <button
                className="inline-flex items-center gap-1 text-xs sm:text-sm hover:underline"
                style={{ color: 'hsl(var(--primary))', fontWeight: 500 }}
              >
                Learn more
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

          {/* Recommended Actions — greyed out until wired */}
          <div>
            <h4 className="text-sm text-muted-foreground mb-2 sm:mb-2.5" style={{ fontWeight: 500 }}>
              Recommended Actions
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 opacity-50 pointer-events-none">
              {recommendedActions.map((action) => {
                const Icon = action.icon;
                return (
                  <button
                    key={action.title}
                    className="flex items-center gap-3 bg-card border border-border rounded-xl px-3.5 py-3 text-left cursor-default"
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
        </div>
      </DndProvider>
    </div>
  );
}
