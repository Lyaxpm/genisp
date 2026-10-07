import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#eef7fa",
          100: "#d7edf3",
          200: "#b0dbe7",
          300: "#7cc2d6",
          400: "#46a3c0",
          500: "#0d627c",
          600: "#0b5468",
          700: "#094455",
          800: "#083646",
          900: "#062a37",
          950: "#041c25",
        },
      },
      fontFamily: {
        sans: ["Inter", "ui-sans-serif", "system-ui", "sans-serif"],
      },
      boxShadow: {
        soft: "0 8px 30px rgba(13, 98, 124, 0.08)",
        card: "0 1px 3px rgba(16,24,40,.06), 0 1px 2px rgba(16,24,40,.04)",
      },
    },
  },
  plugins: [],
};

export default config;
