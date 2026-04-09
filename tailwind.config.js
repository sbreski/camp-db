/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      fontFamily: {
        display: ['Outfit', 'sans-serif'],
        body: ['DM Sans', 'sans-serif'],
      },
      colors: {
        forest: {
          50: '#f0faf4',
          100: '#d9f2e3',
          200: '#b2e4c7',
          300: '#7acfa3',
          400: '#41b47c',
          500: '#1e9460',
          600: '#137549',
          700: '#105e3b',
          800: '#0e4b30',
          900: '#1a3a2a',
          950: '#0a1f16',
        },
        amber: {
          400: '#fbbf24',
          500: '#f59e0b',
          600: '#d97706',
        }
      }
    },
  },
  plugins: [],
}
