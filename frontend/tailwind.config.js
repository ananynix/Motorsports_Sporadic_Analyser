/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'Roboto Mono', 'Orbitron', 'sans-serif'],
      },
      colors: {
        f1: {
          dark: '#111111',
          card: '#1A1A1A',
          border: '#333333',
          red: '#E10600',
          cyan: '#00D2BE',
          yellow: '#FFF200',
          text: '#FFFFFF',
          muted: '#888888',
        }
      }
    },
  },
  plugins: [],
}
