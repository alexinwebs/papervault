import type { Config } from "tailwindcss";

/** PaperVault design tokens - single source of truth. */
const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        cream: "#FFF8E8",
        paper: "#FFFDF6",
        navy: "#00002A",
        "blue-deep": "#1A3F5F",
        "blue-light": "#9DD6F3",
        "blue-soft": "#CFE9FA",
        mint: "#B7DEC8",
        yellow: "#FFD447",
        pink: "#F2B6C6",
        lavender: "#C8B6E8",
        ink: "#00002A",
      },
      fontFamily: {
        mono: ["var(--font-display)", "Space Mono", "IBM Plex Mono", "monospace"],
        sans: ["var(--font-ui)", "Inter", "system-ui", "sans-serif"],
      },
      borderRadius: { none: "0", sm: "2px", DEFAULT: "4px", md: "6px", lg: "8px" },
      boxShadow: {
        hard: "4px 4px 0 0 #00002A",
        "hard-sm": "2px 2px 0 0 #00002A",
        "hard-lg": "6px 6px 0 0 #00002A",
      },
      borderWidth: { DEFAULT: "1px", 2: "2px", 3: "3px" },
    },
  },
  plugins: [],
};
export default config;
