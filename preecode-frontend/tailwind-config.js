tailwind.config = {
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'Segoe UI', 'system-ui', '-apple-system', 'sans-serif'],
      },
      colors: {
        th: {
          bg:       'var(--bg-primary)',
          bg2:      'var(--bg-secondary)',
          card:     'var(--card-bg)',
          surface:  'var(--bg-tertiary)',
          section:  'var(--bg-section)',
          input:    'var(--bg-input)',
          hover:    'var(--bg-hover)',
          topbar:   'var(--bg-topbar)',
          sidebar:  'var(--bg-sidebar)',
          modal:    'var(--bg-modal)',
        },
        txt: {
          DEFAULT:  'var(--text-primary)',
          sec:      'var(--text-secondary)',
          muted:    'var(--text-muted)',
          faint:    'var(--text-faint)',
          inv:      'var(--text-inverse)',
        },
        bdr: {
          DEFAULT:  'var(--border-subtle)',
          subtle:   'var(--border-subtle)',
          input:    'var(--border-strong)',
          strong:   'var(--border-strong)',
        },
        accent: {
          DEFAULT:  'var(--accent)',
          hover:    'var(--accent-hover)',
          soft:     'var(--accent-soft)',
        },
      },
      animation: {
        'fade-in':   'fadeUp 0.5s ease forwards',
        'fade-in-1': 'fadeUp 0.5s ease 0.08s forwards',
        'fade-in-2': 'fadeUp 0.5s ease 0.16s forwards',
        'fade-in-3': 'fadeUp 0.5s ease 0.24s forwards',
        'fade-in-4': 'fadeUp 0.5s ease 0.32s forwards',
        'streak-pulse': 'streakPulse 3s ease-in-out infinite',
      },
      keyframes: {
        fadeUp: {
          from: { opacity: '0', transform: 'translateY(16px)' },
          to:   { opacity: '1', transform: 'translateY(0)' },
        },
        streakPulse: {
          '0%, 100%': { boxShadow: '0 0 0 0 rgba(249,115,22,0.25)' },
          '50%':      { boxShadow: '0 0 0 4px transparent' },
        },
      },
    },
  },
};
