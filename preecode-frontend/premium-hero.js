/* ══════════════════════════════════════
   PREMIUM HERO - THEME TOGGLE
   ══════════════════════════════════════ */

const themeToggle = document.getElementById('themeToggle');
const html = document.documentElement;

// Initialize theme
function initializeTheme() {
  // Check for saved theme preference or system preference
  const savedTheme = localStorage.getItem('theme');
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;

  if (savedTheme) {
    setTheme(savedTheme);
  } else if (prefersDark) {
    setTheme('dark');
  } else {
    setTheme('light');
  }
}

// Set theme
function setTheme(theme) {
  if (theme === 'dark') {
    html.classList.remove('light');
    html.classList.add('dark');
    localStorage.setItem('theme', 'dark');
    updateThemeIcon('dark');
  } else {
    html.classList.remove('dark');
    html.classList.add('light');
    localStorage.setItem('theme', 'light');
    updateThemeIcon('light');
  }
}

// Update theme icon
function updateThemeIcon(theme) {
  const sun = document.querySelector('.theme-icon .sun');
  const moon = document.querySelector('.theme-icon .moon');

  if (theme === 'dark' && sun && moon) {
    sun.style.display = 'block';
    moon.style.display = 'none';
  } else if (theme === 'light' && sun && moon) {
    sun.style.display = 'none';
    moon.style.display = 'block';
  }
}

// Toggle theme
function toggleTheme() {
  const currentTheme = html.classList.contains('dark') ? 'dark' : 'light';
  const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
  setTheme(newTheme);
}

// Event listener
if (themeToggle) {
  themeToggle.addEventListener('click', toggleTheme);
}

// Listen for system preference changes
window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
  if (!localStorage.getItem('theme')) {
    setTheme(e.matches ? 'dark' : 'light');
  }
});

// Initialize on load
document.addEventListener('DOMContentLoaded', initializeTheme);
