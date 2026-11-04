import { useRef } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ItemDetail } from "../components/modules/ItemDetail";
import { useItems } from "../context/ItemsContext";
import { Button } from "@/components/ui/button";

export default function ItemDetailPage() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const { getItem } = useItems();
  const item = id ? getItem(id) : undefined;
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  if (!item) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-4 p-8">
        <h2 className="text-xl font-medium text-foreground">Item not found</h2>
        <p className="text-muted-foreground text-sm">No item exists with id "{id}".</p>
        <Button onClick={() => navigate("/items")}>Back to Items Library</Button>
      </div>
    );
  }

  return (
    <div ref={scrollContainerRef} className="flex-1 flex flex-col overflow-y-auto bg-slate-50">
      <ItemDetail
        // TODO: remove cast in Phase 2 — Item components rebuild
        item={item as any}
        onBack={() => navigate("/items")}
        onEdit={() => navigate("/items/new")}
        scrollContainerRef={scrollContainerRef}
      />
    </div>
  );
}
