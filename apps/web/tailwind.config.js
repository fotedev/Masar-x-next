/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      animation: {
        'wiggle': 'wiggle 1s ease-in-out infinite',
        'ping-slow': 'ping 3s cubic-bezier(0, 0, 0.2, 1) infinite',
      },
      keyframes: {
        wiggle: {
          '0%, 100%': { transform: 'rotate(-10deg)' },
          '50%': { transform: 'rotate(10deg)' },
        }
      },
      colors: {
        brand: {
          navy: 'rgba(var(--brand-navy), <alpha-value>)',
          blue: 'rgba(var(--brand-blue), <alpha-value>)',
          sky: 'rgba(var(--brand-sky), <alpha-value>)',
          orange: 'rgba(var(--brand-orange), <alpha-value>)',
          purple: '#8b5cf6',
        },
        primary: { foreground: 'hsl(var(--primary-foreground))' },
      },
      screens: {
        'xs': '475px',
        'sm': '640px',
        'md': '768px',
        'tablet': '820px', // iPad Air 7 and similar tablets
        'lg': '1024px',
        'xl': '1280px',
        '2xl': '1536px',
      },
      fontSize: {
        'xs': ['0.75rem', { lineHeight: '1rem' }],
        'sm': ['0.875rem', { lineHeight: '1.25rem' }],
        'base': ['1rem', { lineHeight: '1.5rem' }],
        'lg': ['1.125rem', { lineHeight: '1.75rem' }],
        'xl': ['1.25rem', { lineHeight: '1.75rem' }],
        '2xl': ['1.5rem', { lineHeight: '2rem' }],
        '3xl': ['1.875rem', { lineHeight: '2.25rem' }],
        '4xl': ['2.25rem', { lineHeight: '2.5rem' }],
        '5xl': ['3rem', { lineHeight: '1' }],
      },
      spacing: {
        '18': '4.5rem',
        '88': '22rem',
        '128': '32rem',
      },
      zIndex: {
        'header': '40',
        'sidebar': '45',
        'modal': '50',
        'popover': '55',
        'toast': '60',
        'tooltip': '70',
      },
    },
  },
  plugins: [],
};
