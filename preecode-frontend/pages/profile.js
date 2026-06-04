/* profile.js – Profile page (Apple-style minimal V3) */

(function () {
  'use strict';

  var userId = localStorage.getItem('preecode_uid');
  var userName = localStorage.getItem('preecode_name') || 'User';
  if (!userId) return;

  var displayName = userName.charAt(0).toUpperCase() + userName.slice(1);

  // ── Utilities ──

  function $(id) { return document.getElementById(id); }

  function setText(id, val) {
    var el = $(id);
    if (el) el.textContent = val;
  }

  function cap(s) { return s ? s.charAt(0).toUpperCase() + s.slice(1) : ''; }
  function escHtml(s) { var d = document.createElement('div'); d.appendChild(document.createTextNode(s || '')); return d.innerHTML; }

  function animateNumber(el, target, duration) {
    if (!el) return;
    duration = duration || 800;
    target = parseInt(target, 10) || 0;
    if (target === 0) { el.textContent = '0'; return; }
    var start = null;
    function ease(t) { return 1 - Math.pow(1 - t, 3); }
    function step(ts) {
      if (!start) start = ts;
      var p = Math.min((ts - start) / duration, 1);
      el.textContent = Math.round(ease(p) * target);
      if (p < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  }

  function setBar(id, value, max) {
    var el = $(id);
    if (el && max > 0) {
      setTimeout(function () {
        el.style.width = ((value / max) * 100).toFixed(1) + '%';
      }, 150);
    }
  }

  // ── Avatar + Name ──

  var avatar = $('profileAvatar');
  if (avatar) avatar.textContent = displayName.charAt(0);
  setText('profileName', displayName);

  // ── Fetch User Profile ──

  Api.getUser(userId)
    .then(function (user) {
      if (user.username) {
        setText('profileName', cap(user.username));
        var av = $('profileAvatar');
        if (av) av.textContent = user.username.charAt(0).toUpperCase();
      }

      // Subtitle: "Member since Jan 2024"
      if (user.createdAt) {
        var d = new Date(user.createdAt);
        var months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
        setText('profileSubtitle', 'Member since ' + months[d.getMonth()] + ' ' + d.getFullYear());
      }
    })
    .catch(function () {});

  // ── Fetch Stats ──

  Api.getStats(userId)
    .then(function (data) {
      var total = data.totalSolved || 0;
      var easy = data.easySolved || 0;
      var medium = data.mediumSolved || 0;
      var hard = data.hardSolved || 0;
      var points = data.points || (easy * 1 + medium * 3 + hard * 5);
      var streak = data.streak || 0;
      var subs = data.recentSubmissions || [];

      // Accuracy from recent submissions
      var accepted = subs.filter(function (s) { return s.status === 'accepted'; }).length;
      var accuracy = subs.length ? Math.round((accepted / subs.length) * 100) : 0;

      // Primary metrics
      animateNumber($('profileTotal'), total);
      animateNumber($('profileAccuracy'), accuracy);
      animateNumber($('profileStreak'), streak);

      // Stat card progress bars
      var totalBarEl = $('profileTotalBar');
      if (totalBarEl) {
        setTimeout(function () { totalBarEl.style.width = Math.min(100, total * 2).toFixed(1) + '%'; }, 200);
      }
      var accBarEl = $('profileAccuracyBar');
      if (accBarEl) {
        setTimeout(function () { accBarEl.style.width = accuracy + '%'; }, 200);
      }
      var streakBarEl = $('profileStreakBar');
      if (streakBarEl) {
        setTimeout(function () { streakBarEl.style.width = Math.min(100, streak * (100 / 30)).toFixed(1) + '%'; }, 200);
      }

      // Difficulty breakdown
      animateNumber($('pEasyCount'), easy);
      animateNumber($('pMedCount'), medium);
      animateNumber($('pHardCount'), hard);
      setBar('pEasyBar', easy, total || 1);
      setBar('pMedBar', medium, total || 1);
      setBar('pHardBar', hard, total || 1);

      // Badge progress
      updateBadgeBar('badgeFirstBar', total, 1);
      updateBadgeBar('badge7day', streak, 7);
      updateBadgeBar('badge50', total, 50);
      updateBadgeBar('badgeHard', hard, 10);

      // Unlock badges
      unlockBadge('firstSolve', total >= 1);
      unlockBadge('7day', streak >= 7);
      unlockBadge('50problems', total >= 50);
      unlockBadge('hardMaster', hard >= 10);

      // Show "View All" button if any extra badges have progress
      if (total > 0) {
        var viewAllBtn = $('viewAllBadges');
        if (viewAllBtn) viewAllBtn.style.display = '';
      }

      // Rank / Level
      updateRank(points);
    })
    .catch(function (err) {
      console.error('Profile stats load failed:', err);
    });

  // ── Badge Helpers ──

  function updateBadgeBar(barId, current, goal) {
    var bar = $(barId);
    if (!bar) return;
    var pct = Math.min((current / goal) * 100, 100);
    setTimeout(function () { bar.style.width = pct.toFixed(1) + '%'; }, 200);
  }

  function unlockBadge(badgeName, earned) {
    var card = document.querySelector('[data-badge="' + badgeName + '"]');
    if (!card) return;
    if (earned) {
      card.classList.remove('locked');
      card.classList.add('unlocked');
    }
  }

  // ── View All Badges Toggle ──

  var viewAllBtn = $('viewAllBadges');
  if (viewAllBtn) {
    var expanded = false;
    viewAllBtn.addEventListener('click', function () {
      expanded = !expanded;
      var extras = document.querySelectorAll('.prof-badge-extra');
      extras.forEach(function (el) {
        el.style.display = expanded ? '' : 'none';
      });
      viewAllBtn.textContent = expanded ? 'Show Less' : 'View All';
    });
  }

  // ── Rank System ──

  function updateRank(points) {
    var ranks = [
      { name: 'Beginner',     min: 0,    max: 49,       level: 1 },
      { name: 'Apprentice',   min: 50,   max: 149,      level: 2 },
      { name: 'Intermediate', min: 150,  max: 299,      level: 3 },
      { name: 'Advanced',     min: 300,  max: 499,      level: 4 },
      { name: 'Expert',       min: 500,  max: 999,      level: 5 },
      { name: 'Master',       min: 1000, max: Infinity,  level: 6 }
    ];

    var rank = ranks[0];
    for (var i = 0; i < ranks.length; i++) {
      if (points >= ranks[i].min) rank = ranks[i];
    }

    setText('rankName', 'Level ' + rank.level + ' \u2014 ' + rank.name);
    var nextMax = rank.max === Infinity ? rank.min + 500 : rank.max + 1;
    var progress = ((points - rank.min) / (nextMax - rank.min)) * 100;
    setText('rankXP', points + ' / ' + nextMax + ' XP');

    var rankLevel = $('rankLevel');
    if (rankLevel) rankLevel.textContent = rank.level;

    var rankBar = $('rankBar');
    if (rankBar) {
      setTimeout(function () {
        rankBar.style.width = Math.min(progress, 100).toFixed(1) + '%';
      }, 300);
    }
  }

  // ── Tab Switching ──
  var tabs = document.querySelectorAll('.prof-tab');
  var panels = document.querySelectorAll('.prof-tab-panel');
  var submissionsLoaded = false;

  tabs.forEach(function(tab) {
    tab.addEventListener('click', function() {
      tabs.forEach(function(t) { t.classList.remove('active'); });
      panels.forEach(function(p) { p.classList.remove('active'); });
      tab.classList.add('active');
      var target = tab.getAttribute('data-tab');
      var panel = document.getElementById('tab' + target.charAt(0).toUpperCase() + target.slice(1));
      if (panel) panel.classList.add('active');

      if (target === 'submissions' && !submissionsLoaded) {
        submissionsLoaded = true;
        loadSubmissions();
      }
    });
  });

  function loadSubmissions() {
    var tbody = document.getElementById('profileSubmissionsBody');
    if (!tbody) return;

    Api.getSubmissions(userId)
      .then(function(subs) {
        if (!subs || !subs.length) {
          tbody.innerHTML = '<tr><td colspan="5" class="text-center py-6 text-txt-muted">No submissions yet. Start solving problems!</td></tr>';
          return;
        }
        tbody.innerHTML = '';
        subs.slice(0, 50).forEach(function(s) {
          var dc = s.difficulty || 'easy';
          var statusCls = s.status === 'accepted' ? 'color:#4ade80' : 'color:#f87171';
          var statusLabel = s.status === 'accepted' ? '✓ Accepted' : '✗ Wrong';
          var date = s.submittedAt ? new Date(s.submittedAt).toLocaleDateString() : '--';
          var tr = document.createElement('tr');
          tr.innerHTML =
            '<td>' + escHtml(s.problemName || '') + '</td>' +
            '<td><span class="diff-badge ' + dc + '">' + cap(dc) + '</span></td>' +
            '<td style="' + statusCls + ';font-weight:500">' + statusLabel + '</td>' +
            '<td>' + (s.timeTaken || '--') + '</td>' +
            '<td>' + date + '</td>';
          tbody.appendChild(tr);
        });
      })
      .catch(function() {
        tbody.innerHTML = '<tr><td colspan="5" class="text-center py-6 text-txt-muted">Failed to load submissions.</td></tr>';
      });
  }

  // ── Edit Profile Modal ──

  var editModal = $('editProfileModal');
  var editBtn = $('editProfileBtn');
  var closeBtn = $('closeEditModal');
  var cancelBtn = $('cancelEditModal');
  var editForm = $('editProfileForm');
  var usernameInput = $('editUsername');
  var avatarInput = $('editAvatar');

  function openEditModal() {
    if (usernameInput) usernameInput.value = userName;
    if (avatarInput) avatarInput.value = localStorage.getItem('preecode_avatar') || '';
    if (editModal) editModal.classList.remove('hidden');
  }

  function closeEditModalFn() {
    if (editModal) editModal.classList.add('hidden');
  }

  if (editBtn) editBtn.addEventListener('click', openEditModal);
  if (closeBtn) closeBtn.addEventListener('click', closeEditModalFn);
  if (cancelBtn) cancelBtn.addEventListener('click', closeEditModalFn);

  if (editForm) {
    editForm.addEventListener('submit', async function (e) {
      e.preventDefault();
      var newUsername = usernameInput ? usernameInput.value.trim() : '';
      var newAvatar = avatarInput ? avatarInput.value.trim() : '';

      if (!newUsername) {
        alert('Username cannot be empty');
        return;
      }

      try {
        var result = await Api.updateProfile({
          username: newUsername,
          avatar: newAvatar || undefined
        });

        if (result && result.user) {
          localStorage.setItem('preecode_name', result.user.username);
          if (result.user.avatar) {
            localStorage.setItem('preecode_avatar', result.user.avatar);
          }
          setText('profileName', cap(result.user.username));
          var av = $('profileAvatar');
          if (av) av.textContent = result.user.username.charAt(0).toUpperCase();
          closeEditModalFn();
          location.reload();
        }
      } catch (err) {
        alert('Failed to update profile: ' + (err.message || 'Unknown error'));
      }
    });
  }

  if (editModal) {
    editModal.addEventListener('click', function (e) {
      if (e.target === editModal) closeEditModalFn();
    });
  }

})();
