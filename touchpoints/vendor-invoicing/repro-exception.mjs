import { chromium } from 'playwright';
const b = await chromium.launch();
const page = await (await b.newContext({ viewport: { width: 1600, height: 1000 } })).newPage();
page.setDefaultTimeout(20000);
page.on('pageerror', (e) => console.log('PAGE ERROR:', e.message.slice(0, 160)));
await page.goto('http://localhost:8080/invoices/INV-2024-1006', { waitUntil: 'networkidle' });
await page.waitForTimeout(1000);
// Detail-page line SKUs
const detailSkus = await page.evaluate(() => Array.from(document.querySelectorAll('tr')).map((r) => (r.textContent.match(/ITM-\d+/) || [])[0]).filter(Boolean));
console.log('detail SKUs:', JSON.stringify([...new Set(detailSkus)]));
// open flags accordion: single icon? summary amber?
const flagsBtn = page.getByRole('button', { name: /Flags/i }).first();
await flagsBtn.click(); await page.waitForTimeout(400);
const flagInfo = await page.evaluate(() => {
  const headers = Array.from(document.querySelectorAll('button')).filter((b) => /Flags/i.test(b.textContent));
  const section = headers[0]?.closest('div.rounded-xl');
  const svgs = section ? Array.from(section.querySelectorAll('svg')).map((s) => s.getAttribute('class') || '') : [];
  const flagIcons = svgs.filter((c) => /lucide-flag/.test(c));
  const innerCards = section ? section.querySelectorAll('.rounded-md.border').length : -1;
  return { flagIcons, innerCards };
});
console.log('flags:', JSON.stringify(flagInfo));
// Resolve
await page.getByRole('button', { name: /^Resolve/i }).first().click();
await page.waitForTimeout(1600);
const resolveSkus = await page.evaluate(() => Array.from(document.querySelectorAll('tr')).map((r) => (r.textContent.match(/ITM-\d+/) || [])[0]).filter(Boolean));
console.log('resolve SKUs:', JSON.stringify([...new Set(resolveSkus)]));
const emptyTable = await page.evaluate(() => /No line items match/.test(document.body.innerText));
console.log('empty line table?', emptyTable);
const cta = await page.evaluate(() => {
  const btn = Array.from(document.querySelectorAll('button')).find((x) => /Resolve and resubmit/.test(x.textContent));
  return btn ? getComputedStyle(btn).backgroundColor : 'none';
});
console.log('resolve CTA bg:', cta, '(amber-600 = rgb(217, 119, 6))');
await b.close();
