/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./**/*.{html,js}"],
  theme: {
    extend: {
      colors: {
        // Dark theme
        dark: {
          900: '#0A0A0F', // Background
          800: '#121218', // Cards, containers
          700: '#1E1E26', // Input fields
          600: '#2D2D3A', // Borders, dividers
          500: '#3E3E4A', // Secondary buttons
          400: '#5C5C6E', // Disabled text
          300: '#8E8E9A', // Secondary text
          200: '#AEAEB8', // Primary text (muted)
          100: '#E2E2E8', // Primary text (bright)
        },
        // Purple accent
        purple: {
          900: '#4A1D96', // Dark purple
          800: '#5B21B6', // Deep purple
          700: '#6D28D9', // Main purple
          600: '#7C3AED', // Bright purple (primary)
          500: '#8B5CF6', // Light purple
          400: '#A78BFA', // Lighter purple
          300: '#C4B5FD', // Very light purple
          200: '#DDD6FE', // Extremely light purple
          100: '#EDE9FE', // Almost white purple
        },
      },
      fontFamily: {
        sans: ['Inter var', 'sans-serif'],
      },
      boxShadow: {
        'purple': '0 4px 14px 0 rgba(124, 58, 237, 0.25)',
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
        }
      },
      animation: {
        'message-pop-in': 'message-pop-in 0.4s ease-out forwards'
      }
    },
  },
  plugins: [],
} 