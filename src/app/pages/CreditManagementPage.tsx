import { Search, Filter, CreditCard, TrendingUp, TrendingDown, AlertTriangle } from "lucide-react";

export function CreditManagementPage() {
  const summaryCards = [
    { label: "Total Credit Extended", value: "$2,450,000", change: "+12.5%", up: true, icon: CreditCard, color: "#0A77FF" },
    { label: "Credit Utilization", value: "68.3%", change: "+3.2%", up: true, icon: TrendingUp, color: "#EA580C" },
    { label: "Outstanding Balance", value: "$1,673,500", change: "-5.1%", up: false, icon: TrendingDown, color: "#16A34A" },
    { label: "Overdue Accounts", value: "4", change: "+2", up: true, icon: AlertTriangle, color: "#DC2626" },
  ];

  const partners = [
    { id: 1, name: "Acme Corporation", creditLimit: "$500,000", utilized: "$342,000", available: "$158,000", utilization: 68, status: "Good" },
    { id: 2, name: "Global Industries", creditLimit: "$350,000", utilized: "$310,000", available: "$40,000", utilization: 89, status: "Warning" },
    { id: 3, name: "TechSupply Co", creditLimit: "$200,000", utilized: "$85,000", available: "$115,000", utilization: 43, status: "Good" },
    { id: 4, name: "Premium Logistics", creditLimit: "$150,000", utilized: "$148,500", available: "$1,500", utilization: 99, status: "Critical" },
    { id: 5, name: "SteelWorks Ltd", creditLimit: "$400,000", utilized: "$220,000", available: "$180,000", utilization: 55, status: "Good" },
    { id: 6, name: "NexGen Materials", creditLimit: "$250,000", utilized: "$188,000", available: "$62,000", utilization: 75, status: "Warning" },
  ];

  const statusColors: Record<string, { bg: string; text: string }> = {
    Good: { bg: "#F0FDF4", text: "#16A34A" },
    Warning: { bg: "#FFF7ED", text: "#EA580C" },
    Critical: { bg: "#FEF2F2", text: "#DC2626" },
  };

  return (
    <div className="flex flex-col h-full bg-[#F8FAFC]">
      <div className="px-5 py-3.5 border-b border-border bg-card">
        <h1 className="text-foreground" style={{ fontSize: "20px", fontWeight: 600 }}>
          Credit Management
        </h1>
        <p className="text-muted-foreground mt-1" style={{ fontSize: "13px" }}>
          Monitor credit limits, utilization, and outstanding balances.
        </p>
      </div>

      <div className="flex-1 overflow-auto p-5">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
          {summaryCards.map((card) => {
            const Icon = card.icon;
            return (
              <div key={card.label} className="p-4 rounded-xl border border-border bg-card">
                <div className="flex items-center justify-between mb-2.5">
                  <div
                    className="w-9 h-9 rounded-lg flex items-center justify-center"
                    style={{ backgroundColor: `${card.color}14` }}
                  >
                    <Icon className="w-5 h-5" style={{ color: card.color }} />
                  </div>
                  <span
                    className="text-[12px]"
                    style={{ fontWeight: 500, color: card.up ? (card.color === "#16A34A" ? "#16A34A" : "#EA580C") : "#16A34A" }}
                  >
                    {card.change}
                  </span>
                </div>
                <p className="text-muted-foreground mb-1" style={{ fontSize: "12px" }}>{card.label}</p>
                <p className="text-foreground" style={{ fontSize: "22px", fontWeight: 600 }}>{card.value}</p>
              </div>
            );
          })}
        </div>

        <div className="flex items-center gap-3 mb-4">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search partners..."
              className="w-full pl-9 pr-4 py-2 rounded-lg border border-border bg-card text-[13px] text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-[#0A77FF]/20 focus:border-[#0A77FF]"
            />
          </div>
          <button className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-border text-[13px] text-muted-foreground hover:bg-muted transition-colors">
            <Filter className="w-3.5 h-3.5" />
            Filters
          </button>
        </div>

        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border" style={{ backgroundColor: "rgba(0,0,0,0.02)" }}>
                <th className="text-left px-5 py-3 text-muted-foreground" style={{ fontSize: "12px", fontWeight: 500 }}>Partner</th>
                <th className="text-left px-5 py-3 text-muted-foreground" style={{ fontSize: "12px", fontWeight: 500 }}>Credit Limit</th>
                <th className="text-left px-5 py-3 text-muted-foreground" style={{ fontSize: "12px", fontWeight: 500 }}>Utilized</th>
                <th className="text-left px-5 py-3 text-muted-foreground" style={{ fontSize: "12px", fontWeight: 500 }}>Available</th>
                <th className="text-left px-5 py-3 text-muted-foreground" style={{ fontSize: "12px", fontWeight: 500 }}>Utilization</th>
                <th className="text-left px-5 py-3 text-muted-foreground" style={{ fontSize: "12px", fontWeight: 500 }}>Status</th>
              </tr>
            </thead>
            <tbody>
              {partners.map((partner) => {
                const colors = statusColors[partner.status] || statusColors.Good;
                return (
                  <tr key={partner.id} className="border-b border-border last:border-0 hover:bg-muted/50 transition-colors cursor-pointer">
                    <td className="px-5 py-3.5" style={{ fontSize: "13px", fontWeight: 500, color: '#1E293B' }}>{partner.name}</td>
                    <td className="px-5 py-3.5" style={{ fontSize: "13px", color: '#334155' }}>{partner.creditLimit}</td>
                    <td className="px-5 py-3.5" style={{ fontSize: "13px", color: '#334155' }}>{partner.utilized}</td>
                    <td className="px-5 py-3.5" style={{ fontSize: "13px", color: '#334155' }}>{partner.available}</td>
                    <td className="px-5 py-3.5" style={{ fontSize: "13px" }}>
                      <div className="flex items-center gap-2">
                        <div className="w-16 h-1.5 rounded-full bg-muted overflow-hidden">
                          <div
                            className="h-full rounded-full"
                            style={{
                              width: `${partner.utilization}%`,
                              backgroundColor: partner.utilization > 90 ? "#DC2626" : partner.utilization > 75 ? "#EA580C" : "#0A77FF",
                            }}
                          />
                        </div>
                        <span className="text-muted-foreground" style={{ fontSize: "12px" }}>{partner.utilization}%</span>
                      </div>
                    </td>
                    <td className="px-5 py-3.5">
                      <span
                        className="px-2.5 py-1 rounded-full"
                        style={{ fontSize: "11px", fontWeight: 500, backgroundColor: colors.bg, color: colors.text }}
                      >
                        {partner.status}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
