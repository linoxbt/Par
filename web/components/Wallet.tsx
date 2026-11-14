"use client"

import dynamic from "next/dynamic"

/** Reown AppKit and Mezo Passport touch `document` on import, so the wallet button is client-only. */
export const WalletButton = dynamic(() => import("./WalletImpl").then((m) => m.WalletButton), {
  ssr: false,
  loading: () => <span className="inline-block h-9 w-[84px] animate-pulse rounded-full bg-soft" />,
})
