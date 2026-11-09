import { test, expect, type Page } from '@playwright/test'

/* Working the nested tables without a mouse.

   Almost all of this was already true: the checkbox, the expand toggle and the
   kebab are native `<input>` and `<button>`, so Tab reached them and Enter and
   Space worked on them for free. What did not work was everything a pointer had
   been quietly standing in for - a row that opened only by clicking the `<tr>`,
   a status chip that was a `<span>`, and a menu portalled to the end of `<body>`
   where Tab walked straight past it into the next row.

   Pinned against the running page because every one of those is a fact about
   focus, and focus is not visible in the source. A `<button>` that renders inside
   a portal is in tab order somewhere - the question is where, and only the
   browser answers it. */

// What has focus, in the form these tests care about: what kind of element, what
// it is called, and which region of the page it is in.
const focused = () => {
  const el = document.activeElement as HTMLElement | null
  if (!el || el === document.body) return 'NOTHING'
  const where = el.closest('[data-menu-panel]') ? 'PANEL' : el.closest('table') ? 'TABLE' : 'CHROME'
  const name = (el.getAttribute('aria-label') || el.textContent || '').replace(/\s+/g, ' ').trim()
  return `${el.tagName.toLowerCase()}|${name}|${where}`
}

const at = (page: Page) => page.evaluate(focused)

async function tabTrail(page: Page, steps: number) {
  const trail: string[] = []
  for (let i = 0; i < steps; i++) { trail.push(await at(page)); await page.keyboard.press('Tab') }
  return trail
}

const openChart = async (page: Page) => {
  await page.goto('/chart-of-accounts', { waitUntil: 'networkidle' })
  await page.locator('table tbody input.coa-check').first().waitFor()
}

const kebab = (page: Page) => page.locator('table tbody button[aria-label^="Actions for"]').first()

/* The toggle on the first body row, found by position rather than by its label:
   the label is the thing under test and flips between Expand and Collapse, so a
   locator keyed on it silently re-resolves to some other row's toggle the moment
   the press lands. */
const firstToggle = (page: Page) =>
  page.locator('table tbody tr').first().locator('button[aria-label="Expand"], button[aria-label="Collapse"]').first()

test.describe('the order Tab visits a row in', () => {
  /* Left to right, as the row reads. The order is not configured anywhere - it
     falls out of the DOM - so what this really pins is that no control has been
     moved out of the cell it appears in, and that the name button sits between
     the toggle and the status chip rather than at the end of the row. */
  test('is checkbox, toggle, name, status, actions', async ({ page }) => {
    await openChart(page)
    await page.locator('table tbody input.coa-check').first().focus()
    const trail = await tabTrail(page, 9)
    const kinds = trail.map(s => s.split('|')[0])
    expect(kinds).toEqual(['input', 'button', 'button', 'button', 'input', 'button', 'button', 'button', 'button'])
    expect(trail[0]).toMatch(/^input\|Select /)
    expect(trail[1]).toMatch(/^button\|(Collapse|Expand)\|TABLE$/)
    // The name, which is the row's own door and carries no label of its own.
    expect(trail[2]).toBe('button|ASSETS|TABLE')
    expect(trail[3]).toMatch(/^button\|Actions for ASSETS\|TABLE$/)
  })

  /* Nothing that only states a fact is a stop. This is the half of the ask that
     is about what is *absent*, and it cannot be checked by naming elements - a
     number cell made focusable by a stray tabIndex would pass every test above
     and fail only this one. */
  test('never lands on a number, an amount or a badge', async ({ page }) => {
    await openChart(page)
    await page.locator('table tbody input.coa-check').first().focus()
    const kinds = new Set<string>()
    for (let i = 0; i < 120; i++) {
      kinds.add(await page.evaluate(() => {
        const el = document.activeElement as HTMLElement
        return el?.closest('table') ? el.tagName.toLowerCase() : 'off-table'
      }))
      await page.keyboard.press('Tab')
    }
    // Only these three, though a walk this short may never leave the chart at all.
    expect([...kinds].every(k => k === 'button' || k === 'input' || k === 'off-table')).toBe(true)
    expect(kinds.has('button') && kinds.has('input')).toBe(true)
  })
})

test.describe('the controls answer the keys they look like they should', () => {
  test('Space ticks the row checkbox', async ({ page }) => {
    await openChart(page)
    const box = page.locator('table tbody input.coa-check').first()
    await box.focus()
    await page.keyboard.press('Space')
    await expect(box).toBeChecked()
  })

  /* Both keys, on the control the whole table is built around. The toggle keeps
     focus through the re-render, which is what lets someone open a branch and
     carry on into it rather than being dropped back at the top of the page. */
  for (const key of ['Enter', 'Space'] as const) {
    test(`${key} works the expand toggle and focus stays on it`, async ({ page }) => {
      await openChart(page)
      const t = firstToggle(page)
      await t.focus()
      await page.keyboard.press(key)
      await expect(t).toHaveAttribute('aria-label', 'Expand')
      expect(await at(page)).toBe('button|Expand|TABLE')
    })
  }

  test('Enter on the account name opens it', async ({ page }) => {
    await openChart(page)
    await page.locator('table tbody button', { hasText: 'Petty Cash' }).first().focus()
    await page.keyboard.press('Enter')
    await page.waitForURL(/\/chart-of-accounts\/acct_/)
  })
})

