/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  darkMode: "media",
  theme: {
    extend: {
      colors: {
        surface: {
          DEFAULT: "#fcfcfb",
          dark: "#1a1a19",
          page: "#f9f9f7",
          "page-dark": "#0d0d0d",
        },
        ink: {
          primary: "#0b0b0b",
          "primary-dark": "#ffffff",
          secondary: "#52514e",
          "secondary-dark": "#c3c2b7",
          muted: "#898781",
        },
        line: {
          hairline: "#e1e0d9",
          "hairline-dark": "#2c2c2a",
          baseline: "#c3c2b7",
          "baseline-dark": "#383835",
        },
        brand: {
          DEFAULT: "#2a78d6",
          dark: "#3987e5",
        },
        good: "#0ca30c",
        warning: "#fab219",
        serious: "#ec835a",
        critical: "#d03b3b",
      },
      fontFamily: {
        sans: ["system-ui", "-apple-system", "Segoe UI", "sans-serif"],
      },
    },
  },
  plugins: [],
};
