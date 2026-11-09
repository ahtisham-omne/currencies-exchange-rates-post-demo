import puppeteer from 'puppeteer-core'
import { execSync } from 'node:child_process'

const OUT = '/sessions/nice-jolly-euler/mnt/outputs'
const URL = 'http://localhost:4173/'
const sleep = ms => new Promise(r => setTimeout(r, ms))
const EXE = execSync("find /tmp/cr -type f -name chrome-headless-shell 2>/dev/null | head -1").toString().trim()

const browser = await puppeteer.launch({
  executablePath: EXE,
  headless: true,
  args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu'],
  defaultViewport: { width: 1440, height: 1000 },
})
const page = await browser.newPage()
await page.goto(URL, { waitUntil: 'networkidle2', timeout: 30000 })
await sleep(1500)
console.log('TITLE:', await page.title(), '| URL:', page.url())
await page.screenshot({ path: `${OUT}/shot_listing.png` })

const texts = await page.evaluate(() =>
  [...document.querySelectorAll('button, a')].map(e => (e.innerText || '').trim()).filter(Boolean).slice(0, 80))
console.log('CONTROLS:', JSON.stringify(texts))

const clicked = await page.evaluate(() => {
  const all = [...document.querySelectorAll('button, a')]
  const el = all.find(e => /create account|new account|add account/i.test((e.innerText || '').trim()))
    || all.find(e => /^create$|^add account$|^new$/i.test((e.innerText || '').trim()))
    || all.find(e => /create|add/i.test((e.innerText || '').trim()))
  if (el) { el.click(); return (el.innerText || '').trim() }
  return null
})
console.log('CLICKED:', clicked)
await sleep(2000)
await page.screenshot({ path: `${OUT}/shot_create_step1.png` })
await browser.close()
console.log('DONE EXE=' + EXE)
