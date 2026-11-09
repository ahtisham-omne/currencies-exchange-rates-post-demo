import { test, expect, type Page } from '@playwright/test'

/* The six Configure Visuals switches, each proved by what it DRAWS.
   Browser-only by nature: every one of these is a claim about paint - a shaded
   cross that follows the pointer, a stripe on alternate rows, a rule between
   columns, a gutter opened in a cell's border, a heading that sticks, a line
   clipped with an ellipsis. A source test can see the class name go on and
   would have passed against a stylesheet that drew none of it. */

async function openVisuals(page: Page) {
  await page.locator('button.fr-tool-btn').filter({ hasText: 'Columns' }).first().click()
  await page.getByText('Configure Visuals', { exact: true }).click()
  await expect(page.locator('[aria-label="Back to columns"]')).toBeVisible()
}

/** The Configure Visuals view, scoped off the one control only it carries. */
const visuals = (page: Page) => page.locator('[aria-label="Back to columns"]').locator('xpath=../..')

async function flip(page: Page, label: string) {
  const row = visuals(page).locator('div.flex.items-center.justify-between').filter({ hasText: label })
  await row.getByRole('switch').click()
  await page.waitForTimeout(250)
}

/** The widest table on the page - the one the switches are about. */
const lookRoot = (page: Page) => page.evaluate(() => {
  const t = Array.from(document.querySelectorAll('table'))
    .sort((a, b) => b.getBoundingClientRect().width - a.getBoundingClientRect().width)[0]
  return !!t
})

