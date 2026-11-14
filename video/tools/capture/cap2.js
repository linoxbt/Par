const { chromium, BASE, wallet, shot, travel } = require('./cap-lib')
const ME = '0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65'
const LANDLORD = '0x9965507D1a55bcC2695C58ba16FB37d819B0A4dc'
const TENANT = '0x976EA74026E726554dB657fA54763abd0C3a0aa9'
const step = async (p, label) => { try { await p.getByRole('button', { name: label }).first().click({ timeout: 15000 }) } catch (e) { console.log('click fail', label, e.message.slice(0, 80)) } }
;(async () => {
  const b = await chromium.launch()
  const ctx = await wallet(b, ME)
  const p = await ctx.newPage()
  p.on('pageerror', (e) => console.log('pageerror', e.message.slice(0, 120)))
  await p.goto(BASE + '/vault', { waitUntil: 'networkidle' }); await shot(p, '10-vault-create', { wait: 5000 })
  await step(p, 'Create vault'); await p.waitForTimeout(6000)
  await shot(p, '11-vault-open-trove', { wait: 3000 })
  // set BTC to 0.25
  const amt = p.locator('input[inputmode="decimal"]').first(); await amt.fill('0.25'); await shot(p, '12-vault-open-preview', { wait: 1500 })
  await step(p, 'Open trove'); await p.waitForTimeout(7000)
  await shot(p, '13-vault-dashboard', { wait: 4000 })
  await shot(p, '13b-vault-dashboard-full', { full: true, wait: 500 })
  // guarantee builder
  await p.goto(BASE + '/vault/new-guarantee', { waitUntil: 'networkidle' }); await p.waitForTimeout(5000)
  await shot(p, '20-builder-empty')
  const inputs = p.locator('main input')
  await inputs.nth(0).fill(LANDLORD); await inputs.nth(1).fill(TENANT)
  await inputs.nth(2).fill('500'); await inputs.nth(3).fill('3')
  await step(p, 'Demo · 2 min')
  await inputs.nth(4).fill('1500')
  await shot(p, '21-builder-filled', { wait: 3500 })
  await step(p, 'Make the promise'); await p.waitForTimeout(8000)
  await shot(p, '22-builder-done', { wait: 2000 })
  const href = await p.locator('a', { hasText: 'Open certificate' }).getAttribute('href').catch(() => null)
  console.log('CERT', href)
  require('fs').writeFileSync(__dirname + '/vshots/cert.txt', href || '')
  await b.close()
})()
