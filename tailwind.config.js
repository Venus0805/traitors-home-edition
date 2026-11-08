/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      keyframes: {
        pop: { '0%': { transform: 'scale(.6)', opacity: 0 }, '70%': { transform: 'scale(1.08)' }, '100%': { transform: 'scale(1)', opacity: 1 } },
        fade: { from: { opacity: 0, transform: 'translateY(12px)' }, to: { opacity: 1, transform: 'translateY(0)' } },
        pulseRed: { '0%,100%': { textShadow: '0 0 12px #ef4444' }, '50%': { textShadow: '0 0 36px #ef4444, 0 0 60px #991b1b' } },
        shake: { '0%,100%': { transform: 'translateX(0)' }, '20%': { transform: 'translateX(-8px)' }, '40%': { transform: 'translateX(8px)' }, '60%': { transform: 'translateX(-5px)' }, '80%': { transform: 'translateX(5px)' } },
        grow: { from: { width: '0%' } },
      },
      animation: {
        pop: 'pop .5s ease-out both',
        fade: 'fade .5s ease-out both',
        pulseRed: 'pulseRed 1.6s ease-in-out infinite',
        shake: 'shake .6s ease-in-out',
        grow: 'grow .9s ease-out both',
      },
    },
  },
  plugins: [],
};