test.describe('chart of accounts', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1600, height: 1000 })
    await page.goto('/chart-of-accounts', { waitUntil: 'networkidle' })
    await expect(page.locator('table').first()).toBeVisible()
    expect(await lookRoot(page)).toBe(true)
  })

  test('crosshair shades the hovered row and column, and puts the cells back', async ({ page }) => {
    // On by default, so there is nothing to flip first.
    const cell = page.locator('tbody tr td').nth(6)
    await cell.hover()
    await page.waitForTimeout(200)

    const shaded = await page.locator('[data-xh]').count()
    expect(shaded, 'a row and a column of cells carry the wash').toBeGreaterThan(3)
    // The hovered cell is the strong one: its wash differs from its neighbours'.
    const inks = await page.evaluate(() => {
      const els = Array.from(document.querySelectorAll('[data-xh]')) as HTMLElement[]
      return new Set(els.map(e => e.style.getPropertyValue('background-color'))).size
    })
    expect(inks, 'the crossing cell is shaded harder than the band').toBe(2)
    // The column's own heading is part of the band.
    expect(await page.locator('thead th[data-xh]').count()).toBe(1)

    await page.mouse.move(5, 5)
    await page.waitForTimeout(250)
    expect(await page.locator('[data-xh]').count(), 'nothing is left behind').toBe(0)
  })

  test('striped rows shades alternate rows, and only while it is on', async ({ page }) => {
    const bands = () => page.evaluate(() => {
      const rows = Array.from(document.querySelectorAll('tbody tr')).slice(0, 8)
      return new Set(rows.map(r => getComputedStyle(r).backgroundColor)).size
    })
    await openVisuals(page)
    await flip(page, 'Striped rows')
    // The pointer sits over the panel, so no hover or crosshair is in play.
    expect(await bands(), 'alternate rows differ').toBeGreaterThan(1)
    await flip(page, 'Striped rows')
    expect(await bands(), 'off, the rows are one colour again').toBe(1)
  })

  /* The rule is an inset shadow rather than a border-right on purpose: a border
     would sit beside the frozen cell's own inset shadow and double the freeze
     line, and would shift every column by a pixel each time the switch is
     thrown. So this looks for the shadow, and a border here would be the bug. */
  test('lines between columns draws a rule on every cell but the last', async ({ page }) => {
    const rules = () => page.evaluate(() => {
      const tds = Array.from(document.querySelectorAll('tbody tr:first-child td'))
      // Chrome serialises a shadow colour-first: "rgb(…) -1px 0px 0px 0px inset".
      const ruled = (el: Element) => /-1px 0px 0px 0px inset/.test(getComputedStyle(el).boxShadow)
      return {
        ruled: tds.slice(0, -1).filter(ruled).length,
        last: tds.length > 1 ? ruled(tds[tds.length - 1]) : null,
        shifted: tds.some(td => parseFloat(getComputedStyle(td).borderRightWidth) >= 1),
      }
    })
    expect((await rules()).ruled, 'nothing is ruled at rest').toBe(0)
    await openVisuals(page)
    await flip(page, 'Lines between columns')
    const on = await rules()
    expect(on.ruled).toBeGreaterThan(3)
    expect(on.last, 'the card edge already closes the last column').toBe(false)
    expect(on.shifted, 'drawn as a shadow, so no column moves').toBe(false)
  })

  test('row numbers opens a gutter, rules it, and never borrows the row weight', async ({ page }) => {
    await openVisuals(page)
    await flip(page, 'Row numbers')
    const g = await page.evaluate(() => {
      const table = Array.from(document.querySelectorAll('table'))
        .sort((a, b) => b.getBoundingClientRect().width - a.getBoundingClientRect().width)[0]
      const rows = Array.from(table.querySelectorAll('tbody tr[data-tree-account]'))
      const lead = rows[0].querySelector('td:not([colspan])') as HTMLElement
      const cs = getComputedStyle(lead)
      const before = getComputedStyle(lead, '::before')
      /* A Summary row carries its emphasis on the name inside the row, not on
         the leading cell, so look across the whole row - the number standing
         beside it must still be 400. */
      const bold = rows.find(r => Array.from(r.querySelectorAll('*'))
        .some(e => parseInt(getComputedStyle(e).fontWeight, 10) >= 600))
      const boldBefore = bold && getComputedStyle(bold.querySelector('td:not([colspan])')!, '::before')
      const everyNumberIsRegular = rows.every(r =>
        getComputedStyle(r.querySelector('td:not([colspan])')!, '::before').fontWeight === '400')
      return {
        rows: rows.length,
        gutter: Math.round(parseFloat(cs.borderLeftWidth)),
        varW: getComputedStyle(table).getPropertyValue('--fr-rownum-w').trim(),
        content: before.content,
        weight: before.fontWeight,
        pad: before.paddingLeft,
        layers: cs.backgroundImage.split('linear-gradient').length - 1,
        boldRowWeight: boldBefore?.fontWeight ?? null,
        everyNumberIsRegular,
        headGutter: Math.round(parseFloat(getComputedStyle(
          table.querySelector('thead tr[data-grid-head-row] th:not([colspan])')!).borderLeftWidth)),
      }
    })
    // 16px in, 8px per tabular digit, 16px out, and never under two digits.
    const digits = Math.max(2, String(Math.max(g.rows, 1)).length)
    expect(g.gutter, `gutter for ${g.rows} rows`).toBe(32 + 8 * digits)
    expect(g.varW).toBe(`${32 + 8 * digits}px`)
    expect(g.headGutter, 'the headings stand on the same left edge').toBe(g.gutter)
    expect(g.content, 'the number is the row counter').not.toBe('none')
    expect(g.pad).toBe('16px')
    expect(g.weight, 'the number keeps its own weight').toBe('400')
    expect(g.boldRowWeight, 'even beside a bold Summary row').toBe('400')
    expect(g.everyNumberIsRegular, 'no numbered row borrows its row weight').toBe(true)
    // Two layers: the vertical rule at the gutter's edge and the row line across it.
    expect(g.layers, 'the gutter is ruled like a column').toBe(2)
  })

  test('pin group headings sticks the category band under the headings', async ({ page }) => {
    const stuck = () => page.evaluate(() =>
      Array.from(document.querySelectorAll('tr.coa-cat-sticky td'))
        .filter(td => getComputedStyle(td).position === 'sticky').length)
    expect(await stuck(), 'nothing is pinned at rest').toBe(0)
    await openVisuals(page)
    await flip(page, 'Pin group headings')
    expect(await stuck()).toBeGreaterThan(0)
  })

  test('truncate long text clips at the column edge with an ellipsis', async ({ page }) => {
    const clipped = () => page.evaluate(() => {
      const td = document.querySelector('tbody tr td:not([data-actions-cell])')!
      const cs = getComputedStyle(td)
      return { overflow: cs.textOverflow, wrap: cs.whiteSpace }
    })
    expect((await clipped()).overflow).not.toBe('ellipsis')
    await openVisuals(page)
    await flip(page, 'Truncate long text')
    expect(await clipped()).toEqual({ overflow: 'ellipsis', wrap: 'nowrap' })
  })
})

