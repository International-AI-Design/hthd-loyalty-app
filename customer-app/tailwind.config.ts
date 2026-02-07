import type { Config } from 'tailwindcss'

export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        brand: {
          // Primary - Brand Blue (matches happytailhappydog.com)
          primary: '#62A2C3',
          'primary-light': '#7BB8D4',
          'primary-dark': '#4E8BA8',
          // Secondary - Soft Green
          sage: '#7FB685',
          'sage-light': '#9BC89F',
          'sage-dark': '#5EA065',
          // Surfaces
          cream: '#F8F6F3',
          'warm-white': '#FDF8F3',
          sand: '#E8E8E8',
          // Accents
          amber: '#F5C65D',
          'amber-light': '#F7D47D',
          'amber-dark': '#D4A843',
          // Text
          forest: '#1B365D',
          'forest-light': '#3A5578',
          'forest-muted': '#6B7D8C',
          // Status
          success: '#7FB685',
          warning: '#F5C65D',
          error: '#E8837B',
          info: '#62A2C3',
          // Dark mode surfaces
          'dark-bg': '#0D1B2A',
          'dark-surface': '#1B2B3D',
          'dark-elevated': '#253A50',
          'dark-border': '#3A5578',
          // Legacy compat
          blue: '#62A2C3',
          'blue-dark': '#4E8BA8',
          navy: '#1B365D',
          coral: '#E8837B',
          'golden-yellow': '#F5C65D',
          'soft-green': '#7FB685',
          'light-gray': '#E8E8E8',
          'soft-cream': '#FDF8F3',
        },
      },
      fontFamily: {
        heading: ['Fraunces', 'Georgia', 'serif'],
        body: ['Plus Jakarta Sans', 'system-ui', 'sans-serif'],
        pet: ['Quicksand', 'sans-serif'],
      },
      borderRadius: {
        '2xl': '1rem',
        '3xl': '1.5rem',
        '4xl': '2rem',
      },
      boxShadow: {
        'warm-sm': '0 1px 3px rgba(27, 54, 93, 0.08)',
        'warm': '0 2px 8px rgba(27, 54, 93, 0.1)',
        'warm-lg': '0 8px 24px rgba(27, 54, 93, 0.12)',
        'warm-xl': '0 16px 48px rgba(27, 54, 93, 0.15)',
        'glow': '0 0 20px rgba(98, 162, 195, 0.15)',
      },
      animation: {
        'fade-in': 'fadeIn 0.3s ease-out',
        'slide-up': 'slideUp 0.4s ease-out',
        'slide-down': 'slideDown 0.3s ease-out',
        'scale-in': 'scaleIn 0.2s ease-out',
        'pulse-warm': 'pulseWarm 2s ease-in-out infinite',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { transform: 'translateY(16px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        slideDown: {
          '0%': { transform: 'translateY(-16px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        scaleIn: {
          '0%': { transform: 'scale(0.95)', opacity: '0' },
          '100%': { transform: 'scale(1)', opacity: '1' },
        },
        pulseWarm: {
          '0%, 100%': { boxShadow: '0 0 0 0 rgba(98, 162, 195, 0)' },
          '50%': { boxShadow: '0 0 0 8px rgba(98, 162, 195, 0.1)' },
        },
      },
    },
  },
  plugins: [],
} satisfies Config
