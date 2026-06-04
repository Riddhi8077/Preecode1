/* early-access.js – Welcome modal, Share modal, Elite banner, Confetti */

(function () {
  if (!localStorage.getItem('token')) return;

  var SHARE_URL = (typeof window !== 'undefined' && window.PREECODE_CONFIG && window.PREECODE_CONFIG.FRONTEND_URL)
    ? window.PREECODE_CONFIG.FRONTEND_URL
    : 'https://preecode.vercel.app';
  var SHARE_TEXT = 'I\'m using Preecode to track my coding practice and consistency — directly inside VS Code.\n\nCurrently in early access. Join before public launch:\n' + SHARE_URL;

  // ── Welcome Modal (first-time only) ──
  function showWelcomeModal() {
    var isNew = localStorage.getItem('preecode_new');
    if (!isNew) return;
    localStorage.removeItem('preecode_new');

    var overlay = document.createElement('div');
    overlay.className = 'ea-overlay';
    overlay.innerHTML =
      '<div class="ea-modal">' +
        '<div class="ea-modal-icon">&#128075;</div>' +
        '<h2>Welcome to Preecode</h2>' +
        '<p>You\'ve been granted early access to Preecode Pro.</p>' +
        '<div class="ea-tag">Pro Access Active</div>' +
        '<p class="ea-tag-sub">Free during early access</p>' +
        '<button class="ea-btn" id="welcomeEnter">Enter Dashboard</button>' +
      '</div>';

    document.body.appendChild(overlay);
    requestAnimationFrame(function () {
      overlay.classList.add('open');
    });

    document.getElementById('welcomeEnter').addEventListener('click', function () {
      overlay.classList.remove('open');
      setTimeout(function () { overlay.remove(); }, 300);
    });
  }

  // ── Share Banner (basic users on dashboard) ──
  function showShareBanner() {
    var badge = localStorage.getItem('preecode_badge');
    var shared = localStorage.getItem('preecode_shared');
    if (badge === 'elite' || shared === 'true') return;

    var currentPage = window.location.pathname.split('/').pop().replace('.html', '');
    if (currentPage !== 'dashboard') return;

    var pageContent = document.querySelector('.page-content');
    if (!pageContent) return;

    var banner = document.createElement('div');
    banner.className = 'ea-banner opacity-0 animate-fade-in';
    banner.innerHTML =
      '<span class="ea-banner-text">You\'re part of the early access beta. Help spread the word and earn Founding Member status.</span>' +
      '<button class="ea-banner-btn" id="openShareModal">Become a Founding Member</button>';

    pageContent.insertBefore(banner, pageContent.firstChild);

    document.getElementById('openShareModal').addEventListener('click', function () {
      showShareModal();
    });
  }

  // ── Share Modal ──
  function showShareModal() {
    var overlay = document.createElement('div');
    overlay.className = 'ea-overlay';
    overlay.id = 'shareOverlay';
    overlay.innerHTML =
      '<div class="ea-modal">' +
        '<div class="ea-modal-icon"><svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" stroke-width="1.5"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z"/></svg></div>' +
        '<h2>Become a Founding Member</h2>' +
        '<p>Share Preecode to extend your Pro access and earn a permanent Founding Member badge.</p>' +
        '<ul class="ea-rewards">' +
          '<li><span class="ea-check">&#10003;</span> +1 Month Pro Access</li>' +
          '<li><span class="ea-check">&#10003;</span> Founding Member Badge</li>' +
          '<li><span class="ea-check">&#10003;</span> Verifiable Certificate</li>' +
          '<li><span class="ea-check">&#10003;</span> Early feature access</li>' +
        '</ul>' +
        '<div class="ea-share-btns">' +
          '<button class="ea-share-btn" id="shareLinkedIn">' +
            '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/></svg>' +
            'Share on LinkedIn' +
          '</button>' +
          '<button class="ea-share-btn" id="shareX">' +
            '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>' +
            'Share on X' +
          '</button>' +
          '<button class="ea-share-btn" id="shareCopy">' +
            '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg>' +
            'Copy Invite Link' +
          '</button>' +
        '</div>' +
        '<button style="position:absolute;top:16px;right:16px;background:none;border:none;color:var(--text-muted);font-size:18px;cursor:pointer;padding:4px;" id="shareClose">&times;</button>' +
      '</div>';

    document.body.appendChild(overlay);
    requestAnimationFrame(function () {
      overlay.classList.add('open');
    });

    // Close button
    document.getElementById('shareClose').addEventListener('click', function () {
      closeShareModal();
    });

    // LinkedIn share
    document.getElementById('shareLinkedIn').addEventListener('click', function () {
      window.open('https://www.linkedin.com/sharing/share-offsite/?url=' + encodeURIComponent(SHARE_URL), '_blank', 'width=600,height=500');
      claimShareReward();
    });

    // X share
    document.getElementById('shareX').addEventListener('click', function () {
      window.open('https://twitter.com/intent/tweet?text=' + encodeURIComponent(SHARE_TEXT), '_blank', 'width=600,height=500');
      claimShareReward();
    });

    // Copy link
    document.getElementById('shareCopy').addEventListener('click', function () {
      var btn = this;
      if (navigator.clipboard) {
        navigator.clipboard.writeText(SHARE_URL).then(function () {
          btn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:16px;height:16px"><path stroke-linecap="round" stroke-linejoin="round" d="M4.5 12.75l6 6 9-13.5"/></svg> Link Copied!';
          claimShareReward();
        });
      }
    });
  }

  function closeShareModal() {
    var overlay = document.getElementById('shareOverlay');
    if (overlay) {
      overlay.classList.remove('open');
      setTimeout(function () { overlay.remove(); }, 300);
    }
  }

  // ── Claim Share Reward ──
  var claiming = false;
  function claimShareReward() {
    if (claiming) return;
    if (localStorage.getItem('preecode_shared') === 'true') return;
    claiming = true;

    Api.confirmShare()
      .then(function (data) {
        localStorage.setItem('preecode_shared', 'true');
        localStorage.setItem('preecode_badge', data.foundingBadgeLevel || 'elite');

        closeShareModal();

        // Mini confetti burst
        fireConfetti();

        // Show success modal
        setTimeout(function () {
          showSuccessModal();
        }, 400);
      })
      .catch(function (err) {
        console.error('Share claim failed:', err);
        claiming = false;
      });
  }

  // ── Success Modal ──
  function showSuccessModal() {
    var overlay = document.createElement('div');
    overlay.className = 'ea-overlay';
    overlay.innerHTML =
      '<div class="ea-modal">' +
        '<div class="ea-modal-icon"><svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--success)" stroke-width="1.5"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg></div>' +
        '<h2>Founding Member Status Confirmed</h2>' +
        '<p>Your Pro access has been extended by 1 month.</p>' +
        '<div class="ea-tag">Founding Member</div>' +
        '<p class="ea-tag-sub">Certificate now available on your Profile</p>' +
        '<button class="ea-btn" id="successClose">Continue</button>' +
      '</div>';

    document.body.appendChild(overlay);
    requestAnimationFrame(function () {
      overlay.classList.add('open');
    });

    document.getElementById('successClose').addEventListener('click', function () {
      overlay.classList.remove('open');
      setTimeout(function () {
        overlay.remove();
        // Remove the banner if it exists
        var banner = document.querySelector('.ea-banner');
        if (banner) banner.remove();
        // Update navbar badge if present
        var navBadge = document.getElementById('navPlanBadge');
        if (navBadge) navBadge.textContent = 'Founding';
      }, 300);
    });
  }

  // ── Confetti (fires once) ──
  function fireConfetti() {
    var colors = ['#ff6b00', '#ffa116', '#34d399', '#60a5fa', '#f87171', '#fbbf24'];
    for (var i = 0; i < 20; i++) {
      var piece = document.createElement('div');
      piece.className = 'confetti-piece';
      piece.style.left = Math.random() * 100 + 'vw';
      piece.style.background = colors[Math.floor(Math.random() * colors.length)];
      piece.style.animationDelay = Math.random() * 0.8 + 's';
      piece.style.animationDuration = (1.5 + Math.random()) + 's';
      document.body.appendChild(piece);
      setTimeout(function (el) { el.remove(); }.bind(null, piece), 3500);
    }
  }

  // ── Init ──
  // Wait for DOM to be ready (layout.js injects topbar first)
  setTimeout(function () {
    showWelcomeModal();
    showShareBanner();
  }, 100);
})();
