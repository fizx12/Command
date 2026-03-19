/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/renderer/**/*.{tsx,ts}",
    "./src/renderer/index.html"
  ],
  theme: {
    extend: {
      colors: {
        'badge-green': '#22c55e',
        'badge-yellow': '#eab308',
        'badge-red': '#ef4444',
        surface: '#1e1e2e',
        'surface-alt': '#2a2a3e',
        'text-primary': '#e0e0e0',
        'text-secondary': '#a0a0a0',
        accent: '#7c3aed',
      }
    },
  },
  plugins: [],
}
