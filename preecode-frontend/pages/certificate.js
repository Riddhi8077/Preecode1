/* certificate.js – Populates the Certificate page */

(function () {
  var userId = localStorage.getItem('preecode_uid');
  if (!userId) return;

  var certCard = document.getElementById('certCard');
  var certLocked = document.getElementById('certLocked');

  Api.getEarlyAccessStatus()
    .then(function (data) {
      if (data.foundingBadgeLevel !== 'elite') {
        if (certCard) certCard.style.display = 'none';
        if (certLocked) certLocked.style.display = '';
        return;
      }

      // Populate certificate
      return Api.getUser(userId).then(function (user) {
        var nameEl = document.getElementById('certName');
        if (nameEl) nameEl.textContent = cap(user.username || 'Developer');

        var idEl = document.getElementById('certId');
        if (idEl) idEl.textContent = data.certificateId || '—';

        var dateEl = document.getElementById('certDate');
        if (dateEl) {
          var d = user.createdAt ? new Date(user.createdAt) : new Date();
          dateEl.textContent = d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
        }
      });
    })
    .catch(function (err) {
      console.error('Certificate load failed:', err);
      if (certCard) certCard.style.display = 'none';
      if (certLocked) {
        certLocked.style.display = '';
      }
    });

  // Download as PNG using html2canvas
  var downloadBtn = document.getElementById('downloadCert');
  if (downloadBtn) {
    downloadBtn.addEventListener('click', function () {
      var card = document.getElementById('certCard');
      if (!card) return;

      // Dynamically load html2canvas if needed
      if (typeof html2canvas === 'undefined') {
        var script = document.createElement('script');
        script.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js';
        script.onload = function () { renderAndDownload(card); };
        document.head.appendChild(script);
      } else {
        renderAndDownload(card);
      }
    });
  }

  function renderAndDownload(el) {
    html2canvas(el, {
      backgroundColor: '#111',
      scale: 2,
      useCORS: true,
    }).then(function (canvas) {
      var link = document.createElement('a');
      link.download = 'preecode-founding-certificate.png';
      link.href = canvas.toDataURL('image/png');
      link.click();
    });
  }

  // Share on LinkedIn
  var shareBtn = document.getElementById('shareLinkedInCert');
  if (shareBtn) {
    shareBtn.addEventListener('click', function () {
      var shareUrl = (typeof window !== 'undefined' && window.PREECODE_CONFIG && window.PREECODE_CONFIG.FRONTEND_URL)
        ? window.PREECODE_CONFIG.FRONTEND_URL
        : 'https://preecode.vercel.app';
      var text = 'I earned Founding Member status on Preecode — a developer practice tracking tool built into VS Code.\n\nJoin the early access:\n' + shareUrl;
      window.open('https://www.linkedin.com/sharing/share-offsite/?url=' + encodeURIComponent(shareUrl), '_blank', 'width=600,height=500');
    });
  }

  function cap(s) { return s.charAt(0).toUpperCase() + s.slice(1); }
})();
