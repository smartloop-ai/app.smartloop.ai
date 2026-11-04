import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  important: "#app",
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        // Semantic theme tokens (driven by CSS variables, switch with .dark)
        bg: "var(--bg)",
        surface: "var(--surface)",
        "surface-2": "var(--surface-2)",
        border: "var(--border)",
        "border-2": "var(--border-2)",
        content: "var(--content)",
        muted: "var(--muted)",
        faint: "var(--faint)",
        accent: "var(--accent)",
        "accent-strong": "var(--accent-strong)",
        "accent-text": "var(--accent-text)",
        "accent-soft": "var(--accent-soft)",
        "accent-border": "var(--accent-border)",
        // Status tokens — tuned per theme, see globals.css
        ok: "var(--ok-text)",
        "ok-soft": "var(--ok-soft)",
        "ok-border": "var(--ok-border)",
        warn: "var(--warn-text)",
        "warn-soft": "var(--warn-soft)",
        "warn-border": "var(--warn-border)",
        danger: "var(--danger-text)",
        "danger-soft": "var(--danger-soft)",
        "danger-border": "var(--danger-border)",
        "chart-grid": "var(--chart-grid)",
        "chart-empty": "var(--chart-empty)",
      },
      backgroundImage: {
        "gradient-radial": "radial-gradient(var(--tw-gradient-stops))",
        "gradient-conic":
          "conic-gradient(from 180deg at 50% 50%, var(--tw-gradient-stops))",
      },
    },
  },
  plugins: [],
};
export default config;
