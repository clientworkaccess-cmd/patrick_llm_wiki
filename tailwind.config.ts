import type { Config } from 'tailwindcss';

// Tokens are lifted verbatim from Desing.md. Anything not in that file does not
// belong here — if a colour is needed that isn't below, the design spec changes first.
const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        base: '#050505', // Preto Base — primary background surface
        elevated: '#0D0D0F', // one step up from base, for cards on dark
        line: 'rgba(255,255,255,0.08)', // hairline borders
        glass: 'rgba(255,255,255,0.1)', // Vidro Navbar
        ink: '#FFFFFF', // Branco
        muted: '#9CA3AF', // Cinza Texto — primary body text
        accent: '#3B82F6', // Azul Gradiente
        surface: '#F9F9FA', // Dashboard Claro — light surfaces only
        success: '#22C55E', // Verde Trend
        danger: '#EF4444', // Vermelho Trend
      },
      fontFamily: {
        sans: ['var(--font-manrope)', 'system-ui', 'sans-serif'],
        serif: ['var(--font-instrument-serif)', 'Georgia', 'serif'],
        mono: ['var(--font-jetbrains-mono)', 'ui-monospace', 'monospace'],
      },
      fontSize: {
        hero: ['clamp(2.5rem, 5vw, 4rem)', { lineHeight: '1.05', letterSpacing: '-0.03em' }],
        h1: ['2.25rem', { lineHeight: '1.15', letterSpacing: '-0.02em' }],
        h2: ['1.5rem', { lineHeight: '1.25', letterSpacing: '-0.01em' }],
        body: ['1rem', { lineHeight: '1.6' }],
        small: ['0.875rem', { lineHeight: '1.5' }],
      },
      borderRadius: {
        DEFAULT: '8px', // base corner radius
        lg: '12px',
        xl: '16px',
      },
      maxWidth: {
        shell: '1280px',
        prose: '72ch', // body copy line cap
      },
      boxShadow: {
        card: '0 2px 12px rgba(0,0,0,0.06)',
        lift: '0 8px 28px rgba(0,0,0,0.35)',
      },
      zIndex: {
        // z-index contract from Desing.md — do not invent new layers
        sticky: '100',
        overlay: '200',
        modal: '300',
        toast: '500',
      },
      keyframes: {
        // Skeletons shimmer. Desing.md forbids circular spinners.
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
      },
      animation: {
        shimmer: 'shimmer 1.6s linear infinite',
      },
    },
  },
  plugins: [],
};

export default config;
