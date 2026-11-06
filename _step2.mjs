import { chromium } from 'playwright-core';
const SP = process.argv[2];
const b = await chromium.launch({ channel: 'chrome' });
const p = await b.newPage({ viewport: { width: 1500, height: 950 } });
const errs = []; p.on('pageerror', e => errs.push(e.message));
await p.goto('http://localhost:5241/', { waitUntil: 'networkidle' });
await p.waitForTimeout(1800);
await p.locator('button', { hasText: 'Create New Quote' }).first().click({ force: true });
await p.waitForTimeout(2200);
const inputs = await p.evaluate(() => [...document.querySelectorAll('input')].map((i) => i.placeholder || i.type));
console.log('inputs:', JSON.stringify(inputs.slice(0, 6)));
const search = p.locator('input').first();
await search.click({ force: true });
await search.type('Metro', { delay: 40 });
await p.waitForTimeout(1500);
const results = await p.evaluate(() => [...document.querySelectorAll('button')].map((x) => (x.textContent || '').replace(/\s+/g, ' ').trim()).filter((t) => /Metro/.test(t)).slice(0, 4));
console.log('results:', JSON.stringify(results));
if (results.length) {
  await p.locator('button', { hasText: /Metro City Fire/ }).first().click({ force: true });
  await p.waitForTimeout(1600);
  const cont = p.locator('button', { hasText: /^Continue/ }).first();
  if (await cont.count() && await cont.isEnabled()) { await cont.click({ force: true }); await p.waitForTimeout(2000); }
}
const layout = await p.evaluate(() => {
  const helper = [...document.querySelectorAll('p')].find((e) => /Press enter or comma to add tags/.test(e.textContent || ''));
  const priority = [...document.querySelectorAll('*')].find((e) => e.children.length === 0 && e.textContent.trim() === 'Priority');
  const expiry = [...document.querySelectorAll('*')].find((e) => e.children.length === 0 && /Expiration date/i.test(e.textContent.trim()));
  const rowY = (el) => (el ? Math.round(el.getBoundingClientRect().y) : null);
  return {
    tagsField: !!helper,
    priorityY: rowY(priority),
    expiryY: rowY(expiry),
    tagsY: helper ? Math.round(helper.getBoundingClientRect().y) : null,
    sameRow: priority && expiry ? Math.abs(rowY(priority) - rowY(expiry)) < 24 : null,
  };
});
console.log('layout:', JSON.stringify(layout));
await p.screenshot({ path: SP + '/q-step2.png' });
console.log('errors:', JSON.stringify(errs.slice(0, 3)));
await b.close();
