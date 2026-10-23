/** @type {import('tailwindcss').Config} */
// Colors here are references only — the actual values live in src/index.css
// (THEME TOKENS). Change a client's branding there, not here.
const scale = name => Object.fromEntries([50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950].map(n => [n, `rgb(var(--${name}-${n}) / <alpha-value>)`]));

export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: { ...scale("brand"), DEFAULT: "rgb(var(--brand-600) / <alpha-value>)", fg: "rgb(var(--brand-fg) / <alpha-value>)" },
        danger: { ...scale("danger"), DEFAULT: "rgb(var(--danger-600) / <alpha-value>)" },
        surface: "rgb(var(--surface-rgb) / <alpha-value>)",
        "surface-2": "rgb(var(--surface-2-rgb) / <alpha-value>)",
        ink: "rgb(var(--ink-rgb) / <alpha-value>)",
        "ink-soft": "rgb(var(--ink-soft-rgb) / <alpha-value>)",
        edge: "rgb(var(--edge-rgb) / <alpha-value>)",
      },
    },
  },
  plugins: [],
}
