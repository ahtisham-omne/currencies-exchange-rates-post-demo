import { chromium } from 'playwright-core';
const SP = process.argv[2];
const b = await chromium.launch({ channel: 'chrome' });
const p = await b.newPage({ viewport: { width: 1500, height: 950 } });
const errs = []; p.on('pageerror', e => errs.push(e.message));
await p.goto('http://localhost:5241/', { waitUntil: 'networkidle' });
await p.waitForTimeout(1700);
// the relative-date marker shows on the detail page's date cards
await p.getByText('Q-000-000-000', { exact: true }).first().click({ force: true });
await p.waitForTimeout(2600);
const marker = await p.evaluate(() => {
  const star = [...document.querySelectorAll('span')].find((s) => s.textContent.trim() === '*' && getComputedStyle(s).fontWeight === '600');
  if (!star) return { found: false };
  const row = star.parentElement;
  row.scrollIntoView({ block: 'center' });
  const r = row.getBoundingClientRect();
  return { found: true, text: row.textContent.trim(), at: { x: Math.round(r.x), y: Math.round(r.y) } };
});
console.log('A. relative marker on a card:', JSON.stringify(marker));
if (marker.found) {
  await p.mouse.move(marker.at.x + 20, marker.at.y + 8);
  await p.waitForTimeout(900);
  console.log('B. hover card:', JSON.stringify(await p.evaluate(() => {
    const t = document.body.innerText;
    return {
      title: /Relative date/.test(t),
      explains: /This date is not fixed/.test(t),
      today: /Today/.test(t),
      emDash: /—|--/.test((t.match(/Relative date[\s\S]{0,400}/) || [''])[0]),
    };
  })));
  await p.screenshot({ path: SP + '/rel-date.png', clip: { x: Math.max(0, marker.at.x - 40), y: Math.max(0, marker.at.y - 30), width: 460, height: 300 } });
}
console.log('errors:', JSON.stringify(errs.slice(0, 3)));
await b.close();