test.describe('the row menu, which is portalled away from its row', () => {
  /* The bug this is here for: the panel renders at the end of `<body>`, so Tab
     from the trigger used to step into the *next row's* checkbox and leave the
     menu hanging open behind it. Every row action was mouse-only. */
  for (const key of ['Enter', 'Space'] as const) {
    test(`${key} opens it and puts focus on the first item`, async ({ page }) => {
      await openChart(page)
      await kebab(page).focus()
      await page.keyboard.press(key)
      await expect(page.locator('[data-menu-panel]')).toHaveCount(1)
      expect(await at(page)).toBe('button|Edit account|PANEL')
    })
  }

  /* Tab off the end closes and comes back to the trigger rather than cycling.
     A trap would satisfy "focus reaches the menu" and still strand anyone who
     does not know to press Escape, so the way out is the same key as the way in. */
  test('Tab past the last item closes it and returns to the trigger', async ({ page }) => {
    await openChart(page)
    await kebab(page).focus()
    await page.keyboard.press('Enter')
    const name = await kebab(page).getAttribute('aria-label')
    for (let i = 0; i < 12; i++) {
      await page.keyboard.press('Tab')
      if ((await page.locator('[data-menu-panel]').count()) === 0) break
    }
    await expect(page.locator('[data-menu-panel]')).toHaveCount(0)
    expect(await at(page)).toBe(`button|${name}|TABLE`)
  })

  test('Escape closes it and returns to the trigger', async ({ page }) => {
    await openChart(page)
    await kebab(page).focus()
    await page.keyboard.press('Enter')
    await expect(page.locator('[data-menu-panel]')).toHaveCount(1)
    await page.keyboard.press('Escape')
    await expect(page.locator('[data-menu-panel]')).toHaveCount(0)
    expect(await at(page)).toMatch(/^button\|Actions for /)
  })

  /* The status chip opens the same kind of panel and used to be a `<span>`: it
     took a click and no Tab stop at all, so changing a status was mouse-only. */
  test('the status chip is a control, and opens on Enter', async ({ page }) => {
    await openChart(page)
    const chip = page.locator('table tbody button[aria-label^="Status:"]').first()
    await chip.focus()
    await page.keyboard.press('Enter')
    await expect(page.locator('[data-menu-panel]')).toHaveCount(1)
    expect(await at(page)).toContain('PANEL')
  })
})

/* A menu opened inside a modal has to answer Escape by itself. Both used to
   listen on the document independently, so one press closed the picker and the
   half-filled journal entry behind it together. */
test('Escape in a modal closes the picker first, the modal second', async ({ page }) => {
  await page.goto('/general-ledger', { waitUntil: 'networkidle' })
  await page.getByRole('button', { name: 'New journal entry' }).first().click()
  const modal = page.locator('body > div.fixed').filter({ hasText: 'New journal entry' }).last()
  await modal.getByText('Journal lines').first().waitFor()

  await modal.locator('table button[aria-haspopup="listbox"]').first().click()
  await expect(page.getByRole('listbox')).toHaveCount(1)
  await page.keyboard.press('Escape')
  await expect(page.getByRole('listbox')).toHaveCount(0)
  await expect(modal).toHaveCount(1)

  await page.keyboard.press('Escape')
  await expect(modal).toHaveCount(0)
})

/* Expanding changes what comes next in the order, which is the one thing a tree
   does that a flat table does not. Children are rendered between their parent and
   the parent's next sibling, so Tab walks into the branch it just opened. */
test('an opened branch is walked into, and a closed one is stepped over', async ({ page }) => {
  await openChart(page)
  const first = firstToggle(page)
  await first.focus()
  await page.keyboard.press('Enter')                       // close it
  await expect(first).toHaveAttribute('aria-label', 'Expand')
  const closed = await tabTrail(page, 5)

  await first.focus()
  await page.keyboard.press('Enter')                       // open it again
  await expect(first).toHaveAttribute('aria-label', 'Collapse')
  const opened = await tabTrail(page, 5)

  // The same name and actions finish the row either way - only the toggle's own
  // label differs. What changes is where Tab goes after them: the next top-level
  // row when the branch is closed, its first child when it is open.
  expect(closed.slice(1, 3)).toEqual(opened.slice(1, 3))
  expect(closed[3]).not.toEqual(opened[3])
  expect(opened[3]).toMatch(/^input\|Select /)
})

/* The other two nested tables. They carry different controls - the ledger tree has
   no checkbox and the wizard's preview has no status chip - so this asks the one
   thing that has to hold for all three: every stop is a real control, and the walk
   never falls out of the page. */
for (const [name, url] of [['general ledger', '/general-ledger'], ['import preview', '/chart-of-accounts/setup']] as const) {
  test(`${name}: every stop is a control and focus is never dropped`, async ({ page }) => {
    await page.goto(url, { waitUntil: 'networkidle' })
    await page.locator('table button[aria-label="Expand"], table button[aria-label="Collapse"]').first().waitFor()
    await page.locator('table button[aria-label="Expand"], table button[aria-label="Collapse"]').first().focus()
    for (let i = 0; i < 40; i++) {
      const el = await page.evaluate(() => {
        const a = document.activeElement as HTMLElement
        if (!a || a === document.body) return 'NOTHING'
        return a.closest('table') ? a.tagName.toLowerCase() : 'off-table'
      })
      expect(el).not.toBe('NOTHING')
      expect(['button', 'input', 'off-table']).toContain(el)
      await page.keyboard.press('Tab')
    }
  })
}
