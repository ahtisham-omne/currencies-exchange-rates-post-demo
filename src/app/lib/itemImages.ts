// Shared item-thumbnail helper. Same stable hash + Unsplash set that
// the vendor-invoicing CreateInvoiceScreen picker uses, exported so
// the RMA listing "Ordered items" cell can render the SAME photo for
// a given SKU that the user sees inside the create flow.
const ITEM_IMAGES = [
  'photo-1772209049802-cd0e0ff1a5d3',
  'photo-1713575882582-8938739db351',
  'photo-1737223450913-2af6885945e1',
  'photo-1759159091728-e2c87b9d9315',
  'photo-1661069387900-54d5843b704d',
  'photo-1758873263527-ca53b938fbd4',
  'photo-1672689933227-2ce1249c46a9',
  'photo-1767340078306-89630b12d81c',
  'photo-1769355104335-acef3aa4c9b6',
  'photo-1758857087505-957823893209',
];

export function imageForSku(sku: string, size = 160): string {
  let h = 0;
  for (let i = 0; i < sku.length; i++) h = sku.charCodeAt(i) + ((h << 5) - h);
  const photo = ITEM_IMAGES[Math.abs(h) % ITEM_IMAGES.length];
  return `https://images.unsplash.com/${photo}?w=${size}&h=${size}&fit=crop&auto=format&q=80`;
}
