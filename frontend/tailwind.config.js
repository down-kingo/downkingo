/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        // Clinical Neon Light Theme
        primary: {
          50: "#FFF1F3",
          100: "#FFE4E8",
          200: "#FECDD6",
          300: "#FDA4B4",
          400: "#FB7189",
          500: "#F43F5E",
          600: "#E11D48", // Main accent
          700: "#BE123C",
          800: "#9F1239",
          900: "#881337",
        },
        surface: {
          50: "#FAFAFA",
          100: "#F4F4F5",
          200: "#E4E4E7",
          300: "#D4D4D8",
          400: "#A1A1AA",
          500: "#71717A",
          600: "#52525B", // Secondary text (accessible)
          700: "#3F3F46",
          800: "#27272A",
          900: "#18181B",
        },
      },
      fontFamily: {
        display: ["Outfit", "sans-serif"],
        sans: ["Inter", "system-ui", "sans-serif"],
      },
      boxShadow: {
        soft: "0 4px 24px rgba(0, 0, 0, 0.06)",
        medium: "0 8px 32px rgba(0, 0, 0, 0.08)",
        glow: "0 0 24px rgba(225, 29, 72, 0.25)",
        "glow-lg": "0 0 48px rgba(225, 29, 72, 0.35)",
      },
      animation: {
        "pulse-slow": "pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite",
        glow: "glow 2s ease-in-out infinite alternate",
      },
      keyframes: {
        glow: {
          "0%": { boxShadow: "0 0 20px rgba(225, 29, 72, 0.2)" },
          "100%": { boxShadow: "0 0 30px rgba(225, 29, 72, 0.4)" },
        },
      },
    },
  },
  plugins: [],
};
