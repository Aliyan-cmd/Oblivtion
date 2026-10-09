import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./hooks/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ["'Inter'", "system-ui", "-apple-system", "sans-serif"],
        mono: ["'JetBrains Mono'", "ui-monospace", "monospace"],
      },
      colors: {
        // Oblivion palette — mirrors CSS custom properties
        oblivion: {
          bg:       "#0a0a0b",
          "bg-2":   "#111115",
          "bg-3":   "#18181f",
          surface:  "#1c1c24",
          "surface-2": "#232330",
          text:     "#f0f0f5",
          "text-2": "#9898a8",
          "text-3": "#5a5a6a",
          red:      "#ff4444",
          yellow:   "#ffd000",
          blue:     "#4488ff",
        },
      },
      keyframes: {
        "fade-up": {
          "0%":   { opacity: "0", transform: "translateY(12px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        "fade-in": {
          "0%":   { opacity: "0" },
          "100%": { opacity: "1" },
        },
        shimmer: {
          "0%":   { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition:  "200% 0" },
        },
        "pulse-ring": {
          "0%":   { boxShadow: "0 0 0 0 rgba(255,68,68,0.4)" },
          "70%":  { boxShadow: "0 0 0 8px rgba(255,68,68,0)" },
          "100%": { boxShadow: "0 0 0 0 rgba(255,68,68,0)" },
        },
      },
      animation: {
        "fade-up":    "fade-up 0.45s cubic-bezier(0.16,1,0.3,1) both",
        "fade-in":    "fade-in 0.3s ease both",
        shimmer:      "shimmer 1.5s linear infinite",
        "pulse-ring": "pulse-ring 2s ease infinite",
        "spin-slow":  "spin 4s linear infinite",
      },
    },
  },
  plugins: [],
};

export default config;
