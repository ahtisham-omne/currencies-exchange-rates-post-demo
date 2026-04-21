import { Search, Filter, Plus, MapPin, Building2, Warehouse, Phone } from "lucide-react";

export function PartnerLocationsPage() {
  const locations = [
    { id: 1, name: "Acme HQ", partner: "Acme Corporation", type: "Headquarters", address: "123 Business Ave, New York, NY 10001", phone: "+1 (555) 100-2000", icon: Building2, color: "hsl(var(--primary))" },
    { id: 2, name: "Acme Warehouse East", partner: "Acme Corporation", type: "Warehouse", address: "456 Industrial Blvd, Newark, NJ 07102", phone: "+1 (555) 100-3000", icon: Warehouse, color: "hsl(var(--violet))" },
    { id: 3, name: "Global Industries Office", partner: "Global Industries", type: "Office", address: "789 Commerce St, Chicago, IL 60601", phone: "+1 (555) 200-1000", icon: Building2, color: "hsl(var(--primary))" },
    { id: 4, name: "TechSupply Distribution", partner: "TechSupply Co", type: "Distribution Center", address: "321 Logistics Way, Dallas, TX 75201", phone: "+1 (555) 300-1000", icon: Warehouse, color: "hsl(var(--violet))" },
    { id: 5, name: "Premium Logistics Hub", partner: "Premium Logistics", type: "Warehouse", address: "654 Freight Dr, Los Angeles, CA 90001", phone: "+1 (555) 400-1000", icon: Warehouse, color: "hsl(var(--violet))" },
    { id: 6, name: "SteelWorks Plant", partner: "SteelWorks Ltd", type: "Manufacturing", address: "987 Factory Rd, Pittsburgh, PA 15201", phone: "+1 (555) 500-1000", icon: Building2, color: "#EA580C" },
    { id: 7, name: "NexGen R&D Center", partner: "NexGen Materials", type: "Office", address: "246 Innovation Pkwy, San Jose, CA 95101", phone: "+1 (555) 600-1000", icon: Building2, color: "hsl(var(--primary))" },
    { id: 8, name: "QuickShip Depot", partner: "QuickShip Inc", type: "Distribution Center", address: "135 Express Ln, Memphis, TN 38101", phone: "+1 (555) 700-1000", icon: Warehouse, color: "hsl(var(--violet))" },
  ];

  const typeColors: Record<string, { bg: string; text: string }> = {
    Headquarters: { bg: "hsl(var(--accent))", text: "hsl(var(--primary))" },
    Office: { bg: "hsl(var(--accent))", text: "hsl(var(--primary))" },
    Warehouse: { bg: "#F5F3FF", text: "hsl(var(--violet))" },
    "Distribution Center": { bg: "#F5F3FF", text: "hsl(var(--violet))" },
    Manufacturing: { bg: "#FFF7ED", text: "#EA580C" },
  };

  return (
    <div className="flex flex-col h-full bg-slate-50">
      <div className="px-5 py-3.5 border-b border-border bg-card">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-foreground" style={{ fontSize: "20px", fontWeight: 600 }}>
              Partner Locations
            </h1>
            <p className="text-muted-foreground mt-1" style={{ fontSize: "13px" }}>
              Manage partner locations, warehouses, and addresses.
            </p>
          </div>
          <button
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg text-white text-[13px] transition-colors hover:opacity-90"
            style={{ backgroundColor: "hsl(var(--primary))", fontWeight: 500 }}
          >
            <Plus className="w-4 h-4" />
            Add Location
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-5">
        <div className="flex items-center gap-3 mb-4">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search locations..."
              className="w-full pl-9 pr-4 py-2 rounded-lg border border-border bg-card text-[13px] text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
            />
          </div>
          <button className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-border text-[13px] text-muted-foreground hover:bg-muted transition-colors">
            <Filter className="w-3.5 h-3.5" />
            Filters
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-3">
          {locations.map((location) => {
            const Icon = location.icon;
            const colors = typeColors[location.type] || typeColors.Office;
            return (
              <div
                key={location.id}
                className="p-4 rounded-xl border border-border bg-card hover:shadow-sm transition-shadow cursor-pointer"
              >
                <div className="flex items-start justify-between mb-2.5">
                  <div
                    className="w-9 h-9 rounded-lg flex items-center justify-center"
                    style={{ backgroundColor: colors.bg }}
                  >
                    <Icon className="w-5 h-5" style={{ color: colors.text }} />
                  </div>
                  <span
                    className="px-2.5 py-1 rounded-full"
                    style={{ fontSize: "11px", fontWeight: 500, backgroundColor: colors.bg, color: colors.text }}
                  >
                    {location.type}
                  </span>
                </div>
                <h3 className="text-foreground mb-0.5" style={{ fontSize: "14px", fontWeight: 500 }}>
                  {location.name}
                </h3>
                <p className="text-muted-foreground mb-2" style={{ fontSize: "12px" }}>
                  {location.partner}
                </p>
                <div className="space-y-2">
                  <a
                    href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(location.address)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-start gap-2 text-muted-foreground hover:text-primary hover:underline transition-colors"
                    style={{ fontSize: "12px" }}
                  >
                    <MapPin className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                    <span>{location.address}</span>
                  </a>
                  <div className="flex items-center gap-2 text-muted-foreground" style={{ fontSize: "12px" }}>
                    <Phone className="w-3.5 h-3.5 shrink-0" />
                    <span>{location.phone}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
