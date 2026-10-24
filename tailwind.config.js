/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx}",
    "./components/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'custom-gray': '#b7b4c7',
        'brand': '#00c6ff', // Tactiq brand color
        'tactiq-dark': '#1c172e',
        'tactiq-card': '#241f3a',
        'tactiq-purple': '#4d54ff',
        'tactiq-pink': '#ff3868',
        'indigo-600': '#4f46e5',
      },
      fontFamily: {
        sans: ['Figtree', 'sans-serif'],
        mono: ['Geist Mono', 'monospace'],
        display: ['Newsreader', 'serif'],
      },
    },
  },
  plugins: [],
}
