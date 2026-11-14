import type { Config } from "tailwindcss"

export default {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        btc: { DEFAULT: "#F7931A", dim: "#b86a0c" },
        ink: { 950: "#0b0c0f", 900: "#111318", 800: "#171a21", 700: "#20242d", 600: "#2c313c", 400: "#7b8394", 300: "#a3aab8" },
        ok: "#22c55e",
        warn: "#eab308",
        bad: "#ef4444",
      },
      fontFamily: {
        mono: ["ui-monospace", "SFMono-Regular", "JetBrains Mono", "Menlo", "monospace"],
      },
    },
  },
  plugins: [],
} satisfies Config
