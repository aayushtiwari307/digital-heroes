/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      boxShadow: {
        glow: '0 20px 70px rgba(15, 23, 42, 0.32)',
      },
    },
  },
  plugins: [],
};
