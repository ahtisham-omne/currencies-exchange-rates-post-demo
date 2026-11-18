/**
 * The paperwork behind a linked document.
 *
 * A purchase order carries its confirmation and the vendor's quote, a receipt
 * its signed docket and a dock photo, an invoice its backup workbook. Those
 * files hang off the document rather than off the return, so the Linked
 * Records table shows them per row rather than in a view of their own.
 *
 * Synthesized per document and stable, the way the rest of this prototype
 * synthesizes what a record carries.
 */

import type { AttachmentCardData } from '@/app/components/shared/attachments/attachment-card';
import type { LinkedFinancialRecord } from '@/app/data/invoiceLinkedRecords';

export interface RecordFile {
  id: string;
  record: LinkedFinancialRecord;
  data: AttachmentCardData;
  kind: string;
}

/** Stable pseudo-random, so the same document always carries the same files. */
function hash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

/** What each kind of document has behind it. Names are the ones these files
 *  actually carry in a warehouse: a docket, a remittance, a backup workbook. */
const FILES_BY_TYPE: Record<string, { name: string; kind: string; size: string }[]> = {
  'Purchase Order': [
    { name: 'Order_Confirmation.pdf', kind: 'pdf', size: '820 KB' },
    { name: 'Vendor_Quote.pdf', kind: 'pdf', size: '340 KB' },
    { name: 'Order_Terms_Accepted.pdf', kind: 'pdf', size: '210 KB' },
  ],
  'Receiving Document': [
    { name: 'Delivery_Docket_Signed.pdf', kind: 'pdf', size: '1.1 MB' },
    { name: 'Dock_Inspection_Checklist.pdf', kind: 'pdf', size: '480 KB' },
    { name: 'Pallet_Condition_Photo.jpg', kind: 'jpg', size: '3.2 MB' },
  ],
  'Vendor Invoice': [
    { name: 'Vendor_Invoice.pdf', kind: 'pdf', size: '640 KB' },
    { name: 'Invoice_Line_Backup.xlsx', kind: 'xlsx', size: '96 KB' },
  ],
  Payment: [{ name: 'Remittance_Advice.pdf', kind: 'pdf', size: '180 KB' }],
  'Credit Memo': [{ name: 'Vendor_Credit_Note.pdf', kind: 'pdf', size: '520 KB' }],
  'Picking Document': [{ name: 'Pick_List.pdf', kind: 'pdf', size: '140 KB' }],
  'Shipping Document': [
    { name: 'Bill_of_Lading.pdf', kind: 'pdf', size: '760 KB' },
    { name: 'Carrier_Label.pdf', kind: 'pdf', size: '120 KB' },
  ],
};

const PHOTO =
  'https://images.unsplash.com/photo-1581094794329-c8112a89af12?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=400';

/** The files behind one document. A journal entry and a line of unlinked
 *  stock carry none, which is a fact about them rather than a gap. */
export function filesForRecord(record: LinkedFinancialRecord): RecordFile[] {
  const spec = FILES_BY_TYPE[record.type] ?? [];
  const seed = hash(record.reference);
  return spec.map((f, i) => ({
    id: `${record.id}-att-${i}`,
    record,
    kind: f.kind,
    data: {
      fileName: `${record.reference.replace(/[^A-Za-z0-9-]/g, '')}_${f.name}`,
      fileType: f.kind,
      fileSize: f.size,
      uploadedDate: record.date,
      uploadedTime: `${8 + ((seed + i) % 9)}:${String((seed + i * 7) % 60).padStart(2, '0')} AM`,
      uploadedBy: record.createdBy,
      ...(f.kind === 'jpg' ? { previewUrl: PHOTO } : {}),
    },
  }));
}

