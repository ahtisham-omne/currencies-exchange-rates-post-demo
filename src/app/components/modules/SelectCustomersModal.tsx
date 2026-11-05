import React, { useMemo, useState } from "react";
import { Search, X, Check } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { AVAILABLE_VENDORS } from "../../context/purchasing/mockData";
import type { AvailableVendor } from "../../context/purchasing/types";

/** Avatar mirroring the AddQualifiedVendorModal style. */
function PartnerAvatar({ vendor, size = 40 }: { vendor: AvailableVendor; size?: number }) {
  const label = vendor.code ?? vendor.name.trim().charAt(0).toUpperCase();
  const bg = vendor.avatarColor ?? "#1F2937";
  const fontSize = label.length >= 3 ? 11 : label.length === 2 ? 13 : 15;
  return (
    <div
      className="rounded-full flex items-center justify-center shrink-0 text-white"
      style={{
        width: size,
        height: size,
        backgroundColor: bg,
        fontSize,
        fontWeight: 700,
        letterSpacing: "-0.01em",
      }}
    >
      {label}
    </div>
  );
}

function RoleBadge({ role }: { role: "Vendor" | "Customer" }) {
  const style =
    role === "Vendor"
      ? { backgroundColor: "#EFF6FF", color: "#1E40AF", borderColor: "#BFDBFE" }
      : { backgroundColor: "#F5F3FF", color: "#5B21B6", borderColor: "#DDD6FE" };
  return (
    <span
      className="inline-flex items-center px-2 py-0.5 text-xs rounded-md border font-medium"
      style={style}
    >
      {role}
    </span>
  );
}

export interface SelectCustomersModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Currently assigned partner ids (excluded from picker). */
  existingIds: string[];
  onSubmit: (vendors: AvailableVendor[]) => void;
}

/**
 * Multi-select customer picker modeled on AddQualifiedVendorModal's "select"
 * step. Filters AVAILABLE_VENDORS to partners whose roles include "Customer"
 * (i.e. Customer-only and dual Vendor+Customer). No configure step — clicking
 * "Add Selected" hands the chosen vendors back to the parent.
 */
export function SelectCustomersModal({
  open,
  onOpenChange,
  existingIds,
  onSubmit,
}: SelectCustomersModalProps) {
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const usedIds = useMemo(() => new Set(existingIds), [existingIds]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return AVAILABLE_VENDORS.filter(
      (v) => (v.partnerRoles ?? []).includes("Customer") && !usedIds.has(v.id),
    ).filter(
      (v) =>
        !q ||
        v.name.toLowerCase().includes(q) ||
        v.location.toLowerCase().includes(q),
    );
  }, [search, usedIds]);

  const reset = () => {
    setSearch("");
    setSelected(new Set());
  };

  const handleOpenChange = (next: boolean) => {
    if (!next) reset();
    onOpenChange(next);
  };

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleAdd = () => {
    if (selected.size === 0) return;
    const chosen = AVAILABLE_VENDORS.filter((v) => selected.has(v.id));
    onSubmit(chosen);
    handleOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        hideCloseButton
        className="bg-white flex flex-col p-0 gap-0 border-0 sm:border !fixed !top-[50%] !left-[50%] !translate-x-[-50%] !translate-y-[-50%] !w-[calc(100%-2rem)] !max-w-[100%] sm:!max-w-[640px] !max-h-[100dvh] sm:!max-h-[90vh] rounded-none sm:!rounded-2xl sm:overflow-hidden"
      >
        {/* Header */}
        <div className="px-6 pt-6 pb-4 border-b border-border shrink-0">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <DialogTitle className="text-lg font-semibold text-foreground">
                Select Customers
              </DialogTitle>
              <DialogDescription className="text-sm text-muted-foreground mt-1">
                Choose one or more customers to allow selling this item to.
              </DialogDescription>
            </div>
            <button
              type="button"
              onClick={() => handleOpenChange(false)}
              className="shrink-0 -mt-1 -mr-1 h-8 w-8 inline-flex items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
              aria-label="Close"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Search */}
        <div className="px-6 pt-4 pb-3 shrink-0">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/70 pointer-events-none" />
            <Input
              placeholder="Search customer..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 h-10 bg-white border-border/80 focus-visible:border-primary focus-visible:ring-primary/20"
              autoFocus
            />
          </div>
        </div>

        {/* List */}
        <div className="overflow-y-auto px-6 pb-3 space-y-2 max-h-[432px]">
          {filtered.length === 0 ? (
            <div className="py-12 text-center text-sm text-muted-foreground">
              {search.trim()
                ? "No customers match your search."
                : "All available customers are already assigned."}
            </div>
          ) : (
            filtered.map((v) => {
              const isSel = selected.has(v.id);
              return (
                <button
                  key={v.id}
                  type="button"
                  onClick={() => toggle(v.id)}
                  className={cn(
                    "w-full flex items-center gap-3 p-3 rounded-lg border bg-card text-left transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
                    isSel
                      ? "border-primary bg-primary/5"
                      : "border-border hover:border-primary/40 hover:bg-muted/40",
                  )}
                >
                  {/* Checkbox */}
                  <div
                    className={cn(
                      "shrink-0 w-5 h-5 rounded-md border flex items-center justify-center transition-colors",
                      isSel
                        ? "bg-primary border-primary text-white"
                        : "bg-white border-border",
                    )}
                  >
                    {isSel && <Check className="w-3.5 h-3.5" />}
                  </div>
                  <PartnerAvatar vendor={v} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="text-sm font-semibold text-foreground truncate">
                        {v.name}
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        {(v.partnerRoles ?? ["Customer"]).map((role) => (
                          <RoleBadge key={role} role={role} />
                        ))}
                      </div>
                    </div>
                    <div className="text-xs text-muted-foreground truncate mt-0.5">
                      {v.address ?? v.location}
                    </div>
                  </div>
                </button>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-border shrink-0 flex items-center justify-between gap-3">
          <span className="text-xs text-muted-foreground">
            {selected.size > 0
              ? `${selected.size} selected`
              : "No customers selected"}
          </span>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => handleOpenChange(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleAdd}
              disabled={selected.size === 0}
            >
              Add Selected
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}