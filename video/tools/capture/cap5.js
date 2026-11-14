const { chromium, BASE, wallet, shot, travel, rpc } = require('./cap-lib')
const ME = '0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65'
const LANDLORD = '0x9965507D1a55bcC2695C58ba16FB37d819B0A4dc'
const TENANT = '0x976EA74026E726554dB657fA54763abd0C3a0aa9'
const ANYONE = '0x14dC79964da2C08b23698B3D3cc7Ca32193d9955'
const step = async (p, label) => { try { await p.getByRole('button', { name: label }).first().click({ timeout: 15000 }) } catch (e) { console.log('click fail', label, e.message.slice(0, 80)) } }
;(async () => {
  const b = await chromium.launch()
  const CERT = '/c/0xa8CB3Fa9110c3d9104DAC4B720928352F6a373dC/1'
  // fresh certificate: phone + desktop
  const m = await wallet(b, null, { mobile: true }); const pm = await m.newPage()
  await pm.goto(BASE + CERT, { waitUntil: 'networkidle' }); await shot(pm, '50-cert-phone', { wait: 5000 })
  await pm.evaluate(() => window.scrollTo(0, 650)); await shot(pm, '50c-cert-phone-scroll', { wait: 1500 })
  const d = await wallet(b, ANYONE); const pd = await d.newPage()
  await pd.goto(BASE + CERT, { waitUntil: 'networkidle' }); await shot(pd, '51-cert-desktop', { wait: 5000 })
  await pd.evaluate(() => window.scrollTo(0, 650)); await shot(pd, '51b-cert-desktop-timeline', { wait: 1500 })
  // tenant pay page on phone
  const t = await wallet(b, TENANT, { mobile: true }); const pt = await t.newPage()
  await pt.goto(BASE + CERT.replace('/c/', '/pay/'), { waitUntil: 'networkidle' }); await shot(pt, '52-pay-phone', { wait: 6000 })
  // miss installment #1 only: first due = creation + 60 s, grace 10 s
  await travel(15)
  await pd.reload({ waitUntil: 'networkidle' }); await pd.waitForTimeout(6000)
  await pd.evaluate(() => window.scrollTo(0, 650)); await shot(pd, '53-cert-missed', { wait: 1500 })
  await step(pd, 'Trigger payout'); await pd.waitForTimeout(8000)
  await shot(pd, '53b-cert-triggered', { wait: 1000 })
  await pd.reload({ waitUntil: 'networkidle' }); await pd.waitForTimeout(6000)
  await shot(pd, '54-cert-paid-top', { wait: 800 })
  await pd.evaluate(() => window.scrollTo(0, 650)); await shot(pd, '55-cert-paid-timeline', { wait: 1500 })
  await pd.evaluate(() => window.scrollTo(0, 99999)); await shot(pd, '55b-cert-history', { wait: 1500 })
  await pm.reload({ waitUntil: 'networkidle' }); await pm.waitForTimeout(5000); await shot(pm, '56-cert-phone-paid', { wait: 500 })
  await b.close()
})()
