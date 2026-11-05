/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        guinea: {
          red: '#CE1126',
          yellow: '#FCD116',
          green: '#009460',
        },
        aotuc: {
          navy: '#0B1E36',
          slate: '#1E293B',
          light: '#F8FAFC',
          border: '#E2E8F0',
        }
      }
    },
  },
  plugins: [],
}
