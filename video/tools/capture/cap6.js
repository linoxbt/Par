const { chromium } = require('playwright')
;(async () => {
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1600, height: 1000 }, deviceScaleFactor: 2 })
  await p.goto('https://explorer.test.mezo.org/address/0xE0035DeD7dE078840BF63D3820A7ae9315654c79?tab=contract', { waitUntil: 'domcontentloaded', timeout: 60000 })
  await p.waitForTimeout(12000)
  await p.screenshot({ path: __dirname + '/vshots/60-explorer-verified.png' })
  console.log((await p.evaluate(() => document.body.innerText)).replace(/\s+/g, ' ').slice(0, 300))
  await b.close()
})()
