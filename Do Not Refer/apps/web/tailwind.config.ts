import type { Config } from "tailwindcss";

// Shared design tokens for all 5 role dashboards — see docs/design-system.md.
// Don't introduce new one-off colors in a module; extend this file instead
// so Employee/Manager/Accounts/Admin/Reports stay visually consistent.
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#eef2f7",
          100: "#d9e2ec",
          200: "#bcccdc",
          300: "#9fb3c8",
          400: "#829ab1",
          500: "#627d98",
          600: "#486581",
          700: "#334e68",
          800: "#243b53",
          900: "#102a43",
        },
        status: {
          pending: "#b45309", // amber-700 — enough contrast on white for text
          approved: "#047857", // emerald-700
          rejected: "#b91c1c", // red-700
          returned: "#c2410c", // orange-700
          paid: "#1d4ed8", // blue-700
        },
      },
      fontFamily: {
        sans: ["Inter", "ui-sans-serif", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
} satisfies Config;
