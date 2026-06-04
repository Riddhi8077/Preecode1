/* problems.js – Populates the Problems page */

(function () {
  var userId = localStorage.getItem('preecode_uid');
  if (!userId) return;

  var allProblems = [];
  var currentPage = 1;
  var perPage = 20;
  var currentDiff = '';

  // ── Helpers ──
  function setText(id, val) {
    var el = document.getElementById(id);
    if (el) el.textContent = val;
  }

  function cap(s) { return s.charAt(0).toUpperCase() + s.slice(1); }
  function escHtml(s) { var d = document.createElement('div'); d.appendChild(document.createTextNode(s || '')); return d.innerHTML; }

  function emptyHtml(icon, title, desc, buttons) {
    var h = '<div class="prob-empty-state">' +
      '<div class="prob-empty-icon">' + icon + '</div>' +
      '<span class="prob-empty-title">' + title + '</span>' +
      '<span class="prob-empty-desc">' + desc + '</span>';
    if (buttons && buttons.length) {
      h += '<div class="prob-empty-actions">';
      buttons.forEach(function (b) {
        h += '<a href="' + b.href + '" class="' + (b.primary ? 'prob-empty-btn-primary' : 'prob-empty-btn-secondary') + '">' + b.label + '</a>';
      });
      h += '</div>';
    }
    return h + '</div>';
  }

  // ── Keyboard shortcut for search ──
  var searchInput = document.getElementById('searchInput');
  var searchClear = document.getElementById('searchClear');
  var shortcutEl = document.getElementById('searchShortcut');

  // Detect Mac for shortcut hint
  if (shortcutEl && navigator.platform && navigator.platform.indexOf('Mac') !== -1) {
    shortcutEl.textContent = '\u2318 K';
  }

  document.addEventListener('keydown', function (e) {
    if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
      e.preventDefault();
      if (searchInput) searchInput.focus();
    }
  });

  // ── Search events ──
  if (searchInput) {
    searchInput.addEventListener('input', function () {
      currentPage = 1;
      applyFilters();
      if (shortcutEl) shortcutEl.style.display = searchInput.value ? 'none' : '';
    });
    searchInput.addEventListener('focus', function () {
      if (shortcutEl) shortcutEl.style.display = 'none';
    });
    searchInput.addEventListener('blur', function () {
      if (shortcutEl && !searchInput.value) shortcutEl.style.display = '';
    });
  }
  if (searchClear && searchInput) {
    searchClear.addEventListener('click', function () {
      searchInput.value = '';
      searchInput.focus();
      if (shortcutEl) shortcutEl.style.display = '';
      currentPage = 1;
      applyFilters();
    });
  }

  // ── Difficulty chip buttons ──
  var chipBtns = document.querySelectorAll('.prob-chip[data-diff]');
  chipBtns.forEach(function (btn) {
    btn.addEventListener('click', function () {
      chipBtns.forEach(function (b) { b.classList.remove('active'); });
      btn.classList.add('active');
      currentDiff = btn.getAttribute('data-diff');
      currentPage = 1;
      applyFilters();
    });
  });

  // ── Fetch & init ──
  Api.getSubmissions(userId)
    .then(function (subs) {
      var map = {};
      (subs || []).forEach(function (s) {
        var key = s.problemName;
        if (!map[key]) {
          map[key] = { name: s.problemName, difficulty: s.difficulty || 'easy', tags: s.tags || [], solved: false };
        }
        if (s.status === 'accepted') map[key].solved = true;
      });
      allProblems = Object.keys(map).map(function (k) { return map[k]; });
      applyFilters();
    })
    .catch(function (err) { console.error('Problems load failed:', err); });

  // ── Apply filters & paginate ──
  function applyFilters() {
    var q = (searchInput ? searchInput.value : '').toLowerCase();

    var filtered = allProblems.filter(function (p) {
      if (q && p.name.toLowerCase().indexOf(q) === -1) return false;
      if (currentDiff && p.difficulty !== currentDiff) return false;
      return true;
    });

    render(filtered);
  }

  // ── Render table + pagination ──
  function render(problems) {
    var tbody = document.getElementById('problemsBody');
    var countEl = document.getElementById('problemCount');
    var paginationEl = document.getElementById('pagination');
    if (!tbody) return;
    if (countEl) countEl.textContent = problems.length;

    if (!problems.length) {
      var isFiltered = (searchInput && searchInput.value) || currentDiff;

      if (isFiltered) {
        tbody.innerHTML = '<tr><td colspan="5">' + emptyHtml(
          '<svg class="w-10 h-10" style="color:var(--text-faint)" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5"><path stroke-linecap="round" stroke-linejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z"/></svg>',
          'No matching problems',
          'Try adjusting your search or filters.',
          [{ label: 'Clear Filters', href: '#', primary: false }]
        ) + '</td></tr>';

        // Wire up clear filters
        var clearBtn = tbody.querySelector('.prob-empty-btn-secondary');
        if (clearBtn) {
          clearBtn.addEventListener('click', function (e) {
            e.preventDefault();
            if (searchInput) searchInput.value = '';
            currentDiff = '';
            chipBtns.forEach(function (b) { b.classList.remove('active'); });
            var allChip = document.querySelector('.prob-chip[data-diff=""]');
            if (allChip) allChip.classList.add('active');
            if (shortcutEl) shortcutEl.style.display = '';
            currentPage = 1;
            applyFilters();
          });
        }
      } else {
        tbody.innerHTML = '<tr><td colspan="5">' + emptyHtml(
          '<svg class="w-12 h-12" style="color:var(--accent);opacity:0.6" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5"><path stroke-linecap="round" stroke-linejoin="round" d="M17.25 6.75L22.5 12l-5.25 5.25m-10.5 0L1.5 12l5.25-5.25m7.5-3l-4.5 16.5"/></svg>',
          'Start your coding journey',
          'Solve your first problem to see it tracked here.',
          [{ label: 'Start Coding in VS Code', href: '#', primary: true }]
        ) + '</td></tr>';

        // Wire up Start Coding button → VSCode deep link
        var startCodingBtn = tbody.querySelector('.prob-empty-btn-primary');
        if (startCodingBtn) {
          startCodingBtn.addEventListener('click', function(e) {
            e.preventDefault();
            var token = localStorage.getItem('token') || '';
            var uri = 'vscode://preecode.preecode/auth' + (token ? '?token=' + encodeURIComponent(token) + '&source=problems' : '');
            window.location.href = uri;
            setTimeout(function() {
              if (document.hasFocus()) window.location.href = '/pages/dashboard.html';
            }, 2000);
          });
        }
      }

      if (paginationEl) paginationEl.style.display = 'none';
      return;
    }

    // Paginate
    var totalPages = Math.ceil(problems.length / perPage);
    if (currentPage > totalPages) currentPage = totalPages;
    var start = (currentPage - 1) * perPage;
    var pageProblems = problems.slice(start, start + perPage);

    tbody.innerHTML = '';
    pageProblems.forEach(function (p, i) {
      var dc = p.difficulty || 'easy';
      var tags = (p.tags || []).map(function (t) {
        return '<span class="prob-tag">' + escHtml(t) + '</span>';
      }).join(' ') || '<span class="text-txt-faint">&mdash;</span>';

      var statusHtml = p.solved
        ? '<span class="prob-status-solved"><svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M4.5 12.75l6 6 9-13.5"/></svg></span>'
        : '<span class="prob-status-unsolved"></span>';

      var tr = document.createElement('tr');
      tr.className = (p.solved ? 'prob-row solved' : 'prob-row') + ' prob-row-clickable';
      tr.style.cursor = 'pointer';
      tr.title = 'Start coding: ' + p.name;
      tr.innerHTML =
        '<td class="prob-td-num">' + (start + i + 1) + '</td>' +
        '<td class="prob-td-title">' + escHtml(p.name) + '</td>' +
        '<td><span class="diff-badge ' + dc + '">' + cap(dc) + '</span></td>' +
        '<td>' + tags + '</td>' +
        '<td class="prob-td-status">' + statusHtml + '</td>';

      // Click → launch VSCode with problem context
      tr.addEventListener('click', function() {
        var token = localStorage.getItem('token') || '';
        var uri = 'vscode://preecode.preecode/auth?token=' + encodeURIComponent(token) +
          '&problem=' + encodeURIComponent(p.name) +
          '&difficulty=' + encodeURIComponent(p.difficulty) +
          '&source=problems';
        window.location.href = uri;
        setTimeout(function() {
          if (document.hasFocus()) {
            if (window.preecodeNotify) window.preecodeNotify('Opening "' + p.name + '" in VS Code…', 'info');
          }
        }, 1500);
      });

      tbody.appendChild(tr);
    });

    // Pagination
    if (totalPages > 1 && paginationEl) {
      paginationEl.style.display = 'flex';
      buildPagination(paginationEl, totalPages, problems);
    } else if (paginationEl) {
      paginationEl.style.display = 'none';
    }
  }

  // ── Pagination controls ──
  function buildPagination(container, totalPages, problems) {
    container.innerHTML = '';

    // Prev button
    var prev = document.createElement('button');
    prev.innerHTML = '&lsaquo;';
    prev.disabled = currentPage === 1;
    prev.addEventListener('click', function () {
      if (currentPage > 1) { currentPage--; render(problems); scrollToTable(); }
    });
    container.appendChild(prev);

    // Page numbers
    for (var i = 1; i <= totalPages; i++) {
      (function (page) {
        var btn = document.createElement('button');
        btn.textContent = page;
        if (page === currentPage) btn.className = 'active';
        btn.addEventListener('click', function () {
          currentPage = page;
          render(problems);
          scrollToTable();
        });
        container.appendChild(btn);
      })(i);
    }

    // Next button
    var next = document.createElement('button');
    next.innerHTML = '&rsaquo;';
    next.disabled = currentPage === totalPages;
    next.addEventListener('click', function () {
      if (currentPage < totalPages) { currentPage++; render(problems); scrollToTable(); }
    });
    container.appendChild(next);
  }

  function scrollToTable() {
    var card = document.querySelector('.prob-table-card');
    if (card) card.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
})();
