/** @type {import('tailwindcss').Config} */
export default {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        navy: {
          DEFAULT: "#0a1e3f",
          dark: "#0f2a54",
        },
      },
    },
  },
  plugins: [],
};
