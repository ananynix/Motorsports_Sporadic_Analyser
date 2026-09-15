/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Titillium Web"', 'Inter', 'Roboto Mono', 'Orbitron', 'sans-serif'],
        display: ['"Titillium Web"', 'sans-serif'],
      },
      colors: {
        f1: {
          dark: '#111111',
          card: '#1A1A1A',
          border: '#333333',
          red: '#E10600',
          redDark: '#a80500',
          cyan: '#00D2BE',
          yellow: '#FFF200',
          orange: '#FF8C00',
          green: '#2ECC71',
          text: '#FFFFFF',
          muted: '#888888',
        }
      },
      backgroundImage: {
        'carbon': 'repeating-linear-gradient(135deg, rgba(255,255,255,0.02) 0px, rgba(255,255,255,0.02) 1px, transparent 1px, transparent 6px)',
      }
    },
  },
  plugins: [],
}
