/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  content: ['./src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        // default
        primary: 'var(--color-primary)',
        'primary-hover': 'var(--color-primary-hover)',
        'primary-press': 'var(--color-primary-press)',
        'primary-disabled': 'var(--color-primary-disabled)',
        secondary: 'var(--color-secondary)',
        'secondary-hover': 'var(--color-secondary-hover)',
        'secondary-press': 'var(--color-secondary-press)',
        'secondary-disabled': 'var(--color-secondary-disabled)',
        'text-primary': 'var(--color-text-primary)',
        'base-light': 'var(--color-base-light)',
        'base-dark': 'var(--color-base-dark)',

        // color definition for toast notification
        'toast-info': '#007BFF',
        'toast-info-hover': '#0056B3',
        'toast-error': '#DC3545',
        'toast-error-hover': '#BD2130',
        'toast-success': '#28A745',
        'toast-tool': '#9C27B0',
        'toast-tool-hover': '#7B1FA2',
      },
      zIndex: {
        5: '5',
        15: '15',
      },
      width: {
        'col-span-2': '184px',
        'col-span-4': '392px',
        'col-span-7': '704px',
      },
      animation: {
        'fade-in': 'fadeIn 0.5s ease-in-out',
        'fade-out': 'fadeOut 0.5s ease-in-out',
        'pulse-slow': 'pulse 3s ease-in-out infinite',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        fadeOut: {
          '0%': { opacity: '1' },
          '100%': { opacity: '0' },
        },
      },
    },
  },
  plugins: [],
}
