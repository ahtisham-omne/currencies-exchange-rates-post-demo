/* Browser download helpers shared by the template and export code. */

export function triggerBlobDownload(filename: string, blob: Blob): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  // Slight delay before revoking so Safari has a chance to start the download.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function triggerTextDownload(filename: string, text: string, mime = "text/plain;charset=utf-8"): void {
  triggerBlobDownload(filename, new Blob([text], { type: mime }));
}

/** Load exceljs lazily (it is ~600 KB) and unwrap the CJS default. */
export async function loadExcelJS(): Promise<typeof import("exceljs")> {
  const mod = await import("exceljs");
  return ((mod as unknown as { default?: typeof import("exceljs") }).default ?? mod) as typeof import("exceljs");
}
