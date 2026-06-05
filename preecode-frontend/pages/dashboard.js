/* dashboard.js – Dashboard V4: Modern Competitive Coding Platform */

(function () {
  'use strict';

  function isValidObjectId(value) {
    return /^[a-f\d]{24}$/i.test(String(value || ''));
  }

  function setupOpenVsCodeButton() {
    var btn = $('openVsCodeBtn');
    if (!btn) return;

    var token = localStorage.getItem('token') || '';
    if (!token) {
      btn.classList.add('is-disabled');
      btn.setAttribute('aria-disabled', 'true');
      btn.setAttribute('title', 'Login required to connect VS Code');
      btn.href = '/login.html';
      return;
    }

    var extensionUri = 'vscode://preecode.preecode/auth?token=' + encodeURIComponent(token) + '&source=dashboard';
    btn.href = extensionUri;
    btn.addEventListener('click', function () {
      try {
        btn.classList.add('is-launching');
        setTimeout(function () {
          btn.classList.remove('is-launching');
        }, 1800);
      } catch (e) {
        // Ignore UI-only state errors
      }
    });
  }

  // ── Utilities ──

  function escHtml(s) {
    var d = document.createElement('div');
    d.appendChild(document.createTextNode(s || ''));
    return d.innerHTML;
  }

  function cap(s) { return s ? s.charAt(0).toUpperCase() + s.slice(1) : ''; }

  function $(id) { return document.getElementById(id); }

  function setText(id, val) {
    var el = $(id);
    if (el) el.textContent = val;
  }

  function animateNumber(el, target, duration) {
    if (!el) return;
    duration = duration || 900;
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

  function animateProgress(id, pct, delay) {
    var el = $(id);
    if (!el) return;
    setTimeout(function () {
      el.style.width = Math.min(100, Math.max(0, pct)).toFixed(1) + '%';
    }, delay || 200);
  }

  function countThisWeek(subs) {
    var now = Date.now();
    var count = 0;
    (subs || []).forEach(function (s) {
      if (!s.submittedAt) return;
      var diff = Math.floor((now - new Date(s.submittedAt).getTime()) / 86400000);
      if (diff >= 0 && diff < 7) count++;
    });
    return count;
  }

  // ── Component: StatsCards (V4) ──

  function StatsCards(data) {
    var total = data.totalSolved || 0;
    var subs = data.recentSubmissions || [];
    var accepted = subs.filter(function (s) { return s.status === 'accepted'; }).length;
    var accuracy = subs.length ? Math.round((accepted / subs.length) * 100) : 0;
    var weekCount = countThisWeek(subs);

    // Total Solved
    animateNumber($('statTotal'), total);
    var totalTrend = $('totalTrend');
    if (totalTrend) {
      var span = totalTrend.querySelector('span');
      if (span) span.textContent = '+' + weekCount + ' this week';
      totalTrend.className = 'dash-v4-stat__trend ' + (weekCount > 0 ? 'up' : 'neutral');
      if (weekCount > 0) {
        totalTrend.insertAdjacentHTML('afterbegin', '<svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M5 2L8 6H2L5 2Z" fill="currentColor"/></svg>');
      }
    }
    animateProgress('totalProgress', Math.min(100, total * 2));

    // Accuracy Rate
    animateNumber($('statAccuracy'), accuracy);
    var accTrend = $('accuracyTrend');
    if (accTrend) {
      var accSpan = accTrend.querySelector('span');
      if (accSpan) accSpan.textContent = accepted + ' / ' + subs.length + ' accepted';
      accTrend.className = 'dash-v4-stat__trend ' + (accuracy >= 50 ? 'up' : accuracy > 0 ? 'down' : 'neutral');
    }
    animateProgress('accuracyProgress', accuracy);

    // Avg Solve Time (populated by PracticePanel)
    animateNumber($('statTime'), 0);

    // Placement Readiness - fetch from v2 API
    var readiness = 0;
    var readTrend = $('readinessTrend');
    // Try to load from v2 readiness API
    var uid = localStorage.getItem('preecode_uid');
    var tok = localStorage.getItem('token');
    if (uid && tok) {
      fetch(API_BASE + '/v2/readiness/' + uid, { headers: { Authorization: 'Bearer ' + tok } })
        .then(function(r) { return r.ok ? r.json() : null; })
        .then(function(rd) {
          if (!rd) return;
          animateNumber($('statReadiness'), rd.readinessPercent || 0);
          animateProgress('readinessProgress', rd.readinessPercent || 0);
          if (readTrend) {
            var rSpan = readTrend.querySelector('span');
            var pct = rd.readinessPercent || 0;
            if (rSpan) rSpan.textContent = pct >= 70 ? '🎯 Placement ready!' : pct >= 40 ? '📈 Good progress' : '🚀 Keep going!';
            readTrend.className = 'dash-v4-stat__trend ' + (pct >= 70 ? 'up' : 'neutral');
          }
        })
        .catch(function() {
          // fallback to local calc
          animateNumber($('statReadiness'), readiness);
          animateProgress('readinessProgress', readiness);
        });
    } else {
      animateNumber($('statReadiness'), readiness);
      if (readTrend) {
        var rSpan = readTrend.querySelector('span');
        if (rSpan) rSpan.textContent = 'Start solving to generate stats';
      }
      animateProgress('readinessProgress', readiness);
    }
  }

  // ── Component: LeaderboardCard (V4 – blurred preview) ──

  function LeaderboardCard(data) {
    var container = $('rankContent');
    if (!container) return;

    var total = data.totalSolved || 0;
    var subs = data.recentSubmissions || [];
    var accepted = subs.filter(function (s) { return s.status === 'accepted'; }).length;
    var accuracy = subs.length ? Math.round((accepted / subs.length) * 100) : 0;
    var solvedCount = Math.min(total, 3);

    if (total < 3) {
      // Locked: blurred leaderboard preview with overlay
      var dots = '';
      for (var i = 0; i < 3; i++) {
        dots += '<div class="dash-v4-rank-locked__dot' + (i < solvedCount ? ' filled' : '') + '"></div>';
      }

      container.innerHTML =
        '<div class="dash-v4-rank-locked">' +
          '<div class="dash-v4-rank-locked__preview">' +
            '<div class="dash-v4-rank-locked__preview-row">' +
              '<span class="dash-v4-rank-ghost-medal">&#x1F947;</span>' +
              '<div class="dash-v4-rank-ghost-avatar"></div>' +
              '<div class="dash-v4-rank-ghost-name" style="width:100px"></div>' +
              '<div class="dash-v4-rank-ghost-score"></div>' +
            '</div>' +
            '<div class="dash-v4-rank-locked__preview-row">' +
              '<span class="dash-v4-rank-ghost-medal">&#x1F948;</span>' +
              '<div class="dash-v4-rank-ghost-avatar"></div>' +
              '<div class="dash-v4-rank-ghost-name" style="width:85px"></div>' +
              '<div class="dash-v4-rank-ghost-score"></div>' +
            '</div>' +
            '<div class="dash-v4-rank-locked__preview-row">' +
              '<span class="dash-v4-rank-ghost-medal">&#x1F949;</span>' +
              '<div class="dash-v4-rank-ghost-avatar"></div>' +
              '<div class="dash-v4-rank-ghost-name" style="width:70px"></div>' +
              '<div class="dash-v4-rank-ghost-score"></div>' +
            '</div>' +
          '</div>' +
          '<div class="dash-v4-rank-locked__overlay">' +
            '<div class="dash-v4-rank-locked__badge">' +
              '<svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z"/></svg>' +
              'Unlock by solving 3 problems' +
            '</div>' +
            '<div class="dash-v4-rank-locked__progress">' +
              '<div class="dash-v4-rank-locked__dots">' + dots + '</div>' +
              '<span>' + solvedCount + ' / 3 solved</span>' +
            '</div>' +
          '</div>' +
        '</div>';
      return;
    }

    // Unlocked state
    var percentile = Math.min(99, Math.max(1, Math.round(accuracy * 0.4 + Math.min(total, 50) * 1.1)));
    var position = Math.max(1, Math.round(100 - percentile));

    container.innerHTML =
      '<div class="dash-v4-rank-unlocked">' +
        '<div class="dash-v4-rank-metric">' +
          '<div class="dash-v4-rank-metric__val" id="rankPercentile">0</div>' +
          '<div class="dash-v4-rank-metric__label">Percentile</div>' +
          '<div class="dash-v4-rank-bar"><div class="dash-v4-rank-bar__fill" id="rankBar" style="width:0%"></div></div>' +
        '</div>' +
        '<div class="dash-v4-rank-metric">' +
          '<div class="dash-v4-rank-metric__val">#' + position + '</div>' +
          '<div class="dash-v4-rank-metric__label">Weekly Position</div>' +
        '</div>' +
        '<div class="dash-v4-rank-metric">' +
          '<div class="dash-v4-rank-metric__val">' + total + '</div>' +
          '<div class="dash-v4-rank-metric__label">Problems This Period</div>' +
        '</div>' +
      '</div>';

    setTimeout(function () {
      animateNumber($('rankPercentile'), percentile);
      var bar = $('rankBar');
      if (bar) bar.style.width = percentile + '%';
    }, 300);
  }

  // ── Component: SkillHeatmap (V4 – horizontal bars) ──

  function SkillHeatmap(data) {
    var container = $('skillHeatmapContainer');
    if (!container) return;

    var total = data.totalSolved || 0;
    var weakTopics = data.weakTopics || [];

    var skills = [
      { name: 'Arrays', mastery: 0 },
      { name: 'Strings', mastery: 0 },
      { name: 'Dynamic Prog.', mastery: 0 },
      { name: 'Trees', mastery: 0 },
      { name: 'Graphs', mastery: 0 },
      { name: 'Recursion', mastery: 0 }
    ];

    weakTopics.forEach(function (wt) {
      var mastery = Math.max(0, Math.min(100, 100 - (wt.wrongCount || 0) * 10));
      for (var i = 0; i < skills.length; i++) {
        if (skills[i].name.toLowerCase().replace('.', '') === (wt.topic || '').toLowerCase()) {
          skills[i].mastery = mastery;
        }
      }
    });

    if (total >= 5) {
      skills.forEach(function (s) {
        if (s.mastery === 0) {
          s.mastery = Math.min(100, 40 + Math.round(Math.random() * 20));
        }
      });
    }

    if (total < 5) {
      // Locked: blurred bars + overlay
      var barsHtml = '<div class="dash-v4-skill-grid">';
      skills.forEach(function (s) {
        var fakePct = 20 + Math.round(Math.random() * 40);
        barsHtml +=
          '<div class="dash-v4-skill-row">' +
            '<span class="dash-v4-skill-name">' + escHtml(s.name) + '</span>' +
            '<div class="dash-v4-skill-track"><div class="dash-v4-skill-fill none" style="width:' + fakePct + '%"></div></div>' +
            '<span class="dash-v4-skill-pct">--%</span>' +
          '</div>';
      });
      barsHtml += '</div>';

      container.innerHTML =
        '<div class="dash-v4-skill-locked">' +
          '<div class="dash-v4-skill-locked__bars">' + barsHtml + '</div>' +
          '<div class="dash-v4-skill-locked__overlay">' +
            '<div class="dash-v4-skill-locked__icon">' +
              '<svg width="24" height="24" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5"><path stroke-linecap="round" stroke-linejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z"/></svg>' +
            '</div>' +
            '<div class="dash-v4-skill-locked__text">Skill heatmap unlocks after 5 solved problems</div>' +
          '</div>' +
        '</div>';
      return;
    }

    // Active: animated bars with tooltips
    var html = '<div class="dash-v4-skill-grid">';
    skills.forEach(function (s, idx) {
      var cls = s.mastery >= 70 ? 'high' : s.mastery >= 40 ? 'mid' : s.mastery > 0 ? 'low' : 'none';
      var tooltip = s.name + ': ' + s.mastery + '% mastery';
      html +=
        '<div class="dash-v4-skill-row" data-tooltip="' + escHtml(tooltip) + '">' +
          '<span class="dash-v4-skill-name">' + escHtml(s.name) + '</span>' +
          '<div class="dash-v4-skill-track"><div class="dash-v4-skill-fill ' + cls + '" id="skillBar' + idx + '"></div></div>' +
          '<span class="dash-v4-skill-pct">' + s.mastery + '%</span>' +
        '</div>';
    });
    html += '</div>';
    container.innerHTML = html;

    // Animate bars in
    skills.forEach(function (s, idx) {
      setTimeout(function () {
        var bar = $('skillBar' + idx);
        if (bar) bar.style.width = s.mastery + '%';
      }, 300 + idx * 100);
    });
  }

  // ── Component: StreakTracker (V4 – circular ring) ──

  function StreakTracker(data) {
    var streak = data.streak || 0;
    var bestStreak = data.bestStreak || streak;

    animateNumber($('currentStreak'), streak, 600);
    animateNumber($('bestStreak'), bestStreak, 600);

    // Topbar streak badge
    var topBadge = $('streakText');
    if (topBadge) topBadge.textContent = streak;

    // Circular progress ring (circumference = 2 * PI * 52 ~= 326.73)
    var circumference = 326.73;
    var maxStreak = 30; // full ring at 30 days
    var progress = Math.min(streak / maxStreak, 1);
    var offset = circumference * (1 - progress);

    var arc = $('streakArc');
    if (arc) {
      setTimeout(function () {
        arc.style.strokeDashoffset = offset;
      }, 400);
    }

    // Flame animation when streak > 0
    var flame = $('streakFlame');
    if (flame) {
      if (streak > 0) {
        flame.classList.add('active');
      }
    }

    // Milestones
    var milestones = document.querySelectorAll('.streak-milestone');
    milestones.forEach(function (m) {
      var target = parseInt(m.getAttribute('data-target'), 10);
      if (bestStreak >= target) {
        m.classList.add('reached');
      }
    });
  }

  // ── Component: SubmissionsTable (V4) ──

  var sortState = { key: 'date', dir: 'desc' };
  var rawSubs = [];

  function SubmissionsTable(subs) {
    rawSubs = subs;
    setText('subCount', subs.length);
    renderSubmissions(subs);

    // Column sorting
    var ths = document.querySelectorAll('.dash-v4-table thead th[data-sort]');
    ths.forEach(function (th) {
      th.addEventListener('click', function () {
        var key = th.getAttribute('data-sort');
        if (sortState.key === key) {
          sortState.dir = sortState.dir === 'asc' ? 'desc' : 'asc';
        } else {
          sortState.key = key;
          sortState.dir = 'asc';
        }
        renderSubmissions(sortSubs(rawSubs, sortState.key, sortState.dir));
      });
    });
  }

  function sortSubs(subs, key, dir) {
    var sorted = subs.slice();
    sorted.sort(function (a, b) {
      var va, vb;
      switch (key) {
        case 'name': va = (a.problemName || '').toLowerCase(); vb = (b.problemName || '').toLowerCase(); break;
        case 'difficulty': va = diffOrder(a.difficulty); vb = diffOrder(b.difficulty); break;
        case 'status': va = a.status || ''; vb = b.status || ''; break;
        case 'time': va = a.solveTime || 9999; vb = b.solveTime || 9999; break;
        case 'date': va = a.submittedAt || ''; vb = b.submittedAt || ''; break;
        default: va = ''; vb = '';
      }
      if (va < vb) return dir === 'asc' ? -1 : 1;
      if (va > vb) return dir === 'asc' ? 1 : -1;
      return 0;
    });
    return sorted;
  }

  function diffOrder(d) {
    if (d === 'easy') return 1;
    if (d === 'medium') return 2;
    if (d === 'hard') return 3;
    return 0;
  }

  function renderSubmissions(subs) {
    var tbody = $('submissionsBody');
    if (!tbody) return;

    if (!subs || !subs.length) {
      tbody.innerHTML = '<tr><td colspan="5">' +
        '<div class="dash-v4-empty">' +
          '<div class="dash-v4-empty__icon">' +
            '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path stroke-linecap="round" stroke-linejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z"/></svg>' +
          '</div>' +
          '<div class="dash-v4-empty__title">No submissions yet</div>' +
          '<div class="dash-v4-empty__desc">Solve your first problem in VS Code to see it tracked here.</div>' +
          '<a href="#" class="dash-v4-empty__cta" id="solveFirstProblemBtn">' +
            '<svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.348a1.125 1.125 0 010 1.971l-11.54 6.347a1.125 1.125 0 01-1.667-.985V5.653z"/></svg>' +
            'Solve First Problem' +
          '</a>' +
        '</div>' +
      '</td></tr>';

      // Wire "Solve First Problem" → VS Code deep link
      var solveBtn = $('solveFirstProblemBtn');
      if (solveBtn) {
        solveBtn.addEventListener('click', function (e) {
          e.preventDefault();
          var token = localStorage.getItem('token') || '';
          var uri = 'vscode://preecode.preecode/auth?token=' + encodeURIComponent(token) + '&source=dashboard&action=solve';
          window.location.href = uri;
          setTimeout(function () {
            if (document.hasFocus() && window.preecodeNotify) {
              window.preecodeNotify('Open VS Code and install the Preecode extension to start solving!', 'info');
            }
          }, 2000);
        });
      }
      return;
    }

    // Render as cards on mobile, table on desktop
    tbody.innerHTML = '';
    subs.forEach(function (sub) {
      var diffClass = sub.difficulty || 'easy';
      var statusClass = sub.status === 'accepted' ? 'accepted' : sub.status === 'tle' ? 'tle' : 'wrong';
      var statusLabel = sub.status === 'accepted' ? 'Accepted' : sub.status === 'tle' ? 'TLE' : 'Wrong Answer';
      var dateStr = sub.submittedAt ? sub.submittedAt.slice(0, 10) : '--';
      var runtime = sub.timeTaken || (sub.solveTime ? sub.solveTime + ' min' : '--');

      var tr = document.createElement('tr');
      tr.className = 'sub-row';
      tr.innerHTML =
        '<td data-label="Problem">' + escHtml(sub.problemName) + '</td>' +
        '<td data-label="Difficulty"><span class="diff-badge ' + diffClass + '">' + cap(diffClass) + '</span></td>' +
        '<td data-label="Status"><span class="status-badge ' + statusClass + '">' + statusLabel + '</span></td>' +
        '<td data-label="Time">' + runtime + '</td>' +
        '<td data-label="Date">' + dateStr + '</td>';
      tbody.appendChild(tr);
    });
  }

  // ── Component: PracticePanel (V4) ──

  function PracticePanel(practices) {
    var countEl = $('practiceCount');
    if (countEl) countEl.textContent = practices.length;

    var sessionsEl = $('practiceSessions');
    if (sessionsEl) sessionsEl.textContent = practices.length;

    var totalMinutes = 0;
    var validCount = 0;
    var lastSessionTime = null;

    (practices || []).forEach(function (p, i) {
      if (!p || !p.timeTaken) return;
      var parts = String(p.timeTaken).split(':');
      if (parts.length !== 2) return;
      var mm = parseInt(parts[0], 10);
      var ss = parseInt(parts[1], 10);
      if (isNaN(mm) || isNaN(ss)) return;
      var mins = mm + (ss / 60);
      totalMinutes += mins;
      validCount++;
      if (i === 0) lastSessionTime = mins;
    });

    var totalTimeEl = $('practiceTotalTime');
    if (totalTimeEl) {
      if (totalMinutes >= 60) {
        totalTimeEl.textContent = Math.round(totalMinutes / 60) + 'h ' + Math.round(totalMinutes % 60) + 'm';
      } else {
        totalTimeEl.textContent = Math.round(totalMinutes) + 'm';
      }
    }

    var lastEl = $('practiceLastSession');
    if (lastEl) {
      if (lastSessionTime !== null) {
        lastEl.textContent = Math.round(lastSessionTime) + ' min';
      } else {
        lastEl.textContent = '--';
      }
    }

    // Update Avg Solve Time stat card
    var avgMinutes = validCount ? Math.round(totalMinutes / validCount) : 0;
    animateNumber($('statTime'), avgMinutes);
    var timeTrend = $('timeTrend');
    if (timeTrend) {
      var span = timeTrend.querySelector('span');
      if (span) span.textContent = validCount ? 'From ' + validCount + ' sessions' : 'No sessions yet';
      timeTrend.className = 'dash-v4-stat__trend neutral';
    }
    animateProgress('timeProgress', avgMinutes > 0 ? Math.min(100, (30 / avgMinutes) * 100) : 0);
  }

  // ── Data Fetching & Orchestration ──

  function showDashboardErrorBanner() {
    var layout = document.querySelector('.dash-v4');
    if (!layout || layout.querySelector('.dash-v4-error-banner')) return;

    var banner = document.createElement('div');
    banner.className = 'dash-v4-error-banner';
    banner.textContent = 'Could not load dashboard data. Please try again later.';
    layout.prepend(banner);
  }

  function renderDashboardData(data) {
    StatsCards(data);
    LeaderboardCard(data);
    SkillHeatmap(data);
    StreakTracker(data);
    SubmissionsTable(data.recentSubmissions || []);
  }

  function resolveUserId() {
    var stored = localStorage.getItem('preecode_uid');
    if (isValidObjectId(stored)) {
      return Promise.resolve(stored);
    }

    return Api.getCurrentUser()
      .then(function (me) {
        var resolved = (me && (me._id || me.id)) || '';
        if (!isValidObjectId(resolved)) {
          throw new Error('Could not resolve authenticated user id');
        }
        localStorage.setItem('preecode_uid', resolved);
        if (me && me.username) localStorage.setItem('preecode_name', me.username);
        if (me && me.avatar) localStorage.setItem('preecode_avatar', me.avatar);
        return resolved;
      });
  }

  function loadDashboardData(userId) {
    return Api.getStats(userId).catch(function (err) {
      // Auto-recover once if a stale user id was cached in localStorage.
      return Api.getCurrentUser().then(function (me) {
        var resolved = (me && (me._id || me.id)) || '';
        if (!isValidObjectId(resolved) || resolved === userId) {
          throw err;
        }
        localStorage.setItem('preecode_uid', resolved);
        return Api.getStats(resolved);
      });
    });
  }

  resolveUserId()
    .then(function (userId) {
      return loadDashboardData(userId);
    })
    .then(function (data) {
      renderDashboardData(data);
      // Notify if total solved increased since last visit
      try {
        var lastTotal = parseInt(localStorage.getItem('preecode_last_total') || '0', 10);
        var newTotal  = data.totalSolved || 0;
        if (newTotal > lastTotal && lastTotal > 0 && window.preecodeNotify) {
          window.preecodeNotify('Dashboard updated - ' + newTotal + ' problems solved (+' + (newTotal - lastTotal) + ')!', 'success');
        }
        localStorage.setItem('preecode_last_total', newTotal);
      } catch(e) {}
    })
    .catch(function (err) {
      console.error('Dashboard load failed:', err);
      showDashboardErrorBanner();
    });

  Api.getPractice()
    .then(function (practices) {
      PracticePanel(practices || []);
    })
    .catch(function (err) {
      console.error('Practice data load failed:', err);
    });

  setupOpenVsCodeButton();

  // ── Start Practice Session → VS Code deep link ──
  var practiceBtn = document.getElementById('startPracticeSessionBtn');
  if (practiceBtn) {
    practiceBtn.addEventListener('click', function (e) {
      e.preventDefault();
      var token = localStorage.getItem('token') || '';
      var uri = 'vscode://preecode.preecode/auth?token=' + encodeURIComponent(token) + '&source=dashboard&action=practice';
      window.location.href = uri;
      // Fallback: if VS Code doesn't open in 2s, show a notification and stay
      setTimeout(function () {
        if (document.hasFocus() && window.preecodeNotify) {
          window.preecodeNotify('VS Code not detected. Install the Preecode extension to start practicing!', 'warning');
        }
      }, 2000);
    });
  }

  // ── Mock notification on first dashboard load (dev/test) ──
  // setTimeout(function () {
  //   if (window.preecodeNotify) {
  //     window.preecodeNotify('🎉 Welcome back! Your dashboard is up to date.', 'success');
  //   }
  // }, 1500);

})();
