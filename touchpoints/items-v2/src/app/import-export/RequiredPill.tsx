/**
 * RequiredPill: the rounded "Required" tag after a required column's name in
 * the Review and Fix grids. Bordered, in the blue of the Update chip (Partners
 * review: #EFF6FF fill, #1E40AF text, #DBEAFE border, the same 50 / 800 / 100
 * pattern as the Ready and Error chips), sized to the 12px header label.
 */
export function RequiredPill() {
  return (
    <span
      className="shrink-0 rounded-full border px-1.5 whitespace-nowrap"
      style={{ fontSize: "10.5px", fontWeight: 500, lineHeight: "15px", backgroundColor: "#EFF6FF", color: "#1E40AF", borderColor: "#DBEAFE" }}
    >
      Required
    </span>
  );
}
