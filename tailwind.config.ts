import type {Config} from 'tailwindcss';
const {fontFamily} = require('tailwindcss/defaultTheme');

export default {
  darkMode: ['class'],
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
    './src/views/**/*.{js,ts,jsx,tsx,mdx}',
    './src/features/**/*.{js,ts,jsx,tsx,mdx}',
    './src/shared/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      screens: {
        'xs': '475px',
      },
      fontFamily: {
        sans: ['var(--font-sans)', ...fontFamily.sans],
      },
       backgroundSize: {
        'size-200': '200% 200%',
      },
      colors: {
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        card: {
          DEFAULT: 'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))',
        },
        popover: {
          DEFAULT: 'hsl(var(--popover))',
          foreground: 'hsl(var(--popover-foreground))',
        },
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))',
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))',
        },
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))',
        },
        accent: {
          DEFAULT: 'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))',
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))',
        },
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        chart: {
          '1': 'hsl(var(--chart-1))',
          '2': 'hsl(var(--chart-2))',
          '3': 'hsl(var(--chart-3))',
          '4': 'hsl(var(--chart-4))',
          '5': 'hsl(var(--chart-5))',
        },
        sidebar: {
          DEFAULT: 'hsl(var(--sidebar-background))',
          foreground: 'hsl(var(--sidebar-foreground))',
          primary: 'hsl(var(--sidebar-primary))',
          'primary-foreground': 'hsl(var(--sidebar-primary-foreground))',
          accent: 'hsl(var(--sidebar-accent))',
          'accent-foreground': 'hsl(var(--sidebar-accent-foreground))',
          border: 'hsl(var(--sidebar-border))',
          ring: 'hsl(var(--sidebar-ring))',
        },
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 4px)',
        sm: 'calc(var(--radius) - 8px)',
      },
      keyframes: {
        'accordion-down': {
          from: {
            height: '0',
          },
          to: {
            height: 'var(--radix-accordion-content-height)',
          },
        },
        'accordion-up': {
          from: {
            height: 'var(--radix-accordion-content-height)',
          },
          to: {
            height: '0',
          },
        },
        'sos-blink': {
            /* S */
            '0%, 3%, 6%, 9%, 12%, 15%': { backgroundColor: 'white' },
            '1.5%, 4.5%, 7.5%, 10.5%, 13.5%, 18%': { backgroundColor: 'black' },
            
            /* O */
            '21%, 27%, 33%, 39%': { backgroundColor: 'white' },
            '24%, 30%, 36%, 42%': { backgroundColor: 'black' },
            
            /* S */
            '45%, 48%, 51%, 54%, 57%, 60%': { backgroundColor: 'white' },
            '46.5%, 49.5%, 52.5%, 55.5%, 58.5%, 63%': { backgroundColor: 'black' },
        
            '100%': { backgroundColor: 'black' },
        },
        'gradient-move': {
          '0%': { backgroundPosition: '0% 50%' },
          '50%': { backgroundPosition: '100% 50%' },
          '100%': { backgroundPosition: '0% 50%' },
        },
        'fade-in-up': {
          '0%': { opacity: '0', transform: 'translateY(20px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'fade-in': {
            '0%': { opacity: '0' },
            '100%': { opacity: '1' },
        },
         'fade-in-slow': {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        'pulse-slow': {
          '0%, 100%': { transform: 'scale(1)', opacity: '1' },
          '50%': { transform: 'scale(1.05)', opacity: '0.7' },
        },
        'fade-in-up-long': {
            '0%': { opacity: '0', transform: 'translateY(20px)' },
            '30%': { opacity: '0', transform: 'translateY(20px)' },
            '100%': { opacity: '1', transform: 'translateY(0)' },
        }
      },
      animation: {
        'accordion-down': 'accordion-down 0.2s ease-out',
        'accordion-up': 'accordion-up 0.2s ease-out',
        'sos-blink': 'sos-blink 5s infinite',
        'gradient-move': 'gradient-move 15s ease infinite',
        'fade-in-up': 'fade-in-up 0.8s ease-out forwards',
        'fade-in': 'fade-in 0.3s ease-out forwards',
        'fade-in-slow': 'fade-in-slow 1s ease-out forwards',
        'pulse-slow': 'pulse-slow 3s infinite ease-in-out',
        'fade-in-up-long': 'fade-in-up-long 1.5s ease-out forwards',
      },
    },
  },
  plugins: [require('tailwindcss-animate')],
} satisfies Config;
