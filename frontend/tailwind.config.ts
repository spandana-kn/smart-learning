import type { Config } from 'tailwindcss'

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: 'rgb(var(--color-brand) / <alpha-value>)',
          dark: 'rgb(var(--color-brand-dark) / <alpha-value>)',
          light: 'rgb(var(--color-brand-light) / <alpha-value>)',
        },
        surface: {
          DEFAULT: 'rgb(var(--color-surface) / <alpha-value>)',
          card: 'rgb(var(--color-card) / <alpha-value>)',
          elevated: 'rgb(var(--color-elevated) / <alpha-value>)',
          border: 'rgb(var(--color-border) / <alpha-value>)',
        },
        accent: {
          gold: '#FFD700',
          emerald: '#00F5A0',
          crimson: '#FF4757',
          azure: '#00B4D8',
          amber: '#FF9F43',
        },
        emotion: {
          focused: '#00F5A0',
          neutral: '#8B85FF',
          bored: '#6C757D',
          frustrated: '#FF4757',
          confused: '#FF9F43',
          engaged: '#FFD700',
        },
      },
      fontFamily: {
        display: ['Space Grotesk', 'sans-serif'],
        body: ['Outfit', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
        lore: ['Space Grotesk', 'sans-serif'],
      },
      backgroundImage: {
        'gradient-brand': 'linear-gradient(135deg, #6C63FF 0%, #8B85FF 100%)',
        'gradient-dark': 'linear-gradient(180deg, #0F0E17 0%, #1A1828 100%)',
        'gradient-gold': 'linear-gradient(135deg, #FFD700 0%, #FF9F43 100%)',
        'gradient-emerald': 'linear-gradient(135deg, #00F5A0 0%, #00B4D8 100%)',
      },
      boxShadow: {
        glow: '0 0 20px rgba(108, 99, 255, 0.4)',
        'glow-gold': '0 0 20px rgba(255, 215, 0, 0.4)',
        'glow-emerald': '0 0 20px rgba(0, 245, 160, 0.3)',
        'glow-crimson': '0 0 20px rgba(255, 71, 87, 0.4)',
        card: '0 4px 24px rgba(0,0,0,0.4)',
      },
      animation: {
        'pulse-glow': 'pulse-glow 2s ease-in-out infinite',
        'float': 'float 3s ease-in-out infinite',
        'spin-slow': 'spin 4s linear infinite',
        'xp-fill': 'xp-fill 1s ease-out forwards',
        'damage-pop': 'damage-pop 0.6s ease-out forwards',
      },
      keyframes: {
        'pulse-glow': {
          '0%, 100%': { boxShadow: '0 0 10px rgba(108, 99, 255, 0.3)' },
          '50%': { boxShadow: '0 0 30px rgba(108, 99, 255, 0.7)' },
        },
        'float': {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-6px)' },
        },
        'xp-fill': {
          from: { width: '0%' },
          to: { width: 'var(--xp-width)' },
        },
        'damage-pop': {
          '0%': { transform: 'translateY(0) scale(1)', opacity: '1' },
          '100%': { transform: 'translateY(-60px) scale(1.4)', opacity: '0' },
        },
      },
    },
  },
  plugins: [],
} satisfies Config
