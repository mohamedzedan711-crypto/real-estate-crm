/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        navy: {
          50:  '#e8edf5',
          100: '#c5d0e6',
          200: '#9eb0d5',
          300: '#7790c4',
          400: '#5a78b8',
          500: '#3d60ac',
          600: '#2d508a',
          700: '#1f3d6e',
          800: '#1a3560',
          900: '#0f1f3d',
          950: '#080f1e',
        },
        gold: {
          50:  '#fdf8e7',
          100: '#faefc3',
          200: '#f7e49b',
          300: '#f3d872',
          400: '#f0ce53',
          500: '#d4a017',
          600: '#b8870f',
          700: '#9a6e0a',
          800: '#7c5507',
          900: '#5e3e04',
        },
      },
      fontFamily: {
        sans: ['Cairo', 'Inter', 'system-ui', 'sans-serif'],
        arabic: ['Cairo', 'Tajawal', 'sans-serif'],
      },
      animation: {
        'fade-in': 'fadeIn 0.3s ease-in-out',
        'slide-in': 'slideIn 0.3s ease-in-out',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideIn: {
          '0%': { transform: 'translateX(-10px)', opacity: '0' },
          '100%': { transform: 'translateX(0)', opacity: '1' },
        },
      },
    },
  },
  plugins: [],
}
