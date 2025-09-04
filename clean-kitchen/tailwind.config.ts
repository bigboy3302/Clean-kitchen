import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          50:  "#f5f7ff",
          100: "#ebeffe",
          200: "#d8ddfd",
          300: "#bcc5fb",
          400: "#97a4f6",
          500: "#6e7ef0",   // primārā
          600: "#515fe3",
          700: "#424dc5",
          800: "#373fa0",
          900: "#30377f",
        },
      },
      boxShadow: {
        soft: "0 10px 30px -15px rgba(0,0,0,0.15)",
        ring: "0 0 0 4px rgba(110,126,240,0.15)",
      },
      borderRadius: {
        xl: "1rem",
        "2xl": "1.25rem",
      },
      backdropBlur: {
        xs: "2px",
      },
    },
  },
  plugins: [],
};
export default config;
