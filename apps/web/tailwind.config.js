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
        ax: {
          canvas: 'rgb(var(--ax-canvas-rgb) / <alpha-value>)',
          surface: {
            DEFAULT: 'rgb(var(--ax-surface-rgb) / <alpha-value>)',
            hover: 'rgb(var(--ax-surface-hover-rgb) / <alpha-value>)',
            inset: 'rgb(var(--ax-surface-inset-rgb) / <alpha-value>)',
          },
          primary: 'rgb(var(--ax-text-primary-rgb) / <alpha-value>)',
          secondary: 'rgb(var(--ax-text-secondary-rgb) / <alpha-value>)',
          muted: 'rgb(var(--ax-text-muted-rgb) / <alpha-value>)',
          edge: 'rgb(var(--ax-border-default-rgb) / <alpha-value>)',
          'edge-strong': 'rgb(var(--ax-border-strong-rgb) / <alpha-value>)',
          accent: {
            DEFAULT: 'rgb(var(--ax-accent-rgb) / <alpha-value>)',
            hover: 'rgb(var(--ax-accent-hover-rgb) / <alpha-value>)',
            soft: 'rgb(var(--ax-accent-soft-rgb) / <alpha-value>)',
            'soft-hover': 'rgb(var(--ax-accent-soft-hover-rgb) / <alpha-value>)',
          },
          'on-accent': 'rgb(var(--ax-on-accent-rgb) / <alpha-value>)',
          success: {
            DEFAULT: 'rgb(var(--ax-success-rgb) / <alpha-value>)',
            soft: 'rgb(var(--ax-success-soft-rgb) / <alpha-value>)',
          },
          warning: {
            DEFAULT: 'rgb(var(--ax-warning-rgb) / <alpha-value>)',
            soft: 'rgb(var(--ax-warning-soft-rgb) / <alpha-value>)',
          },
          danger: {
            DEFAULT: 'rgb(var(--ax-danger-rgb) / <alpha-value>)',
            soft: 'rgb(var(--ax-danger-soft-rgb) / <alpha-value>)',
          },
          info: {
            DEFAULT: 'rgb(var(--ax-info-rgb) / <alpha-value>)',
            soft: 'rgb(var(--ax-info-soft-rgb) / <alpha-value>)',
          },
          'tooltip-bg': 'rgb(var(--ax-tooltip-bg-rgb) / <alpha-value>)',
          'tooltip-fg': 'rgb(var(--ax-tooltip-fg-rgb) / <alpha-value>)',
        },
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
        'ax-sidebar': 'var(--ax-space-sidebar)',
        'ax-sidebar-collapsed': 'var(--ax-space-sidebar-collapsed)',
        '18': '4.5rem',
        '88': '22rem',
        '128': '32rem',
      },
      transitionDuration: {
        'ax-fast': 'var(--ax-dur-fast)',
        'ax-base': 'var(--ax-dur-base)',
        'ax-slow': 'var(--ax-dur-slow)',
      },
      transitionTimingFunction: {
        'ax-standard': 'var(--ax-ease-standard)',
      },
      boxShadow: {
        'ax-sm': 'var(--ax-shadow-sm)',
        'ax-md': 'var(--ax-shadow-md)',
        'ax-lg': 'var(--ax-shadow-lg)',
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