test.describe('tree layout', () => {
  const openDensity = async (page: Page) => {
    await page.locator('button.fr-tool-btn').filter({ hasText: /Condensed|Comfort/ }).first().click()
    await page.waitForTimeout(250)
  }
  /* The disc is a 2px-ringed circle; Arrows is the same toggle drawn as a bare
     chevron, and the guide lines stand down with it. */
  const tree = (page: Page) => page.evaluate(() => {
    const toggle = document.querySelector('button[aria-label="Collapse"], button[aria-label="Expand"]')
    return {
      round: toggle ? getComputedStyle(toggle).borderRadius : null,
      ring: toggle ? parseFloat(getComputedStyle(toggle).borderTopWidth) : null,
      chevron: !!toggle?.querySelector('svg'),
      guides: document.querySelectorAll('td span[aria-hidden].bg-slate-200').length,
      elbows: document.querySelectorAll('td span[aria-hidden].border-slate-200').length,
    }
  })

  test('arrows swaps the disc for a chevron and drops the connectors', async ({ page }) => {
    await page.setViewportSize({ width: 1600, height: 1000 })
    await page.goto('/chart-of-accounts', { waitUntil: 'networkidle' })
    await expect(page.locator('table').first()).toBeVisible()

    const lines = await tree(page)
    expect(lines.ring, 'Tree lines draws the disc as a 2px ring').toBe(2)
    expect(lines.guides, 'and hangs trunks down the indent').toBeGreaterThan(0)
    expect(lines.elbows, 'with an elbow into each row').toBeGreaterThan(0)

    await openDensity(page)
    await page.getByText('Arrows', { exact: true }).click()
    await page.waitForTimeout(400)
    const arrows = await tree(page)
    expect(arrows.ring, 'the ring is gone').toBe(0)
    expect(arrows.round, 'a chevron sits in a rounded square, not a disc').not.toBe('50%')
    expect(arrows.chevron).toBe(true)
    expect(arrows.guides, 'the trunks stand down with the disc').toBe(0)
    expect(arrows.elbows, 'and so do the elbows').toBe(0)
  })
})

/* Column widths, which is where the pointer does the talking. None of this is
   visible to a source test: a width only becomes `custom` because a mouse moved,
   and the grips only stand down because a card was picked. */
test.describe('column widths', () => {
  const openDensity = async (page: Page) => {
    await page.locator('button.fr-tool-btn').filter({ hasText: /Condensed|Comfort/ }).first().click()
    await page.waitForTimeout(250)
  }
  /** Which of Default / Fit / Equal is lit, or null when a drag has left the
   *  table on a width that matches none of them. */
  const litCard = (page: Page) => page.evaluate(() => {
    const panel = Array.from(document.querySelectorAll('div'))
      .filter(d => d.textContent?.includes('Compact table view') && d.children.length <= 6).pop()
    const grid = Array.from(panel?.querySelectorAll('div.grid') ?? []).pop()
    const on = Array.from(grid?.querySelectorAll('button') ?? [])
      .find(b => b.getAttribute('aria-pressed') === 'true')
    return on?.textContent ?? null
  })
  const grips = (page: Page) => page.locator('th [title="Drag to resize"]').count()

  /* Picking a width card leaves the menu open on purpose - the cards are a
     comparison, and closing on the first pick would make you reopen to try the
     next. So this only opens the menu when it is not already up. */
  async function pickWidth(page: Page, label: string) {
    const card = page.getByText(label, { exact: true })
    if (!(await card.count())) await openDensity(page)
    await page.getByText(label, { exact: true }).click()
    await page.waitForTimeout(300)
  }

  /** Drag the right edge of a header by `dx`. */
  async function dragEdge(page: Page, dx: number) {
    const grip = page.locator('th [title="Drag to resize"]').nth(2)
    const b = (await grip.boundingBox())!
    await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2)
    await page.mouse.down()
    await page.mouse.move(b.x + b.width / 2 + dx, b.y + b.height / 2, { steps: 12 })
    await page.mouse.up()
    await page.waitForTimeout(250)
  }

  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1600, height: 1000 })
    await page.goto('/chart-of-accounts', { waitUntil: 'networkidle' })
    await expect(page.locator('table').first()).toBeVisible()
  })

  test('dragging a column edge leaves the table on no card at all', async ({ page }) => {
    await openDensity(page)
    expect(await litCard(page), 'Default is lit to start').toBe('Default')
    await page.keyboard.press('Escape')

    const before = await page.locator('th').nth(3).evaluate(el => el.getBoundingClientRect().width)
    await dragEdge(page, 90)
    const after = await page.locator('th').nth(3).evaluate(el => el.getBoundingClientRect().width)
    expect(after, 'the column actually moved').toBeGreaterThan(before + 40)

    await openDensity(page)
    expect(await litCard(page), 'a hand-set width matches no card').toBe(null)
  })

  test('picking a card throws every hand-dragged width away', async ({ page }) => {
    await dragEdge(page, 90)
    const dragged = await page.locator('th').nth(3).evaluate(el => el.getBoundingClientRect().width)

    await pickWidth(page, 'Default')
    const reset = await page.locator('th').nth(3).evaluate(el => el.getBoundingClientRect().width)
    expect(reset, 'the drag is gone').toBeLessThan(dragged - 40)
  })

  test('fit and equal stand the grips down, and default puts them back', async ({ page }) => {
    expect(await grips(page), 'Default is hand-resizable').toBeGreaterThan(0)
    await pickWidth(page, 'Fit')
    expect(await grips(page), 'Fit sizes the columns, so there is nothing to drag').toBe(0)
    await pickWidth(page, 'Equal')
    expect(await grips(page)).toBe(0)
    await pickWidth(page, 'Default')
    expect(await grips(page), 'Default hands the columns back').toBeGreaterThan(0)
  })
})

