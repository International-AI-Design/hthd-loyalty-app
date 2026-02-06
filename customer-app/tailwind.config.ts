import type { Config } from 'tailwindcss'

export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          teal: '#62A2C3',
          'teal-dark': '#4F8BA8',
          navy: '#1B365D',
          cream: '#FDF8F3',
          'warm-white': '#F8F6F3',
          coral: '#E8837B',
          'golden-yellow': '#F5C65D',
          'soft-green': '#7FB685',
          'light-gray': '#E8E8E8',
          'soft-cream': '#FDF8F3',
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
