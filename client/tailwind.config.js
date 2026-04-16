/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Nunito', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
      colors: {
        navy: {
          900: '#0f1f4b',
          800: '#1a2d6b',
          700: '#1e3a8a',
        },
      },
    },
  },
  plugins: [],
}
