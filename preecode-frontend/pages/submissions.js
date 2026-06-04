/* submissions.js – Populates the Submissions page */

(function () {
  var userId = localStorage.getItem('preecode_uid');
  if (!userId) return;

  var allSubs = [];
  var PAGE_SIZE = 15;
  var currentPage = 1;

  function emptyHtml(icon, title, desc, btnText, btnHref) {
    var h = '<div class="empty-state">' +
      '<span class="empty-icon">' + icon + '</span>' +
      '<span class="empty-title">' + title + '</span>' +
      '<span class="empty-desc">' + desc + '</span>';
    if (btnText && btnHref) {
      h += '<a href="' + btnHref + '" class="empty-cta">' + btnText + '</a>';
    }
    return h + '</div>';
  }

  function animateNumber(el, target, duration) {
    if (!el) return;
    duration = duration || 600;
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

  Api.getSubmissions(userId)
    .then(function (subs) {
      allSubs = subs || [];
      updateStats(allSubs);
      render(allSubs);
    })
    .catch(function (err) { console.error('Submissions load failed:', err); });

  var statusFilter = document.getElementById('statusFilter');
  if (statusFilter) {
    statusFilter.addEventListener('change', function () {
      var val = statusFilter.value;
      statusFilter.classList.toggle('active', !!val);
      currentPage = 1;
      var filtered = !val ? allSubs : allSubs.filter(function (s) { return s.status === val; });
      updateStats(filtered);
      render(filtered);
    });
  }

  function updateStats(subs) {
    var total = subs.length;
    var accepted = subs.filter(function (s) { return s.status === 'accepted'; }).length;
    var wrong = total - accepted;
    var rate = total > 0 ? Math.round((accepted / total) * 100) : 0;

    animateNumber(document.getElementById('statTotalSubs'), total);
    animateNumber(document.getElementById('statAccepted'), accepted);
    animateNumber(document.getElementById('statWrong'), wrong);

    var rateEl = document.getElementById('statAccRate');
    if (rateEl) rateEl.textContent = rate + '%';
  }

  function render(subs) {
    var tbody   = document.getElementById('submissionsBody');
    var countEl = document.getElementById('subCount');
    if (!tbody) return;
    if (countEl) countEl.textContent = subs.length;

    if (!subs.length) {
      tbody.innerHTML = '<tr><td colspan="5">' + emptyHtml('&#128203;', 'No submissions yet', 'Your submission history will appear here once you start solving problems.', 'Browse Problems', '/pages/problems.html') + '</td></tr>';
      renderPagination(0);
      return;
    }

    var totalPages = Math.ceil(subs.length / PAGE_SIZE);
    if (currentPage > totalPages) currentPage = totalPages;
    var start = (currentPage - 1) * PAGE_SIZE;
    var pageSubs = subs.slice(start, start + PAGE_SIZE);

    tbody.innerHTML = '';
    pageSubs.forEach(function (sub, i) {
      var dc = sub.difficulty || 'easy';
      var sc = sub.status === 'accepted' ? 'accepted' : 'wrong';
      var sl = sub.status === 'accepted' ? 'Accepted' : 'Wrong';
      var ds = sub.submittedAt ? sub.submittedAt.slice(0, 10) : '';
      var topic = sub.topic || 'General';
      var timeTaken = sub.timeTaken || '00:00';

      var tr = document.createElement('tr');
      tr.innerHTML =
        '<td>' + (start + i + 1) + '</td>' +
        '<td>' + escHtml(sub.problemName) + '</td>' +
        '<td><span class="text-xs bg-zinc-700 text-zinc-200 px-2 py-1 rounded">' + escHtml(topic) + '</span></td>' +
        '<td><span class="diff-badge ' + dc + '">' + cap(dc) + '</span></td>' +
        '<td><span class="diff-badge ' + sc + '">' + sl + '</span></td>' +
        '<td><span class="text-xs text-zinc-400">' + timeTaken + '</span></td>' +
        '<td>' + ds + '</td>';
      tbody.appendChild(tr);
    });

    renderPagination(totalPages);
  }

  function renderPagination(totalPages) {
    var container = document.getElementById('pagination');
    if (!container) return;

    if (totalPages <= 1) {
      container.innerHTML = '';
      return;
    }

    container.innerHTML = '';

    // Prev button
    var prev = document.createElement('button');
    prev.innerHTML = '&lsaquo;';
    prev.disabled = currentPage <= 1;
    prev.addEventListener('click', function () {
      if (currentPage > 1) { currentPage--; rerender(); }
    });
    container.appendChild(prev);

    // Page buttons
    for (var p = 1; p <= totalPages; p++) {
      var btn = document.createElement('button');
      btn.textContent = p;
      if (p === currentPage) btn.className = 'active';
      btn.setAttribute('data-page', p);
      btn.addEventListener('click', function () {
        currentPage = parseInt(this.getAttribute('data-page'), 10);
        rerender();
      });
      container.appendChild(btn);
    }

    // Next button
    var next = document.createElement('button');
    next.innerHTML = '&rsaquo;';
    next.disabled = currentPage >= totalPages;
    next.addEventListener('click', function () {
      if (currentPage < totalPages) { currentPage++; rerender(); }
    });
    container.appendChild(next);
  }

  function rerender() {
    var val = statusFilter ? statusFilter.value : '';
    var filtered = !val ? allSubs : allSubs.filter(function (s) { return s.status === val; });
    render(filtered);
  }

  function cap(s) { return s.charAt(0).toUpperCase() + s.slice(1); }
  function escHtml(s) { var d = document.createElement('div'); d.appendChild(document.createTextNode(s || '')); return d.innerHTML; }
})();
