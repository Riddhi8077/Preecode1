/* interview.js – shared helpers for interview pages */
// Pre-fill resumeId from URL param on setup page
(function () {
  var params = new URLSearchParams(window.location.search);
  var resumeId = params.get('resumeId');
  if (resumeId) {
    var cb = document.getElementById('useResume');
    if (cb) cb.checked = true;
    // Store for use during form submit
    window.__prefilledResumeId = resumeId;
  }
})();
