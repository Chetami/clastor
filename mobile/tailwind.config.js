const path = require("path");

/** @type {import('tailwindcss').Config} */
module.exports = {
  // Scan every screen + component for class names. The monorepo root is the
  // base so paths resolve cleanly.
  content: [
    "./app/**/*.{ts,tsx}",
    "./src/**/*.{ts,tsx}",
  ],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        // Mirror the web app's brand palette so screens feel consistent.
        brand: {
          DEFAULT: "#4f46e5",
          dark: "#4338ca",
          light: "#6366f1",
        },
      },
    },
  },
  plugins: [],
};
