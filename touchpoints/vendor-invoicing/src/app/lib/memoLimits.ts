// Memo line character limits by payment method (10/29): Card 80,
// Wire 140, every other method 100. One source for the record-payment
// flow, payment runs and seeded run payments.
export function memoLimitFor(methodType: string | undefined): number {
  if (methodType === 'Card') return 80;
  if (methodType === 'Wire') return 140;
  return 100;
}
