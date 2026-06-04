/* theme.js – Light/Dark theme system (loads before render) */
(function () {
  var themes = {
    light: {
      /* Backgrounds */
      '--bg-primary':     '#f8fafc',
      '--bg-secondary':   '#ffffff',
      '--bg-tertiary':    '#f1f5f9',
      '--card-bg':        '#ffffff',
      '--bg-input':       '#ffffff',
      '--bg-hover':       'rgba(15,23,42,0.03)',
      '--bg-topbar':      'rgba(255,255,255,0.88)',
      '--bg-sidebar':     'rgba(255,255,255,0.7)',
      '--bg-modal':       '#ffffff',
      '--bg-overlay':     'rgba(0,0,0,0.25)',

      /* Text */
      '--text-primary':   '#0f172a',
      '--text-secondary': '#334155',
      '--text-muted':     '#64748b',
      '--text-faint':     '#94a3b8',
      '--text-inverse':   '#ffffff',

      /* Borders */
      '--border-subtle':  'rgba(15,23,42,0.06)',
      '--border-strong':  'rgba(15,23,42,0.12)',

      /* Accent */
      '--accent':         '#f97316',
      '--accent-hover':   '#ea580c',
      '--accent-soft':    '#fff7ed',
      '--accent-border':  'rgba(249,115,22,0.2)',
      '--accent-glow':    'rgba(249,115,22,0.06)',

      /* Semantic */
      '--success':        '#16a34a',
      '--warning':        '#f59e0b',
      '--danger':         '#dc2626',

      /* Shadows */
      '--shadow-card':    '0 1px 4px rgba(0,0,0,0.08), 0 0 0 1px rgba(0,0,0,0.04)',
      '--shadow-lg':      '0 8px 24px rgba(0,0,0,0.08)',
      '--shadow-input':   'inset 0 1px 2px rgba(0,0,0,0.04)',
      '--bg-section':     '#f1f5f9',

      /* Scrollbar */
      '--scrollbar-thumb':'rgba(0,0,0,0.1)',
      '--scrollbar-hover':'rgba(0,0,0,0.18)',

      /* Skeleton */
      '--skeleton-from':  'rgba(0,0,0,0.04)',
      '--skeleton-to':    'rgba(0,0,0,0.08)',

      /* Focus */
      '--focus-ring':     'rgba(249,115,22,0.2)',
    },
    dark: {
      /* Backgrounds */
      '--bg-primary':     '#0b1220',
      '--bg-secondary':   '#111827',
      '--bg-tertiary':    '#1f2937',
      '--card-bg':        '#111827',
      '--bg-input':       'rgba(0,0,0,0.3)',
      '--bg-hover':       'rgba(255,255,255,0.04)',
      '--bg-topbar':      'rgba(11,18,32,0.85)',
      '--bg-sidebar':     'rgba(17,24,39,0.9)',
      '--bg-modal':       '#111827',
      '--bg-overlay':     'rgba(0,0,0,0.5)',

      /* Text */
      '--text-primary':   '#f8fafc',
      '--text-secondary': '#cbd5e1',
      '--text-muted':     '#94a3b8',
      '--text-faint':     '#64748b',
      '--text-inverse':   '#0b1220',

      /* Borders */
      '--border-subtle':  'rgba(255,255,255,0.06)',
      '--border-strong':  'rgba(255,255,255,0.12)',

      /* Accent */
      '--accent':         '#f97316',
      '--accent-hover':   '#fb923c',
      '--accent-soft':    'rgba(249,115,22,0.1)',
      '--accent-border':  'rgba(249,115,22,0.2)',
      '--accent-glow':    'rgba(249,115,22,0.12)',

      /* Semantic */
      '--success':        '#4ade80',
      '--warning':        '#fbbf24',
      '--danger':         '#f87171',

      /* Shadows */
      '--shadow-card':    '0 2px 8px rgba(0,0,0,0.3), 0 0 0 1px rgba(255,255,255,0.04)',
      '--shadow-lg':      '0 8px 24px rgba(0,0,0,0.25)',
      '--shadow-input':   'inset 0 1px 2px rgba(0,0,0,0.2)',
      '--bg-section':     '#0d1526',

      /* Scrollbar */
      '--scrollbar-thumb':'rgba(255,255,255,0.08)',
      '--scrollbar-hover':'rgba(255,255,255,0.15)',

      /* Skeleton */
      '--skeleton-from':  'rgba(255,255,255,0.04)',
      '--skeleton-to':    'rgba(255,255,255,0.08)',

      /* Focus */
      '--focus-ring':     'rgba(249,115,22,0.15)',
    }
  };

  function applyTheme(name) {
    var vars = themes[name] || themes.light;
    var root = document.documentElement;
    for (var key in vars) {
      root.style.setProperty(key, vars[key]);
    }
    root.classList.remove('light', 'dark');
    root.classList.add(name === 'dark' ? 'dark' : 'light');
    root.setAttribute('data-theme', name === 'dark' ? 'dark' : 'light');
  }

  function resolveSystem() {
    try { return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'; }
    catch (e) { return 'light'; }
  }

  function getStored() {
    try { return localStorage.getItem('preecode_theme'); }
    catch (e) { return null; }
  }

  // Migrate legacy 'system' value — treat as no preference
  var raw = getStored();
  if (raw === 'system') {
    try { localStorage.removeItem('preecode_theme'); } catch (e) {}
    raw = null;
  }

  window.PreeCodeTheme = {
    set: function (name) {
      if (name !== 'light' && name !== 'dark') name = 'light';
      try { localStorage.setItem('preecode_theme', name); } catch (e) {}
      applyTheme(name);
    },
    get: function () {
      var stored = getStored();
      return (stored === 'dark' || stored === 'light') ? stored : resolveSystem();
    },
    toggle: function () {
      var current = document.documentElement.classList.contains('dark') ? 'dark' : 'light';
      var next = current === 'dark' ? 'light' : 'dark';
      this.set(next);
      return next;
    }
  };

  // Apply on load: stored preference wins, otherwise follow system
  applyTheme(raw || resolveSystem());

  // Live-react to OS theme changes when user has no stored preference
  try {
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', function () {
      if (!getStored()) applyTheme(resolveSystem());
    });
  } catch (e) {}
})();
