/* layout.js – Injects top navigation bar into .app-shell pages */

(function () {
  // Auth guard
  if (!localStorage.getItem('token')) {
    window.location.href = '/index.html';
    return;
  }

  var userName = localStorage.getItem('preecode_name') || 'User';
  var displayName = userName.charAt(0).toUpperCase() + userName.slice(1);
  var initial = userName.charAt(0).toUpperCase();
  var currentPage = window.location.pathname.split('/').pop().replace('.html', '');

  // Extract a short first name from raw username
  function extractFirstName(raw) {
    if (!raw || raw.toLowerCase() === 'user') return 'User';
    var clean = raw.replace(/[0-9]/g, '');
    if (!clean) return raw.slice(0, 6);
    var parts = clean.replace(/([a-z])([A-Z])/g, '$1 $2').split(/\s+/);
    var first = parts[0] || clean.slice(0, 6);
    if (first.length > 8) first = first.slice(0, 8);
    return first.charAt(0).toUpperCase() + first.slice(1).toLowerCase();
  }
  var firstName = extractFirstName(userName);

  function navCls(page) {
    var base = 'topbar-nav-link';
    if (currentPage === page) return base + ' active';
    return base;
  }

  // ── Topbar ──
  var topbar = document.createElement('header');
  topbar.className = 'topbar';

  // Plan badge
  var plan = localStorage.getItem('preecode_plan') || 'pro';
  var badge = localStorage.getItem('preecode_badge') || 'basic';
  var planText = plan === 'pro' ? (badge === 'elite' ? 'Founding' : 'Beta') : 'Free';
  var planIcon = plan === 'pro'
    ? '<svg class="topbar-badge-icon" viewBox="0 0 24 24" fill="currentColor"><path d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.563.563 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z"/></svg>'
    : '';

  topbar.innerHTML =
    // Left: Logo + Nav links
    '<div class="topbar-left">' +
      '<a class="brand-logo logo-nav" href="/pages/dashboard.html"><span class="brand-dark">Pree</span><span class="brand-accent">code</span></a>' +
      '<nav class="topbar-nav" id="topbarNav">' +
        '<a href="/pages/dashboard.html" class="' + navCls('dashboard') + '">Dashboard</a>' +
        '<a href="/pages/problems.html" class="' + navCls('problems') + '">Problems</a>' +
        '<a href="/pages/resume-upload.html" class="' + navCls('resume-upload') + '">Resume</a>' +
        '<a href="/pages/interview-setup.html" class="' + navCls('interview-setup') + '">Interview</a>' +
      '</nav>' +
    '</div>' +
    // Right: Start Practice CTA + Notifications + Streak + Profile
    '<div class="topbar-right">' +
      // Start Practice CTA button
      '<a href="https://marketplace.visualstudio.com/items?itemName=Preecode.preecode" target="_blank" rel="noopener noreferrer" id="startPracticeBtn" class="topbar-start-practice" title="Install Preecode VS Code Extension">' +
        '<span>Start Practice</span>' +
      '</a>' +
      // Notifications
      '<div class="notif-container" id="notifContainer">' +
        '<button class="topbar-notif-btn" id="notifBtn" title="Notifications" aria-expanded="false" aria-haspopup="true">' +
          '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0"/></svg>' +
          '<span class="notif-badge hidden" id="notifBadge"></span>' +
        '</button>' +
        '<div class="notif-dropdown hidden" id="notifDropdown" role="menu">' +
          '<div class="notif-dropdown-header">' +
            '<span class="notif-dropdown-title">Notifications</span>' +
            '<button class="notif-mark-read" id="notifMarkRead" style="font-size:11px;background:none;border:none;color:var(--accent,#f97316);cursor:pointer;padding:0">Mark all read</button>' +
          '</div>' +
          '<div class="notif-dropdown-body" id="notifBody">' +
            '<div class="notif-empty" id="notifEmpty">' +
              '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path stroke-linecap="round" stroke-linejoin="round" d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0"/></svg>' +
              '<p>No new notifications</p>' +
            '</div>' +
          '</div>' +
        '</div>' +
      '</div>' +
      // Streak badge
      '<span class="topbar-streak-badge" id="streakBadge">' +
        '<svg class="topbar-badge-icon" viewBox="0 0 24 24" fill="currentColor"><path d="M12.832 3.56c.131-.19.334-.378.534-.358.178.018.42.261.482.452.236.719.237 1.5-.066 2.339a9.147 9.147 0 01-.397.85c-.122.226-.216.399-.238.442.032-.014.085-.021.151-.02.34.008.885.274 1.272.786a11.36 11.36 0 011.567 2.925c.46 1.267.555 2.626.076 3.86a5.85 5.85 0 01-2.234 2.817 5.847 5.847 0 01-3.242 1.198c-1.27.065-2.57-.235-3.645-.904a5.158 5.158 0 01-2.208-2.987c-.34-1.233-.205-2.523.174-3.678a10.56 10.56 0 011.454-2.83c.248-.346.513-.67.784-.975a.757.757 0 01.626-.274c.274.015.507.24.572.49.138.536.08 1.055-.018 1.442.482-.57.918-1.196 1.213-1.89.457-1.07.627-2.273.443-3.462-.092-.598-.162-.855-.324-1.223z"/></svg>' +
        '<span id="streakText">0</span>' +
      '</span>' +
      // Profile avatar trigger
      '<div class="topbar-profile" id="profileDropdownTrigger">' +
        '<div class="topbar-avatar" id="navAvatar">' + initial + '</div>' +
      '</div>' +
      // Dropdown menu
      '<div class="topbar-dropdown hidden" id="profileDropdown">' +
        '<div class="topbar-dropdown-header">' +
          '<div class="topbar-dropdown-avatar">' + initial + '</div>' +
          '<div class="topbar-dropdown-info">' +
            '<span class="topbar-dropdown-name" id="navUserName">' + firstName + '</span>' +
            '<span class="topbar-dropdown-plan">' + (plan === 'pro' ? 'Pro' : 'Free') + ' Plan</span>' +
          '</div>' +
        '</div>' +
        '<div class="topbar-dropdown-divider"></div>' +
        '<a href="/pages/profile.html" class="topbar-dropdown-item">' +
          '<svg class="topbar-dropdown-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>' +
          'Profile' +
        '</a>' +
        '<a href="#" class="topbar-dropdown-item" id="navFoundingMember">' +
          '<svg class="topbar-dropdown-icon" viewBox="0 0 24 24" fill="currentColor"><path d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.563.563 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z"/></svg>' +
          'Founding Member' +
        '</a>' +
        '<a href="/pages/settings.html" class="topbar-dropdown-item">' +
          '<svg class="topbar-dropdown-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 010 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 010-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281z"/><circle cx="12" cy="12" r="3"/></svg>' +
          'Settings' +
        '</a>' +
        '<div class="topbar-dropdown-divider"></div>' +
        '<button class="topbar-dropdown-item topbar-dropdown-logout" id="navLogout">' +
          '<svg class="topbar-dropdown-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15m3 0l3-3m0 0l-3-3m3 3H9"/></svg>' +
          'Log out' +
        '</button>' +
      '</div>' +
      // Mobile hamburger
      '<button class="topbar-hamburger" id="topbarHamburger" aria-label="Toggle navigation">' +
        '<svg class="hamburger-icon" id="hamburgerOpen" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5"/></svg>' +
        '<svg class="hamburger-icon hidden" id="hamburgerClose" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>' +
      '</button>' +
    '</div>';

  // ── Mobile Menu ──
  var mobileMenu = document.createElement('div');
  mobileMenu.className = 'topbar-mobile-menu hidden';
  mobileMenu.id = 'mobileMenu';
  mobileMenu.innerHTML =
    '<a href="/pages/dashboard.html" class="' + navCls('dashboard') + '">Dashboard</a>' +
    '<a href="/pages/problems.html" class="' + navCls('problems') + '">Problems</a>' +
    '<a href="/pages/resume-upload.html" class="' + navCls('resume-upload') + '">Resume</a>' +
    '<a href="/pages/interview-setup.html" class="' + navCls('interview-setup') + '">Interview</a>' +
    '<a href="https://marketplace.visualstudio.com/items?itemName=Preecode.preecode" target="_blank" rel="noopener noreferrer" id="startPracticeMobile" class="topbar-nav-link" style="color:var(--accent,#f97316);font-weight:600">▶ Start Practice</a>';

  // ── Inject ──
  var shell = document.querySelector('.app-shell');
  if (shell) {
    var main = shell.querySelector('.app-main');
    if (main) {
      main.insertBefore(topbar, main.firstChild);
      topbar.insertAdjacentElement('afterend', mobileMenu);
    }
  }

  // ── Hamburger Menu Logic ──
  var hamburgerBtn = document.getElementById('topbarHamburger');
  var mobileMenuEl = document.getElementById('mobileMenu');
  var openIcon = document.getElementById('hamburgerOpen');
  var closeIcon = document.getElementById('hamburgerClose');

  if (hamburgerBtn && mobileMenuEl) {
    hamburgerBtn.addEventListener('click', function (e) {
      e.stopPropagation();
      var isOpen = !mobileMenuEl.classList.contains('hidden');
      if (isOpen) {
        closeMobileMenu();
      } else {
        mobileMenuEl.classList.remove('hidden');
        requestAnimationFrame(function () {
          mobileMenuEl.classList.add('open');
        });
        if (openIcon) openIcon.classList.add('hidden');
        if (closeIcon) closeIcon.classList.remove('hidden');
      }
    });
  }

  function closeMobileMenu() {
    if (!mobileMenuEl) return;
    mobileMenuEl.classList.remove('open');
    if (openIcon) openIcon.classList.remove('hidden');
    if (closeIcon) closeIcon.classList.add('hidden');
    setTimeout(function () {
      mobileMenuEl.classList.add('hidden');
    }, 200);
  }

  // ── Notification Dropdown Logic ──
  var notifBtn = document.getElementById('notifBtn');
  var notifDropdown = document.getElementById('notifDropdown');
  var notifContainer = document.getElementById('notifContainer');

  function openNotifDropdown() {
    // Close profile dropdown if open
    if (dropdown && !dropdown.classList.contains('hidden')) closeProfileDropdown();
    notifDropdown.classList.remove('hidden');
    requestAnimationFrame(function () {
      notifDropdown.classList.add('open');
    });
    notifBtn.setAttribute('aria-expanded', 'true');
  }

  function closeNotifDropdown() {
    notifDropdown.classList.remove('open');
    notifBtn.setAttribute('aria-expanded', 'false');
    setTimeout(function () {
      notifDropdown.classList.add('hidden');
    }, 150);
  }

  if (notifBtn && notifDropdown) {
    notifBtn.addEventListener('click', function (e) {
      e.stopPropagation();
      var isOpen = !notifDropdown.classList.contains('hidden');
      if (isOpen) {
        closeNotifDropdown();
      } else {
        openNotifDropdown();
      }
    });
  }

  // ── Profile Dropdown Logic ──
  var trigger = document.getElementById('profileDropdownTrigger');
  var dropdown = document.getElementById('profileDropdown');

  function closeProfileDropdown() {
    if (!dropdown) return;
    dropdown.classList.remove('open');
    trigger.classList.remove('active');
    setTimeout(function () {
      dropdown.classList.add('hidden');
    }, 150);
  }

  if (trigger && dropdown) {
    trigger.addEventListener('click', function (e) {
      e.stopPropagation();
      // Close notification dropdown if open
      if (notifDropdown && !notifDropdown.classList.contains('hidden')) closeNotifDropdown();
      var isOpen = !dropdown.classList.contains('hidden');
      if (isOpen) {
        closeProfileDropdown();
      } else {
        dropdown.classList.remove('hidden');
        requestAnimationFrame(function () {
          dropdown.classList.add('open');
        });
        trigger.classList.add('active');
      }
    });
  }

  // ── Global: outside click + ESC for all dropdowns ──
  document.addEventListener('click', function (e) {
    // Close profile dropdown on outside click
    if (dropdown && !dropdown.classList.contains('hidden') && !dropdown.contains(e.target) && !trigger.contains(e.target)) {
      closeProfileDropdown();
    }
    // Close notification dropdown on outside click
    if (notifDropdown && !notifDropdown.classList.contains('hidden') && !notifContainer.contains(e.target)) {
      closeNotifDropdown();
    }
    // Close mobile menu on outside click
    if (mobileMenuEl && !mobileMenuEl.classList.contains('hidden') &&
        !mobileMenuEl.contains(e.target) && e.target !== hamburgerBtn &&
        !hamburgerBtn.contains(e.target)) {
      closeMobileMenu();
    }
  });

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') {
      if (dropdown && !dropdown.classList.contains('hidden')) closeProfileDropdown();
      if (notifDropdown && !notifDropdown.classList.contains('hidden')) closeNotifDropdown();
      if (mobileMenuEl && !mobileMenuEl.classList.contains('hidden')) closeMobileMenu();
    }
  });

  // ── Logout ──
  var logoutBtn = document.getElementById('navLogout');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', function () {
      localStorage.removeItem('token');
      localStorage.removeItem('preecode_uid');
      localStorage.removeItem('preecode_name');
      localStorage.removeItem('preecode_plan');
      localStorage.removeItem('preecode_badge');
      localStorage.removeItem('preecode_shared');
      localStorage.removeItem('preecode_new');
      window.location.href = '/index.html';
    });
  }

  // ── Start Practice Modal ──
  function injectPracticeModal() {
    if (document.getElementById('practiceChoiceModal')) return;
    var modal = document.createElement('div');
    modal.id = 'practiceChoiceModal';
    modal.innerHTML = [
      '<div class="pc-modal-backdrop" id="pcBackdrop">',
        '<div class="pc-modal">',
          '<button class="pc-modal-close" id="pcClose" aria-label="Close">&times;</button>',
          '<h2 class="pc-modal-title">Where do you want to practice?</h2>',
          '<p class="pc-modal-sub">Choose your preferred coding environment</p>',
          '<div class="pc-modal-options">',
            '<a href="#" id="pcVscode" class="pc-option pc-option--vscode">',
              '<div class="pc-option-icon">',
                '<svg width="32" height="32" viewBox="0 0 24 24" fill="currentColor"><path fill-rule="evenodd" clip-rule="evenodd" d="M17.5 1.5L20 4.5L22.5 3L24 5.5L20 8.5L20 19.5L24 22.5L22.5 24L20 22.5L3 16.5L1 17.5L0 15.5L2 14L2 9L0 7.5L1 5.5L3 6.5L17.5 1.5ZM18 7L5.5 12L18 17V7Z"/></svg>',
              '</div>',
              '<div class="pc-option-body">',
                '<span class="pc-option-title">Practice in VS Code</span>',
                '<span class="pc-option-desc">Full IDE experience with AI hints, timer & auto-sync</span>',
              '</div>',
              '<svg class="pc-option-arrow" width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3"/></svg>',
            '</a>',
            '<a href="/pages/practice-here.html" class="pc-option pc-option--web">',
              '<div class="pc-option-icon">',
                '<svg width="32" height="32" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.8"><rect x="3" y="3" width="18" height="18" rx="2"/><path stroke-linecap="round" stroke-linejoin="round" d="M8 9l3 3-3 3m5 0h3"/></svg>',
              '</div>',
              '<div class="pc-option-body">',
                '<span class="pc-option-title">Practice Here</span>',
                '<span class="pc-option-desc">Online compiler - write, run & save code in your browser</span>',
              '</div>',
              '<svg class="pc-option-arrow" width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3"/></svg>',
            '</a>',
          '</div>',
        '</div>',
      '</div>'
    ].join('');
    document.body.appendChild(modal);

    document.getElementById('pcClose').addEventListener('click', closePracticeModal);
    document.getElementById('pcBackdrop').addEventListener('click', function(e) {
      if (e.target === this) closePracticeModal();
    });
    document.getElementById('pcVscode').addEventListener('click', function(e) {
      e.preventDefault();
      closePracticeModal();
      var token = localStorage.getItem('token') || '';
      var vscodeUri = 'vscode://preecode.preecode/auth' + (token ? '?token=' + encodeURIComponent(token) + '&source=navbar' : '');
      window.location.href = vscodeUri;
    });
  }

  function openPracticeModal() {
    injectPracticeModal();
    var modal = document.getElementById('practiceChoiceModal');
    modal.style.display = 'flex';
    requestAnimationFrame(function() { modal.classList.add('pc-modal--open'); });
  }

  function closePracticeModal() {
    var modal = document.getElementById('practiceChoiceModal');
    if (!modal) return;
    modal.classList.remove('pc-modal--open');
    setTimeout(function() { modal.style.display = 'none'; }, 220);
  }

  function bindStartPractice(el) {
    if (!el) return;
    el.addEventListener('click', function (e) {
      e.preventDefault();
      openPracticeModal();
    });
  }
  bindStartPractice(document.getElementById('startPracticeBtn'));
  bindStartPractice(document.getElementById('startPracticeMobile'));

  // ── Notification System ──
  var NOTIF_KEY = 'preecode_notifications';
  var NOTIF_LAST_SEEN = 'preecode_notif_last_seen';

  function getNotifications() {
    try { return JSON.parse(localStorage.getItem(NOTIF_KEY) || '[]'); } catch(e) { return []; }
  }

  function saveNotifications(list) {
    localStorage.setItem(NOTIF_KEY, JSON.stringify(list));
  }

  function pushNotification(msg, type) {
    var list = getNotifications();
    list.unshift({ id: Date.now(), msg: msg, type: type || 'info', read: false, time: new Date().toISOString() });
    if (list.length > 20) list = list.slice(0, 20);
    saveNotifications(list);
    renderNotifications();
  }

  function renderNotifications() {
    var list = getNotifications();
    var unread = list.filter(function(n) { return !n.read; }).length;
    var badge = document.getElementById('notifBadge');
    var body  = document.getElementById('notifBody');
    var empty = document.getElementById('notifEmpty');

    if (badge) {
      if (unread > 0) {
        badge.textContent = unread > 9 ? '9+' : unread;
        badge.classList.remove('hidden');
      } else {
        badge.classList.add('hidden');
      }
    }

    if (!body) return;
    // Remove existing notif items (keep empty state)
    body.querySelectorAll('.notif-item').forEach(function(el) { el.remove(); });

    if (list.length === 0) {
      if (empty) empty.style.display = '';
      return;
    }
    if (empty) empty.style.display = 'none';

    list.slice(0, 8).forEach(function(n) {
      var item = document.createElement('div');
      item.className = 'notif-item' + (n.read ? ' read' : '');
      var icon = n.type === 'success' ? '✅' : n.type === 'warning' ? '⚠️' : 'ℹ️';
      var timeStr = new Date(n.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      item.innerHTML =
        '<span class="notif-item-icon">' + icon + '</span>' +
        '<div class="notif-item-content">' +
          '<p class="notif-item-msg">' + n.msg + '</p>' +
          '<span class="notif-item-time">' + timeStr + '</span>' +
        '</div>';
      body.appendChild(item);
    });
  }

  // Mark all read
  var markReadBtn = document.getElementById('notifMarkRead');
  if (markReadBtn) {
    markReadBtn.addEventListener('click', function() {
      var list = getNotifications().map(function(n) { n.read = true; return n; });
      saveNotifications(list);
      renderNotifications();
    });
  }

  // Expose globally so dashboard.js can push notifications
  window.preecodeNotify = pushNotification;

  // Initial render
  renderNotifications();

  // Check for dashboard data update (compare last seen stats)
  (function checkDashboardUpdate() {
    try {
      var lastSeen = localStorage.getItem(NOTIF_LAST_SEEN);
      var currentTotal = localStorage.getItem('preecode_last_total') || '0';
      var newTotal = localStorage.getItem('preecode_uid') ? null : null;
      // Will be triggered by dashboard.js via window.preecodeNotify
    } catch(e) {}
  })();
  (async function hydrateUser() {
    try {
      var token = localStorage.getItem('token');
      if (!token) return;

      var cachedName = localStorage.getItem('preecode_name') || '';
      var cachedUserId = localStorage.getItem('preecode_uid') || '';
      var hasValidUserId = /^[a-f\d]{24}$/i.test(cachedUserId);
      var needsNameHydration = !cachedName || cachedName.toLowerCase() === 'user';

      // Skip network call only if both name and user id are already valid.
      if (!needsNameHydration && hasValidUserId) return;

      var res = await fetch(API_BASE + '/users/me', {
        headers: { Authorization: 'Bearer ' + token },
        credentials: 'include'
      });
      if (!res.ok) return;

      var me = await res.json();
      if (me && me._id) localStorage.setItem('preecode_uid', me._id);

      var resolvedName = '';
      if (me && me.username) {
        resolvedName = me.username;
      } else if (me && me.email && me.email.indexOf('@') !== -1) {
        resolvedName = me.email.split('@')[0];
      }

      if (resolvedName) {
        localStorage.setItem('preecode_name', resolvedName);
        var el = document.getElementById('navUserName');
        if (el) el.textContent = extractFirstName(resolvedName);
        var av = document.getElementById('navAvatar');
        if (av) av.textContent = resolvedName.charAt(0).toUpperCase();
        var dav = document.querySelector('.topbar-dropdown-avatar');
        if (dav) dav.textContent = resolvedName.charAt(0).toUpperCase();
      }

      if (me && me.plan) localStorage.setItem('preecode_plan', me.plan);
      if (me && me.foundingBadgeLevel) localStorage.setItem('preecode_badge', me.foundingBadgeLevel);
      if (me && me.hasShared !== undefined) localStorage.setItem('preecode_shared', me.hasShared);
    } catch (e) {
      // Ignore hydrate errors and keep existing UI fallback
    }
  })();
})();
