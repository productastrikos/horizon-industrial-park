/** @type {import('tailwindcss').Config} */
const v = (n) => `rgb(var(--${n}) / <alpha-value>)`;

export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      fontFamily: { sans: ['Barlow', 'system-ui', 'Segoe UI', 'sans-serif'] },
      colors: {
        bg: v('bg'),
        surface: v('surface'),
        'surface-2': v('surface-2'),
        'surface-3': v('surface-3'),
        line: v('border'),
        'line-strong': v('border-strong'),
        fg: v('fg'),
        muted: v('fg-muted'),
        faint: v('fg-faint'),
        brand: { DEFAULT: v('brand'), strong: v('brand-strong'), soft: v('brand-soft') },
        plum: { DEFAULT: v('purple'), soft: v('purple-soft') },
        leaf: v('green'),
        ok: v('ok'),
        warn: v('warn'),
        crit: v('crit'),
        info: v('info'),
        s1: v('s1'),
        s2: v('s2'),
        s3: v('s3'),
        s4: v('s4'),
      },
      boxShadow: { card: 'var(--shadow-card)', pop: 'var(--shadow-pop)' },
      keyframes: {
        pulseRing: { '0%': { transform: 'scale(.8)', opacity: '.7' }, '100%': { transform: 'scale(2.2)', opacity: '0' } },
        slideIn: { '0%': { transform: 'translateX(16px)', opacity: '0' }, '100%': { transform: 'translateX(0)', opacity: '1' } },
        fadeUp: { '0%': { transform: 'translateY(6px)', opacity: '0' }, '100%': { transform: 'translateY(0)', opacity: '1' } },
      },
      animation: {
        'pulse-ring': 'pulseRing 1.6s ease-out infinite',
        'slide-in': 'slideIn .25s ease-out',
        'fade-up': 'fadeUp .3s ease-out',
      },
    },
  },
  plugins: [],
};
