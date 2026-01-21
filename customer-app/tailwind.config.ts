import type { Config } from 'tailwindcss'

export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          teal: '#5BBFBA',
          'teal-dark': '#4AA9A4',
          navy: '#1B365D',
          cream: '#FDF8F3',
          'warm-white': '#F8F6F3',
        },
      },
      fontFamily: {
        heading: ['Playfair Display', 'Georgia', 'serif'],
        body: ['Open Sans', 'sans-serif'],
      },
    },
  },
  plugins: [],
} satisfies Config
