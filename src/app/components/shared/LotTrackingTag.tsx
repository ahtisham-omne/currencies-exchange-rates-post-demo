type LotTrackingTagProps = {
  type: "serialized" | "non-serialized";
};

/**
 * Two-segment pill for lot-tracked items. Left segment is the constant
 * "Lot" capsule on a faintly-tinted background; right segment carries the
 * tracking variant ("Serialized" / "Non-Serialized") on white. Used in
 * place of the regular tracking pill whenever the item is lot-tracked.
 */
export function LotTrackingTag({ type }: LotTrackingTagProps) {
  const label = type === "serialized" ? "Serialized" : "Non-Serialized";

  return (
    <div
      style={{
        width: "fit-content",
        height: 21,
        display: "flex",
        alignItems: "center",
      }}
    >
      <div
        style={{
          display: "flex",
          flexDirection: "row",
          columnGap: 4,
          alignItems: "center",
          height: 21,
          paddingRight: 6,
          borderRadius: 6,
          border: "1px solid rgba(234, 235, 240, 1)",
          background: "rgba(255, 255, 255, 1)",
        }}
      >
        <div
          style={{
            minWidth: 37,
            height: 21,
            background: "rgba(247, 247, 248, 1)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "0 8px",
            borderRadius: "5px 0 0 5px",
          }}
        >
          <span
            style={{
              fontFamily: "Inter, sans-serif",
              fontWeight: 400,
              fontSize: 13,
              color: "rgba(37, 37, 37, 1)",
              whiteSpace: "nowrap",
            }}
          >
            Lot
          </span>
        </div>
        <span
          style={{
            fontFamily: "Inter, sans-serif",
            fontWeight: 400,
            fontSize: 13,
            /* Match the left "Lot" segment's near-black so the pill reads
               as one unit. Previously slate-500 made the right half look
               muted vs the left half. */
            color: "rgba(37, 37, 37, 1)",
            whiteSpace: "nowrap",
          }}
        >
          {label}
        </span>
      </div>
    </div>
  );
}

export default LotTrackingTag;
