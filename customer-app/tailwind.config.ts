import type { Config } from 'tailwindcss'

export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        brand: {
          // Primary - Terracotta
          primary: '#C2704E',
          'primary-light': '#D4896B',
          'primary-dark': '#A85D3E',
          // Secondary - Sage Green
          sage: '#8BA888',
          'sage-light': '#A3BDA0',
          'sage-dark': '#6F8E6C',
          // Surfaces
          cream: '#FAF6F1',
          'warm-white': '#FFF8F2',
          sand: '#F0E8DE',
          // Accents
          amber: '#D4A843',
          'amber-light': '#E4C06A',
          'amber-dark': '#B8912E',
          // Text
          forest: '#2C3E2D',
          'forest-light': '#4A5E4B',
          'forest-muted': '#6B7D6C',
          // Status
          success: '#7FB685',
          warning: '#D4A843',
          error: '#C2584E',
          info: '#8BA888',
          // Dark mode surfaces
          'dark-bg': '#1A2A1B',
          'dark-surface': '#243226',
          'dark-elevated': '#2E3F30',
          'dark-border': '#3D5240',
          // Legacy compat (keep for gradual migration)
          blue: '#C2704E',
          'blue-dark': '#A85D3E',
          navy: '#2C3E2D',
          coral: '#C2584E',
          'golden-yellow': '#D4A843',
          'soft-green': '#8BA888',
          'light-gray': '#E8E0D6',
          'soft-cream': '#FAF6F1',
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
        'warm-sm': '0 1px 3px rgba(44, 62, 45, 0.08)',
        'warm': '0 2px 8px rgba(44, 62, 45, 0.1)',
        'warm-lg': '0 8px 24px rgba(44, 62, 45, 0.12)',
        'warm-xl': '0 16px 48px rgba(44, 62, 45, 0.15)',
        'glow': '0 0 20px rgba(194, 112, 78, 0.15)',
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
          '0%, 100%': { boxShadow: '0 0 0 0 rgba(194, 112, 78, 0)' },
          '50%': { boxShadow: '0 0 0 8px rgba(194, 112, 78, 0.1)' },
        },
      },
    },
  },
  plugins: [],
} satisfies Config
