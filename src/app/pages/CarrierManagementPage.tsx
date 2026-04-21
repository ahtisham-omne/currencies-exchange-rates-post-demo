import { Search, Filter, Plus, Truck, MapPin, Clock, Star } from "lucide-react";

export function CarrierManagementPage() {
  const carriers = [
    { id: 1, name: "FedEx Express", type: "Air & Ground", rating: 4.8, avgDelivery: "2-3 days", regions: ["North America", "Europe"], status: "Active", shipments: 1245 },
    { id: 2, name: "DHL International", type: "International", rating: 4.6, avgDelivery: "3-5 days", regions: ["Global"], status: "Active", shipments: 892 },
    { id: 3, name: "UPS Freight", type: "Ground & Freight", rating: 4.5, avgDelivery: "3-7 days", regions: ["North America"], status: "Active", shipments: 634 },
    { id: 4, name: "Maersk Line", type: "Ocean Freight", rating: 4.3, avgDelivery: "14-21 days", regions: ["Global"], status: "Active", shipments: 156 },
    { id: 5, name: "XPO Logistics", type: "LTL & Freight", rating: 4.1, avgDelivery: "5-10 days", regions: ["North America", "Europe"], status: "Under Review", shipments: 423 },
    { id: 6, name: "Swift Transport", type: "Ground", rating: 3.9, avgDelivery: "4-6 days", regions: ["North America"], status: "Inactive", shipments: 0 },
  ];

  const statusColors: Record<string, { bg: string; text: string }> = {
    Active: { bg: "#F0FDF4", text: "#16A34A" },
    "Under Review": { bg: "#FFF7ED", text: "#EA580C" },
    Inactive: { bg: "hsl(var(--muted))", text: "#64748B" },
  };

  return (
    <div className="flex flex-col h-full bg-slate-50">
      <div className="px-5 py-3.5 border-b border-border bg-card">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-foreground" style={{ fontSize: "20px", fontWeight: 600 }}>
              Carrier Management
            </h1>
            <p className="text-muted-foreground mt-1" style={{ fontSize: "13px" }}>
              Configure default carriers and shipping preferences.
            </p>
          </div>
          <button
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg text-white text-[13px] transition-colors hover:opacity-90"
            style={{ backgroundColor: "hsl(var(--primary))", fontWeight: 500 }}
          >
            <Plus className="w-4 h-4" />
            Add Carrier
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-5">
        <div className="flex items-center gap-3 mb-4">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search carriers..."
              className="w-full pl-9 pr-4 py-2 rounded-lg border border-border bg-card text-[13px] text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
            />
          </div>
          <button className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-border text-[13px] text-muted-foreground hover:bg-muted transition-colors">
            <Filter className="w-3.5 h-3.5" />
            Filters
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {carriers.map((carrier) => {
            const colors = statusColors[carrier.status] || statusColors.Active;
            return (
              <div
                key={carrier.id}
                className="p-4 rounded-xl border border-border bg-card hover:shadow-sm transition-shadow cursor-pointer"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-2.5">
                    <div
                      className="w-9 h-9 rounded-lg flex items-center justify-center"
                      style={{ backgroundColor: "hsl(var(--accent))" }}
                    >
                      <Truck className="w-5 h-5" style={{ color: "hsl(var(--primary))" }} />
                    </div>
                    <div>
                      <h3 className="text-foreground" style={{ fontSize: "14px", fontWeight: 500 }}>
                        {carrier.name}
                      </h3>
                      <p className="text-muted-foreground" style={{ fontSize: "12px" }}>
                        {carrier.type}
                      </p>
                    </div>
                  </div>
                  <span
                    className="px-2.5 py-1 rounded-full"
                    style={{ fontSize: "11px", fontWeight: 500, backgroundColor: colors.bg, color: colors.text }}
                  >
                    {carrier.status}
                  </span>
                </div>

                <div className="space-y-2.5">
                  <div className="flex items-center gap-2 text-muted-foreground" style={{ fontSize: "12px" }}>
                    <Star className="w-3.5 h-3.5 shrink-0" style={{ color: "#F59E0B" }} />
                    <span>{carrier.rating} rating</span>
                    <span className="text-border">|</span>
                    <span>{carrier.shipments} shipments</span>
                  </div>
                  <div className="flex items-center gap-2 text-muted-foreground" style={{ fontSize: "12px" }}>
                    <Clock className="w-3.5 h-3.5 shrink-0" />
                    <span>Avg. delivery: {carrier.avgDelivery}</span>
                  </div>
                  <div className="flex items-center gap-2 text-muted-foreground" style={{ fontSize: "12px" }}>
                    <MapPin className="w-3.5 h-3.5 shrink-0" />
                    <span>{carrier.regions.join(", ")}</span>
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
