import { Users, Plus, Search, Filter } from "lucide-react";

export function PartnerGroupsPage() {
  const groups = [
    { id: 1, name: "Premium Suppliers", type: "Family", members: 24, description: "Top-tier suppliers with priority fulfillment" },
    { id: 2, name: "Local Vendors", type: "Group", members: 18, description: "Regional vendors within 100km radius" },
    { id: 3, name: "Tax Class A", type: "Tax Class", members: 42, description: "Standard tax rate applicable partners" },
    { id: 4, name: "International Partners", type: "Group", members: 31, description: "Overseas partners and distributors" },
    { id: 5, name: "Raw Materials", type: "Family", members: 15, description: "Suppliers of raw materials and commodities" },
    { id: 6, name: "Tax Exempt", type: "Tax Class", members: 8, description: "Partners with tax exemption certificates" },
  ];

  const typeColors: Record<string, { bg: string; text: string }> = {
    Family: { bg: "hsl(var(--accent))", text: "hsl(var(--primary))" },
    Group: { bg: "#F0FDF4", text: "#16A34A" },
    "Tax Class": { bg: "#FFF7ED", text: "#EA580C" },
  };

  return (
    <div className="flex flex-col h-full bg-slate-50">
      <div className="px-5 py-3.5 border-b border-border bg-card">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-foreground" style={{ fontSize: "20px", fontWeight: 600 }}>
              Partner Groups
            </h1>
            <p className="text-muted-foreground mt-1" style={{ fontSize: "13px" }}>
              Organize partners into groups, families, and tax classes.
            </p>
          </div>
          <button
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg text-white text-[13px] transition-colors hover:opacity-90"
            style={{ backgroundColor: "hsl(var(--primary))", fontWeight: 500 }}
          >
            <Plus className="w-4 h-4" />
            New Group
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-5">
        <div className="flex items-center gap-3 mb-4">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search groups..."
              className="w-full pl-9 pr-4 py-2 rounded-lg border border-border bg-card text-[13px] text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
            />
          </div>
          <button className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-border text-[13px] text-muted-foreground hover:bg-muted transition-colors">
            <Filter className="w-3.5 h-3.5" />
            Filters
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {groups.map((group) => {
            const colors = typeColors[group.type] || typeColors.Group;
            return (
              <div
                key={group.id}
                className="p-4 rounded-xl border border-border bg-card hover:shadow-sm transition-shadow cursor-pointer"
              >
                <div className="flex items-start justify-between mb-2.5">
                  <div
                    className="w-9 h-9 rounded-lg flex items-center justify-center"
                    style={{ backgroundColor: colors.bg }}
                  >
                    <Users className="w-5 h-5" style={{ color: colors.text }} />
                  </div>
                  <span
                    className="px-2.5 py-1 rounded-full text-[11px]"
                    style={{ backgroundColor: colors.bg, color: colors.text, fontWeight: 500 }}
                  >
                    {group.type}
                  </span>
                </div>
                <h3 className="text-foreground mb-1" style={{ fontSize: "14px", fontWeight: 500 }}>
                  {group.name}
                </h3>
                <p className="text-muted-foreground mb-2" style={{ fontSize: "12px" }}>
                  {group.description}
                </p>
                <div className="flex items-center gap-1 text-muted-foreground" style={{ fontSize: "12px" }}>
                  <Users className="w-3.5 h-3.5" />
                  <span>{group.members} members</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
