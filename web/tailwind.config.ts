import type { Config } from "tailwindcss"

// Design system adapted from the Aurelo Saving direction: deep navy, one metal accent
// (Bitcoin orange instead of gold), warm paper sections, serif display + mono data.
export default {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        btc: { DEFAULT: "#F7931A", soft: "#FFB55C", dim: "#B86A0C", wash: "#F7931A14" },
        // navy scale (kept under the `ink` name so every page picks it up)
        ink: {
          950: "#070D1B",
          900: "#0B1427",
          800: "#101C35",
          700: "#1B2A4A",
          600: "#2A3B60",
          400: "#8592AD",
          300: "#B4BDD0",
        },
        paper: { DEFAULT: "#F6F1E7", 2: "#EFE7D6", line: "#E1D6BF", ink: "#0B1427", mute: "#5D6884" },
        ok: "#3FBF7F",
        warn: "#E8B23A",
        bad: "#E5484D",
      },
      fontFamily: {
        serif: ['"Instrument Serif"', "Georgia", "serif"],
        sans: ['"Urbanist Variable"', "Urbanist", "system-ui", "sans-serif"],
        mono: ['"JetBrains Mono Variable"', "JetBrains Mono", "ui-monospace", "monospace"],
      },
      keyframes: {
        ticker: { from: { transform: "translateX(0)" }, to: { transform: "translateX(-50%)" } },
      },
      animation: { ticker: "ticker 40s linear infinite" },
    },
  },
  plugins: [],
} satisfies Config
