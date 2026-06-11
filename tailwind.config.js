/* eslint-disable no-undef */
/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // VERITAS Parchment Design System
        "bg":           "#F5F2E9",
        "surface":      "#FDFCF8",
        "surface-2":    "#EFEBDF",
        "surface-3":    "#E7E2D2",
        "text":         "#1C1912",
        "soft":         "#524C3F",
        "muted":        "#8B8472",
        "evidence":     "#5E5747",
        "accent":       "#8E2A1B",
        "accent-deep":  "#6E2014",
        "verified":     "#1E6B45",
        "ai":           "#4F4380",
        "line":         "rgba(28,25,18,0.13)",
        "line-strong":  "rgba(28,25,18,0.26)",
      },
      fontFamily: {
        "display": ["Newsreader", "Georgia", "serif"],
        "ui":      ["Geist", "system-ui", "sans-serif"],
        "mono":    ["Geist Mono", "ui-monospace", "monospace"],
      },
      boxShadow: {
        "card":    "0 1px 0 rgba(28,25,18,0.04), 0 24px 48px -28px rgba(28,25,18,0.28)",
        "subtle":  "0 1px 3px rgba(28,25,18,0.08)",
        "lift":    "0 4px 16px rgba(28,25,18,0.12)",
      },
      animation: {
        "pulse-slow": "pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite",
        "breathe":    "breathe 2s ease-in-out infinite",
        "fade-in":    "fadeIn 0.3s ease",
        "slide-up":   "slideUp 0.4s ease",
      },
      keyframes: {
        breathe:  { "0%,100%": { opacity: "1" }, "50%": { opacity: "0.4" } },
        fadeIn:   { "from": { opacity: "0" }, "to": { opacity: "1" } },
        slideUp:  { "from": { opacity: "0", transform: "translateY(12px)" }, "to": { opacity: "1", transform: "translateY(0)" } },
      },
    },
  },
  plugins: [
    require('@tailwindcss/forms'),
  ],
}
