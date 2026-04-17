// Force rebuild
import { useNavigate } from "react-router-dom";
import {
  Coins,
  ArrowLeftRight,
  BookOpen,
  Receipt,
  ArrowRight,
  Home,
  ChevronRight,
} from "lucide-react";
import type { ComponentType, CSSProperties } from "react";

interface ModuleCard {
  title: string;
  description: string;
  icon: ComponentType<{ className?: string; style?: CSSProperties }>;
  iconColor: string;
  iconBg: string;
  path: string;
  enabled: boolean;
}

const modules: ModuleCard[] = [
  {
    title: "Currency Library",
    description: "Manage currencies available across the system.",
    icon: Coins,
    iconColor: "#0A77FF",
    iconBg: "#EDF4FF",
    path: "/accounting/currencies",
    enabled: true,
  },
  {
    title: "Exchange Rates",
    description: "Configure exchange rate types and rates.",
    icon: ArrowLeftRight,
    iconColor: "#059669",
    iconBg: "#ECFDF5",
    path: "/accounting/exchange-rates",
    enabled: true,
  },
  {
    title: "Chart of Accounts",
    description: "Define and organize your account structure.",
    icon: BookOpen,
    iconColor: "#7C3AED",
    iconBg: "#F5F3FF",
    path: "/accounting/chart-of-accounts",
    enabled: false,
  },
  {
    title: "Tax Setup",
    description: "Set up tax codes and rules.",
    icon: Receipt,
    iconColor: "#EA580C",
    iconBg: "#FFF7ED",
    path: "/accounting/tax-setup",
    enabled: false,
  },
];

export function AccountingHomePage() {
  const navigate = useNavigate();

  return (
    <div className="flex flex-col h-full bg-[#F8FAFC]">
      {/* Top Bar / Breadcrumb */}
      <div className="flex items-center justify-between px-6 lg:px-8 h-12 border-b border-border bg-card shrink-0">
        <div className="flex items-center gap-1.5 text-[13px] text-muted-foreground">
          <button onClick={() => navigate("/")} className="hover:text-foreground transition-colors flex items-center gap-1">
            <Home className="w-3.5 h-3.5" />
            Home
          </button>
          <ChevronRight className="w-3 h-3" />
          <span className="text-foreground" style={{ fontWeight: 500 }}>
            Accounting
          </span>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        <div className="px-4 sm:px-5 lg:px-6 py-3 sm:py-4 w-full max-w-[1120px] mx-auto">
          {/* Page Header */}
          <div className="mb-3 sm:mb-4">
            <h1 className="text-xl sm:text-2xl" style={{ fontWeight: 700 }}>
              Accounting
            </h1>
            <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
              Manage your financial operations, currencies, exchange rates, and chart of accounts.
            </p>
          </div>

          {/* Module Cards */}
          <div className="mb-4 sm:mb-5">
            <h4 className="text-sm text-muted-foreground mb-2 sm:mb-2.5" style={{ fontWeight: 500 }}>
              Modules
            </h4>
            <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
              {modules.map((mod) => {
                const Icon = mod.icon;
                return (
                  <button
                    key={mod.title}
                    onClick={() => mod.enabled && navigate(mod.path)}
                    disabled={!mod.enabled}
                    className={`group/card relative text-left bg-card border rounded-xl px-3.5 pt-3 pb-3 transition-all duration-200 ${
                      mod.enabled
                        ? "border-border hover:shadow-md hover:border-primary/20 cursor-pointer"
                        : "border-border opacity-60 cursor-not-allowed"
                    }`}
                  >
                    {/* Coming Soon badge */}
                    {!mod.enabled && (
                      <span
                        className="absolute top-2.5 right-2.5 text-[10px] px-1.5 py-0.5 rounded-full border"
                        style={{
                          fontWeight: 500,
                          color: "#92400E",
                          backgroundColor: "#FFFBEB",
                          borderColor: "#FDE68A",
                        }}
                      >
                        Coming Soon
                      </span>
                    )}

                    {/* Open arrow for enabled cards */}
                    {mod.enabled && (
                      <div className="absolute top-2.5 right-2.5 flex items-center gap-0.5 opacity-0 group-hover/card:opacity-100 transition-opacity z-10">
                        <span
                          className="inline-flex items-center gap-0.5 text-[11px]"
                          style={{ color: "#0A77FF", fontWeight: 500 }}
                        >
                          Open
                          <ArrowRight className="w-3 h-3" />
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
                    <p className="text-[11px] text-muted-foreground leading-relaxed">
                      {mod.description}
                    </p>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
