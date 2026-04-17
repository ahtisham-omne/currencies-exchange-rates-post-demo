import { TrendingUp, TrendingDown, Users, DollarSign, Package, Clock, ChartColumn, PieChart, Activity } from "lucide-react";

export function ReportsAnalyticsPage() {
  const kpis = [
    { label: "Total Partners", value: "248", change: "+18", up: true, icon: Users, color: "#0A77FF" },
    { label: "Total Spend (YTD)", value: "$4.2M", change: "+15.3%", up: true, icon: DollarSign, color: "#16A34A" },
    { label: "Avg. Lead Time", value: "5.2 days", change: "-0.8 days", up: false, icon: Clock, color: "#7C3AED" },
    { label: "Active Orders", value: "1,342", change: "+23%", up: true, icon: Package, color: "#EA580C" },
  ];

  const topPartners = [
    { name: "Acme Corporation", spend: "$892,400", orders: 342, percentage: 75 },
    { name: "Global Industries", spend: "$654,200", orders: 218, percentage: 55 },
    { name: "TechSupply Co", spend: "$523,100", orders: 186, percentage: 44 },
    { name: "SteelWorks Ltd", spend: "$412,800", orders: 154, percentage: 35 },
    { name: "NexGen Materials", spend: "$387,600", orders: 132, percentage: 33 },
  ];

  const recentActivity = [
    { action: "New partner onboarded", detail: "QuickShip Inc added to approved vendors", time: "2 hours ago", icon: Users, color: "#0A77FF" },
    { action: "Credit limit updated", detail: "Global Industries limit raised to $400K", time: "5 hours ago", icon: DollarSign, color: "#16A34A" },
    { action: "Performance review", detail: "Acme Corporation quarterly review completed", time: "1 day ago", icon: Activity, color: "#7C3AED" },
    { action: "Contract renewed", detail: "SteelWorks Ltd contract extended 2 years", time: "2 days ago", icon: Package, color: "#EA580C" },
    { action: "New location added", detail: "TechSupply Co warehouse in Austin, TX", time: "3 days ago", icon: ChartColumn, color: "#0891B2" },
  ];

  return (
    <div className="flex flex-col h-full bg-[#F8FAFC]">
      <div className="px-6 py-4 border-b border-border bg-card">
        <h1 className="text-foreground" style={{ fontSize: "20px", fontWeight: 600 }}>
          Reports & Analytics
        </h1>
        <p className="text-muted-foreground mt-1" style={{ fontSize: "13px" }}>
          Track partner performance metrics and business insights.
        </p>
      </div>

      <div className="flex-1 overflow-auto p-6">
        {/* KPI Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          {kpis.map((kpi) => {
            const Icon = kpi.icon;
            return (
              <div key={kpi.label} className="p-4 rounded-xl border border-border bg-card">
                <div className="flex items-center justify-between mb-2">
                  <div
                    className="w-10 h-10 rounded-lg flex items-center justify-center"
                    style={{ backgroundColor: `${kpi.color}14` }}
                  >
                    <Icon className="w-5 h-5" style={{ color: kpi.color }} />
                  </div>
                  <div className="flex items-center gap-1">
                    {kpi.up ? (
                      <TrendingUp className="w-3.5 h-3.5" style={{ color: "#16A34A" }} />
                    ) : (
                      <TrendingDown className="w-3.5 h-3.5" style={{ color: "#16A34A" }} />
                    )}
                    <span style={{ fontSize: "12px", fontWeight: 500, color: "#16A34A" }}>
                      {kpi.change}
                    </span>
                  </div>
                </div>
                <p className="text-muted-foreground mb-0.5" style={{ fontSize: "12px" }}>{kpi.label}</p>
                <p className="text-foreground" style={{ fontSize: "22px", fontWeight: 600 }}>{kpi.value}</p>
              </div>
            );
          })}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Top Partners by Spend */}
          <div className="rounded-xl border border-border bg-card p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <ChartColumn className="w-4.5 h-4.5 text-muted-foreground" />
                <h2 className="text-foreground" style={{ fontSize: "15px", fontWeight: 600 }}>Top Partners by Spend</h2>
              </div>
              <span className="text-muted-foreground" style={{ fontSize: "12px" }}>YTD 2026</span>
            </div>
            <div className="space-y-3">
              {topPartners.map((partner, idx) => (
                <div key={partner.name}>
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-2">
                      <span className="text-muted-foreground" style={{ fontSize: "12px", fontWeight: 500, width: "16px" }}>
                        {idx + 1}.
                      </span>
                      <span className="text-foreground" style={{ fontSize: "13px", fontWeight: 500 }}>
                        {partner.name}
                      </span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-muted-foreground" style={{ fontSize: "12px" }}>{partner.orders} orders</span>
                      <span className="text-foreground" style={{ fontSize: "13px", fontWeight: 500 }}>{partner.spend}</span>
                    </div>
                  </div>
                  <div className="ml-6 h-1.5 rounded-full bg-muted overflow-hidden">
                    <div
                      className="h-full rounded-full"
                      style={{ width: `${partner.percentage}%`, backgroundColor: "#0A77FF" }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Recent Activity */}
          <div className="rounded-xl border border-border bg-card p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <PieChart className="w-4.5 h-4.5 text-muted-foreground" />
                <h2 className="text-foreground" style={{ fontSize: "15px", fontWeight: 600 }}>Recent Activity</h2>
              </div>
              <button className="text-[#0A77FF]" style={{ fontSize: "12px", fontWeight: 500 }}>View All</button>
            </div>
            <div className="space-y-3">
              {recentActivity.map((activity, idx) => {
                const Icon = activity.icon;
                return (
                  <div key={idx} className="flex items-start gap-3">
                    <div
                      className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5"
                      style={{ backgroundColor: `${activity.color}14` }}
                    >
                      <Icon className="w-4 h-4" style={{ color: activity.color }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-foreground" style={{ fontSize: "13px", fontWeight: 500 }}>
                        {activity.action}
                      </p>
                      <p className="text-muted-foreground truncate" style={{ fontSize: "12px" }}>
                        {activity.detail}
                      </p>
                    </div>
                    <span className="text-muted-foreground shrink-0" style={{ fontSize: "11px" }}>
                      {activity.time}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}