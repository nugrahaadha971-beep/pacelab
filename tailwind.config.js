/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        navy: { 900: '#0b1220', 800: '#131c2e', 700: '#1d2a40' },
        coral: '#ff6b5e',
      },
    },
  },
  plugins: [],
};
