import { useLocation } from "react-router-dom";
import { segmentToLabel } from "../lib/segment-labels";

export function PlaceholderPage() {
  const location = useLocation();
  const segments = location.pathname.split("/").filter(Boolean);
  const lastSegment = segments[segments.length - 1] || "Overview";
  const label = segmentToLabel(lastSegment);

  return (
    <div className="px-6 lg:px-8 py-6">
      <h1
        className="tracking-[-0.01em] mb-2"
        style={{ color: "#0F172A", fontSize: "22px", fontWeight: 600 }}
      >
        {label}
      </h1>
      <p className="text-sm" style={{ color: "#64748B" }}>
        This page is under development.
      </p>
    </div>
  );
}
