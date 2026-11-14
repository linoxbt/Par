/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // orangekit (under Mezo Passport) imports TypeScript sources from orangekit-smart-account
  transpilePackages: ["@mezo-org/passport", "@mezo-org/orangekit", "@mezo-org/orangekit-smart-account", "@mezo-org/orangekit-contracts", "@mezo-org/mezo-clay", "@mezo-org/sign-in-with-wallet"],
  webpack: (config) => {
    // wagmi / WalletConnect optional deps that are not needed in the browser
    config.externals.push("pino-pretty", "lokijs", "encoding")
    config.resolve.fallback = { ...config.resolve.fallback, fs: false, net: false, tls: false }
    // Server-side Coinbase CDP SDK (x402 payments) is pulled in transitively by wagmi's Base Account
    // connector. Par never uses it, and its optional deps are not installed.
    config.resolve.alias = { ...config.resolve.alias, "@coinbase/cdp-sdk": false }
    return config
  },
}
export default nextConfig