test.describe('what each table is allowed to offer', () => {
  const blocks = (page: Page) => page.evaluate(() => {
    const panel = Array.from(document.querySelectorAll('div'))
      .filter(d => d.textContent?.includes('Compact table view') && d.children.length <= 6).pop()
    return Array.from(panel?.querySelectorAll('p') ?? []).map(p => p.textContent)
  })
  const openDensity = async (page: Page) => {
    await page.locator('button.fr-tool-btn').filter({ hasText: /Condensed|Comfort/ }).first().click()
    await page.waitForTimeout(250)
  }

  test('the ledger offers tree layout and the journal does not', async ({ page }) => {
    await page.setViewportSize({ width: 1600, height: 1000 })
    await page.goto('/general-ledger', { waitUntil: 'networkidle' })
    await openDensity(page)
    expect(await blocks(page)).toEqual(['Tree layout', 'Column widths'])
    await page.keyboard.press('Escape')

    await page.getByText('Journal entries', { exact: true }).first().click()
    await page.waitForTimeout(400)
    await openDensity(page)
    expect(await blocks(page), 'a flat list has no tree to style').toEqual(['Column widths'])
  })

  test('the register offers neither a tree nor pinned groups', async ({ page }) => {
    await page.setViewportSize({ width: 1600, height: 1000 })
    await page.goto('/chart-of-accounts/acct_11110', { waitUntil: 'networkidle' })
    await page.getByText('Transactions', { exact: true }).first().click()
    await page.waitForTimeout(400)
    await openDensity(page)
    expect(await blocks(page)).toEqual(['Column widths'])
    await page.keyboard.press('Escape')

    await openVisuals(page)
    await expect(visuals(page).getByText('Pin group headings')).toHaveCount(0)
    await expect(visuals(page).getByText('Crosshair on hover')).toHaveCount(1)
  })

  /* Spec §8: a band heads an account's postings and a total closes them. Neither
     is a line of the ledger, so neither takes a number or advances the count. */
  test('the ledger numbers its postings, and neither the band nor the total', async ({ page }) => {
    await page.setViewportSize({ width: 1600, height: 1000 })
    await page.goto('/general-ledger', { waitUntil: 'networkidle' })
    await expect(page.locator('table').first()).toBeVisible()
    // The ledger opens with every account collapsed, so there is nothing to
    // number until a band is opened.
    await page.locator('tbody.gl-group tr.gl-parent button[aria-label="Expand"]').first().click()
    await expect(page.locator('tbody.gl-group tr.gl-child').first()).toBeVisible()

    await page.locator('button.fr-tool-btn').filter({ hasText: 'Columns' }).first().click()
    await page.getByText('Configure Visuals', { exact: true }).click()
    await expect(page.locator('[aria-label="Back to columns"]')).toBeVisible()
    await visuals(page).locator('div.flex.items-center.justify-between')
      .filter({ hasText: 'Row numbers' }).getByRole('switch').click()
    await page.waitForTimeout(400)

    const numbered = (sel: string) => page.evaluate(s => Array.from(document.querySelectorAll(s))
      .map(r => {
        const td = r.querySelector('td:not([colspan])')
        return td ? getComputedStyle(td, '::before').content : 'none'
      }), sel)

    const postings = await numbered('tbody.gl-group tr.gl-child')
    expect(postings.length, 'there are postings on screen').toBeGreaterThan(0)
    expect(postings.every(c => c !== 'none'), 'every posting is numbered').toBe(true)

    for (const sel of ['tbody.gl-group tr.gl-parent', 'tbody.gl-group tr.gl-total']) {
      const rows = await numbered(sel)
      expect(rows.length, `${sel} is on screen`).toBeGreaterThan(0)
      expect(rows.every(c => c === 'none'), `${sel} takes no number`).toBe(true)
    }
  })

  test('dimensions offers density without a columns button', async ({ page }) => {
    await page.setViewportSize({ width: 1600, height: 1000 })
    await page.goto('/dimensions', { waitUntil: 'networkidle' })
    await expect(page.locator('button.fr-tool-btn')).toHaveCount(1)
    await expect(page.locator('button.fr-tool-btn')).toHaveText(/Condensed/)
    await openDensity(page)
    expect(await blocks(page)).toEqual(['Column widths'])
  })
})
