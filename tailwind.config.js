/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        injective: {
          dark: "#0B0C10",
          card: "#151720",
          accent: "#00D2FF",
          accent2: "#7B61FF",
        },
      },
    },
  },
  plugins: [],
};
