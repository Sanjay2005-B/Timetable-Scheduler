/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Brand palette — deep indigo + violet accent
        brand: {
          50:  '#eef2ff',
          100: '#e0e7ff',
          200: '#c7d2fe',
          300: '#a5b4fc',
          400: '#818cf8',
          500: '#6366f1',
          600: '#4f46e5',
          700: '#4338ca',
          800: '#3730a3',
          900: '#312e81',
          950: '#1e1b4b',
        },
        accent: {
          50:  '#fdf4ff',
          100: '#fae8ff',
          400: '#e879f9',
          500: '#d946ef',
          600: '#c026d3',
        },
        // Dark mode surface tokens
        surface: {
          DEFAULT: '#0f1117',
          50:  '#1a1d27',
          100: '#20243a',
          200: '#252a40',
          300: '#2d3354',
        },
        success: { DEFAULT: '#22c55e', light: '#dcfce7' },
        warning: { DEFAULT: '#f59e0b', light: '#fef3c7' },
        danger:  { DEFAULT: '#ef4444', light: '#fee2e2' },
        info:    { DEFAULT: '#3b82f6', light: '#dbeafe' },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      borderRadius: {
        '2xl': '1rem',
        '3xl': '1.5rem',
      },
      boxShadow: {
        'glow':    '0 0 20px rgba(99,102,241,0.3)',
        'glow-lg': '0 0 40px rgba(99,102,241,0.4)',
        'card':    '0 4px 24px rgba(0,0,0,0.35)',
        'card-lg': '0 8px 40px rgba(0,0,0,0.45)',
      },
      animation: {
        'fade-in':    'fadeIn 0.3s ease-out',
        'slide-in':   'slideIn 0.3s ease-out',
        'slide-up':   'slideUp 0.3s ease-out',
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
      },
      keyframes: {
        fadeIn:  { from: { opacity: '0' }, to: { opacity: '1' } },
        slideIn: { from: { opacity: '0', transform: 'translateX(-12px)' }, to: { opacity: '1', transform: 'translateX(0)' } },
        slideUp: { from: { opacity: '0', transform: 'translateY(12px)' }, to: { opacity: '1', transform: 'translateY(0)' } },
      },
      backgroundImage: {
        'gradient-brand': 'linear-gradient(135deg, #4f46e5 0%, #7c3aed 50%, #c026d3 100%)',
        'gradient-card':  'linear-gradient(135deg, rgba(99,102,241,0.1) 0%, rgba(139,92,246,0.05) 100%)',
        'gradient-dark':  'linear-gradient(180deg, #0f1117 0%, #1a1d27 100%)',
      },
    },
  },
  plugins: [
    require('@tailwindcss/forms'),
  ],
}
