/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./**/*.{html,js}"],
  theme: {
    extend: {
      colors: {
        // Enhanced Dark theme with more depth
        dark: {
          950: '#080810', // Deepest background
          900: '#0A0A12', // Background
          800: '#121220', // Cards, containers
          700: '#1E1E2D', // Input fields
          600: '#2D2D40', // Borders, dividers
          500: '#3E3E52', // Secondary buttons
          400: '#5C5C75', // Disabled text
          300: '#8E8EA3', // Secondary text
          200: '#AEAEC0', // Primary text (muted)
          100: '#E2E2EF', // Primary text (bright)
        },
        // Enhanced Purple accent with more vibrancy
        purple: {
          950: '#2D1178', // Darkest purple
          900: '#3A1596', // Very dark purple
          800: '#4A1DB6', // Dark purple
          700: '#5B25D9', // Deep purple
          600: '#6D2EED', // Main purple
          500: '#7C3AED', // Bright purple (primary)
          400: '#8B5CF6', // Light purple
          300: '#A78BFA', // Lighter purple
          200: '#C4B5FD', // Very light purple
          100: '#EDE9FE', // Almost white purple
        },
      },
      fontFamily: {
        sans: ['Inter var', 'sans-serif'],
      },
      boxShadow: {
        'purple-sm': '0 2px 8px 0 rgba(124, 58, 237, 0.2)',
        'purple': '0 4px 14px 0 rgba(124, 58, 237, 0.25)',
        'purple-lg': '0 8px 20px 0 rgba(124, 58, 237, 0.3)',
        'inner-dark': 'inset 0 2px 4px 0 rgba(0, 0, 0, 0.1)',
        'glass': '0 8px 32px 0 rgba(0, 0, 0, 0.2)',
      },
      keyframes: {
        'message-pop-in': {
          '0%': { 
            opacity: '0',
            transform: 'translateY(20px) scale(0.8)'
          },
          '70%': { 
            transform: 'translateY(-5px) scale(1.05)'
          },
          '100%': { 
            opacity: '1',
            transform: 'translateY(0) scale(1)'
          }
        },
        'fade-up': {
          '0%': {
            opacity: '0',
            transform: 'translateY(10px)'
          },
          '100%': {
            opacity: '1',
            transform: 'translateY(0)'
          }
        },
        'slide-in': {
          '0%': {
            transform: 'translateX(-100%)'
          },
          '100%': {
            transform: 'translateX(0)'
          }
        },
        'pulse-subtle': {
          '0%, 100%': {
            opacity: '1'
          },
          '50%': {
            opacity: '0.8'
          }
        }
      },
      animation: {
        'message-pop-in': 'message-pop-in 0.4s ease-out forwards',
        'fade-up': 'fade-up 0.3s ease-out forwards',
        'slide-in': 'slide-in 0.4s ease-out forwards',
        'pulse-subtle': 'pulse-subtle 2s ease-in-out infinite'
      },
      backgroundImage: {
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
        'gradient-conic': 'conic-gradient(var(--tw-gradient-stops))',
        'gradient-glass': 'linear-gradient(rgba(255, 255, 255, 0.05), rgba(255, 255, 255, 0.02))',
      }
    },
  },
  plugins: [],
} 