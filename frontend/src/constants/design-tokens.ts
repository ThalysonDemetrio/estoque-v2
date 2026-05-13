/**
 * DESIGN TOKENS (TypeScript Mirror)
 * 
 * Este arquivo espelha as variáveis definidas no globals.css.
 * Use estas constantes para animações (framer-motion), estilos inline dinâmicos
 * ou quando precisar de valores de design programaticamente.
 */

export const TOKENS = {
  // Primitive Colors (Base)
  colors: {
    indigo: {
      50: '#eef2ff',
      100: '#e0e7ff',
      200: '#c7d2fe',
      300: '#a5b4fc',
      400: '#818cf8',
      500: '#6366f1',
      600: '#4f46e5',
      700: '#4338ca',
      800: '#3730a3',
      900: '#312e81',
    },
    slate: {
      50: '#f8fafc',
      100: '#f1f5f9',
      200: '#e2e8f0',
      300: '#cbd5e1',
      400: '#94a3b8',
      500: '#64748b',
      600: '#475569',
      700: '#334155',
      800: '#1e293b',
      900: '#0f172a',
      950: '#020617',
    },
    feedback: {
      success: '#10b981',
      error: '#ef4444',
      warning: '#f59e0b',
      info: '#3b82f6',
    }
  },

  // Spacing (rem)
  spacing: {
    1: '0.25rem',
    2: '0.5rem',
    3: '0.75rem',
    4: '1rem',
    5: '1.25rem',
    6: '1.5rem',
    8: '2rem',
    10: '2.5rem',
    12: '3.0rem',
  },

  // Radius (px)
  radius: {
    xs: '4px',
    sm: '8px',
    md: '12px',
    lg: '16px',
    xl: '24px',
    '2xl': '32px',
    full: '9999px',
  },

  // Semantic Tokens (Current Theme Helpers)
  // Nota: Estes valores são os mesmos do :root (Light Mode).
  // Para valores dinâmicos de tema, prefira usar variáveis CSS: var(--app-bg).
  semantic: {
    brand: 'var(--brand-primary)',
    bg: 'var(--app-bg)',
    surface: 'var(--surface-primary)',
    text: {
      strong: 'var(--text-strong)',
      main: 'var(--text-main)',
      muted: 'var(--text-muted)',
    },
    border: 'var(--border-subtle)',
  },

  // Neumorphic Tokens
  neumorphic: {
    bg: 'var(--nm-bg)',
    shadow: {
      light: 'var(--nm-shadow-light)',
      dark: 'var(--nm-shadow-dark)',
    },
    inset: {
      light: 'var(--nm-inset-light)',
      dark: 'var(--nm-inset-dark)',
    }
  },

  // Transitions
  transitions: {
    default: '0.3s cubic-bezier(0.4, 0, 0.2, 1)',
    fast: '0.15s cubic-bezier(0.4, 0, 0.2, 1)',
    slow: '0.5s cubic-bezier(0.4, 0, 0.2, 1)',
  }
} as const;
