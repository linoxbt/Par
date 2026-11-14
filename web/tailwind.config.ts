import type { Config } from "tailwindcss"

// Light infrastructure system: off-white canvas, white surfaces, hairline borders,
// Geist + Geist Mono, black primary actions, Bitcoin orange as the single accent.
export default {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        canvas: "#FAFAFA",
        soft: "#F4F4F5",
        line: { DEFAULT: "#E8E8EB", strong: "#D6D6DB" },
        fg: "#0A0A0B",
        muted: "#6B6E76",
        subtle: "#9B9EA6",
        btc: { DEFAULT: "#F7931A", ink: "#C2650A", wash: "#FFF4E6", line: "#FBD9AE" },
        ok: { DEFAULT: "#15803D", wash: "#ECFDF3" },
        warn: { DEFAULT: "#B45309", wash: "#FFFBEB" },
        bad: { DEFAULT: "#DC2626", wash: "#FEF2F2" },
      },
      fontFamily: {
        sans: ['"Geist Variable"', "Geist", "system-ui", "sans-serif"],
        mono: ['"Geist Mono Variable"', "Geist Mono", "ui-monospace", "monospace"],
      },
      boxShadow: {
        card: "0 1px 2px rgba(10,10,11,0.04), 0 1px 1px rgba(10,10,11,0.02)",
        float: "0 12px 32px -12px rgba(10,10,11,0.18), 0 2px 6px rgba(10,10,11,0.05)",
      },
      keyframes: {
        rise: { from: { opacity: "0", transform: "translateY(6px)" }, to: { opacity: "1", transform: "translateY(0)" } },
        pulseDot: { "0%,100%": { opacity: "1" }, "50%": { opacity: "0.35" } },
      },
      animation: { rise: "rise .5s ease-out both", pulseDot: "pulseDot 1.6s ease-in-out infinite" },
    },
  },
  plugins: [],
} satisfies Config
