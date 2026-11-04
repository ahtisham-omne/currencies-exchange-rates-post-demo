import { Search, Filter, Plus, ShieldCheck, Clock, Star, AlertCircle } from "lucide-react";

export function QualifiedVendorsPage() {
  const vendors = [
    { id: 1, name: "Acme Corporation", category: "Raw Materials", rating: "A+", leadTime: "3-5 days", priority: "Critical", qualified: "2024-01-15", expiry: "2026-01-15", status: "Qualified" },
    { id: 2, name: "Global Industries", category: "Components", rating: "A", leadTime: "5-7 days", priority: "High", qualified: "2023-11-20", expiry: "2025-11-20", status: "Qualified" },
    { id: 3, name: "TechSupply Co", category: "Electronics", rating: "A", leadTime: "2-4 days", priority: "Critical", qualified: "2024-03-10", expiry: "2026-03-10", status: "Qualified" },
    { id: 4, name: "SteelWorks Ltd", category: "Raw Materials", rating: "B+", leadTime: "7-10 days", priority: "Medium", qualified: "2024-06-01", expiry: "2026-06-01", status: "Qualified" },
    { id: 5, name: "NexGen Materials", category: "Specialty", rating: "A-", leadTime: "5-8 days", priority: "High", qualified: "2023-09-15", expiry: "2025-09-15", status: "Expiring Soon" },
    { id: 6, name: "QuickShip Inc", category: "Packaging", rating: "B", leadTime: "1-3 days", priority: "Low", qualified: "2023-05-01", expiry: "2025-05-01", status: "Expired" },
  ];

  const statusColors: Record<string, { bg: string; text: string }> = {
    Qualified: { bg: "#F0FDF4", text: "#16A34A" },
    "Expiring Soon": { bg: "#FFF7ED", text: "#EA580C" },
    Expired: { bg: "#FEF2F2", text: "hsl(var(--destructive))" },
  };

  const priorityColors: Record<string, { bg: string; text: string }> = {
    Critical: { bg: "#FEF2F2", text: "hsl(var(--destructive))" },
    High: { bg: "#FFF7ED", text: "#EA580C" },
    Medium: { bg: "hsl(var(--accent))", text: "hsl(var(--primary))" },
    Low: { bg: "hsl(var(--muted))", text: "#64748B" },
  };

  return (
    <div className="flex flex-col h-full bg-slate-50">
      <div className="px-6 py-4 border-b border-border bg-card">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-foreground" style={{ fontSize: "20px", fontWeight: 600 }}>
              Qualified Vendors
            </h1>
            <p className="text-muted-foreground mt-1" style={{ fontSize: "13px" }}>
              Manage approved vendor relationships with lead times and priorities.
            </p>
          </div>
          <button
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg text-white text-[13px] transition-colors hover:opacity-90"
            style={{ backgroundColor: "hsl(var(--primary))", fontWeight: 500 }}
          >
            <Plus className="w-4 h-4" />
            Qualify Vendor
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search qualified vendors..."
              className="w-full pl-9 pr-4 py-2 rounded-lg border border-border bg-card text-[13px] text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
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
                <th className="text-left px-5 py-3 text-muted-foreground" style={{ fontSize: "12px", fontWeight: 500 }}>Vendor</th>
                <th className="text-left px-5 py-3 text-muted-foreground" style={{ fontSize: "12px", fontWeight: 500 }}>Category</th>
                <th className="text-left px-5 py-3 text-muted-foreground" style={{ fontSize: "12px", fontWeight: 500 }}>Rating</th>
                <th className="text-left px-5 py-3 text-muted-foreground" style={{ fontSize: "12px", fontWeight: 500 }}>Lead Time</th>
                <th className="text-left px-5 py-3 text-muted-foreground" style={{ fontSize: "12px", fontWeight: 500 }}>Priority</th>
                <th className="text-left px-5 py-3 text-muted-foreground" style={{ fontSize: "12px", fontWeight: 500 }}>Expiry</th>
                <th className="text-left px-5 py-3 text-muted-foreground" style={{ fontSize: "12px", fontWeight: 500 }}>Status</th>
              </tr>
            </thead>
            <tbody>
              {vendors.map((vendor) => {
                const sColors = statusColors[vendor.status] || statusColors.Qualified;
                const pColors = priorityColors[vendor.priority] || priorityColors.Medium;
                return (
                  <tr key={vendor.id} className="border-b border-border last:border-0 hover:bg-muted/50 transition-colors cursor-pointer">
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: "hsl(var(--accent))" }}>
                          <ShieldCheck className="w-4 h-4" style={{ color: "hsl(var(--primary))" }} />
                        </div>
                        <span style={{ fontSize: "13px", fontWeight: 500, color: '#1E293B' }}>{vendor.name}</span>
                      </div>
                    </td>
                    <td className="px-5 py-3.5" style={{ fontSize: "13px", color: '#334155' }}>{vendor.category}</td>
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-1">
                        <Star className="w-3.5 h-3.5" style={{ color: "#F59E0B" }} />
                        <span style={{ fontSize: "13px", fontWeight: 500, color: '#1E293B' }}>{vendor.rating}</span>
                      </div>
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-1.5" style={{ fontSize: "13px", color: '#334155' }}>
                        <Clock className="w-3.5 h-3.5" />
                        {vendor.leadTime}
                      </div>
                    </td>
                    <td className="px-5 py-3.5">
                      <span
                        className="px-2.5 py-1 rounded-full"
                        style={{ fontSize: "11px", fontWeight: 500, backgroundColor: pColors.bg, color: pColors.text }}
                      >
                        {vendor.priority}
                      </span>
                    </td>
                    <td className="px-5 py-3.5" style={{ fontSize: "13px", color: "hsl(var(--muted-foreground))" }}>{vendor.expiry}</td>
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-1.5">
                        {vendor.status === "Expiring Soon" && <AlertCircle className="w-3.5 h-3.5" style={{ color: "#EA580C" }} />}
                        {vendor.status === "Expired" && <AlertCircle className="w-3.5 h-3.5" style={{ color: "hsl(var(--destructive))" }} />}
                        <span
                          className="px-2.5 py-1 rounded-full"
                          style={{ fontSize: "11px", fontWeight: 500, backgroundColor: sColors.bg, color: sColors.text }}
                        >
                          {vendor.status}
                        </span>
                      </div>
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