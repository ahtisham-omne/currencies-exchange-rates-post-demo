export interface PriceWithUomProps {
  price: number;
  uom: string;
  className?: string;
}

/**
 * `$X.XX / <uom>` cell renderer used in QV/PO pricing columns.
 */
export function PriceWithUom({ price, uom, className }: PriceWithUomProps) {
  return (
    <span className={className}>
      <span className="text-foreground font-medium">${price.toFixed(2)}</span>
      <span className="text-muted-foreground"> / {uom}</span>
    </span>
  );
}