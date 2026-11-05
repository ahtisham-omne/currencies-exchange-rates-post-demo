/* The "Last import finished." notice the listing shows after an import.
 * Kept in a tiny in-memory store (not React state) so the wizard can be
 * opened from the history page and the listing still picks the notice up
 * when "View Items Listing" lands on it. */
import { useEffect, useState } from "react";

export interface ImportNotice {
  created: number;
  updated: number;
  skipped: number;
  importId: string;
}

let current: ImportNotice | null = null;
const listeners = new Set<() => void>();

export function setImportNotice(notice: ImportNotice | null): void {
  current = notice;
  listeners.forEach((l) => l());
}

export function getImportNotice(): ImportNotice | null {
  return current;
}

export function useImportNotice(): [ImportNotice | null, () => void] {
  const [notice, setNotice] = useState<ImportNotice | null>(current);
  useEffect(() => {
    const l = () => setNotice(current);
    listeners.add(l);
    return () => {
      listeners.delete(l);
    };
  }, []);
  return [notice, () => setImportNotice(null)];
}
