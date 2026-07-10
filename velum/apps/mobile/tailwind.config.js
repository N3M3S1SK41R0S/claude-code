/** @type {import('tailwindcss').Config} */
const { velumTailwindTheme } = require('@velum/ui/tailwind');

module.exports = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}', '../../packages/ui/src/**/*.{ts,tsx}'],
  presets: [require('nativewind/preset')],
  theme: {
    extend: velumTailwindTheme,
  },
  plugins: [],
};
