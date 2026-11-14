const { chromium, devices } = require('playwright')
const BASE = 'http://localhost:3160'
const RPC = 'http://127.0.0.1:8545'
const OUT = __dirname + '/vshots/'
async function wallet(browser, ADDR, opts = {}) {
  const ctx = await browser.newContext(opts.mobile ? { ...devices['iPhone 13'] } : { viewport: { width: 1600, height: 1000 }, deviceScaleFactor: 2 })
  await ctx.addInitScript(({ ADDR, RPC }) => {
    const listeners = {}
    const rpc = async (method, params) => {
      const r = await fetch(RPC, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }) })
      const j = await r.json(); if (j.error) { const e = new Error(j.error.message); e.code = j.error.code; e.data = j.error.data; throw e } return j.result
    }
    const provider = {
      isMetaMask: true,
      on: (e, f) => ((listeners[e] = listeners[e] || []).push(f)),
      removeListener: (e, f) => (listeners[e] = (listeners[e] || []).filter((x) => x !== f)),
      request: async ({ method, params }) => {
        if (method === 'eth_chainId') return '0x7b7b'
        if (method === 'net_version') return '31611'
        if (method === 'eth_accounts' || method === 'eth_requestAccounts') return ADDR ? [ADDR] : []
        if (method === 'wallet_switchEthereumChain' || method === 'wallet_addEthereumChain') return null
        if (method === 'wallet_requestPermissions' || method === 'wallet_getPermissions') return [{ parentCapability: 'eth_accounts' }]
        return rpc(method, params)
      },
    }
    window.ethereum = provider
    const info = { uuid: '11111111-1111-4111-8111-111111111111', name: 'MetaMask', icon: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg"/>', rdns: 'io.metamask' }
    const announce = () => window.dispatchEvent(new CustomEvent('eip6963:announceProvider', { detail: Object.freeze({ info, provider }) }))
    window.addEventListener('eip6963:requestProvider', announce); announce()
    if (ADDR) try {
      localStorage.setItem('wagmi.recentConnectorId', '"io.metamask"')
      localStorage.setItem('wagmi.io.metamask.connected', 'true')
      localStorage.setItem('wagmi.injected.connected', 'true')
    } catch {}
  }, { ADDR, RPC })
  return ctx
}
async function rpc(method, params = []) {
  const r = await fetch(RPC, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }) })
  return (await r.json()).result
}
async function travel(sec) { await rpc('evm_increaseTime', [sec]); await rpc('evm_mine') }
async function shot(page, name, opts = {}) { await page.waitForTimeout(opts.wait ?? 1200); await page.screenshot({ path: OUT + name + '.png', fullPage: !!opts.full }); console.log('shot', name) }
module.exports = { chromium, BASE, wallet, shot, travel, rpc }
