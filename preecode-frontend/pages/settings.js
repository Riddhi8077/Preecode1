/* settings.js – Settings page logic */

(function () {
  var userId = localStorage.getItem('preecode_uid');
  if (!userId) return;

  // ── Toast utility ──
  function showToast(message, type) {
    type = type || 'success';
    var toast = document.createElement('div');
    toast.className = 'settings-toast ' + type;
    toast.textContent = message;
    document.body.appendChild(toast);
    requestAnimationFrame(function () {
      toast.classList.add('visible');
    });
    setTimeout(function () {
      toast.classList.remove('visible');
      setTimeout(function () {
        if (toast.parentNode) toast.parentNode.removeChild(toast);
      }, 300);
    }, 3000);
  }

  // ── Section navigation ──
  var navItems = document.querySelectorAll('.settings-nav-item');
  var sections = document.querySelectorAll('.settings-section');

  function switchSection(id) {
    navItems.forEach(function (btn) {
      btn.classList.toggle('active', btn.getAttribute('data-section') === id);
    });
    sections.forEach(function (sec) {
      sec.classList.toggle('active', sec.id === 'section-' + id);
    });
    history.replaceState(null, '', '#' + id);
  }

  navItems.forEach(function (btn) {
    btn.addEventListener('click', function () {
      switchSection(btn.getAttribute('data-section'));
    });
  });

  // Check URL hash for direct linking
  var hash = (location.hash || '').replace('#', '');
  if (hash && document.getElementById('section-' + hash)) {
    switchSection(hash);
  }

  // ── Account section ──
  var accountForm = document.getElementById('accountForm');
  var settFirstName = document.getElementById('settFirstName');
  var settLastName = document.getElementById('settLastName');
  var settUsername = document.getElementById('settUsername');
  var settEmail = document.getElementById('settEmail');
  var settingsAvatar = document.getElementById('settingsAvatar');
  var settingsAvatarName = document.getElementById('settingsAvatarName');
  var avatarUploadBtn = document.getElementById('avatarUploadBtn');
  var avatarUploadOverlay = document.getElementById('avatarUploadOverlay');
  var avatarResetBtn = document.getElementById('avatarResetBtn');
  var avatarFileInput = document.getElementById('avatarFileInput');
  var avatarSpinner = document.getElementById('avatarSpinner');
  var pendingAvatarUrl = null;
  var userEmail = '';

  // Load user data
  Api.getUser(userId)
    .then(function (user) {
      if (!user) return;

      var uname = user.username || '';
      var email = user.email || '';
      userEmail = email;
      var firstName = user.firstName || '';
      var lastName = user.lastName || '';

      // If no firstName/lastName, try to split username
      if (!firstName && uname) {
        var parts = uname.replace(/([a-z])([A-Z])/g, '$1 $2').split(/\s+/);
        firstName = parts[0] || '';
        lastName = parts.slice(1).join(' ') || '';
      }

      settFirstName.value = firstName;
      settLastName.value = lastName;
      settUsername.value = uname;
      settEmail.value = email;

      var displayName = uname || email.split('@')[0] || 'User';
      settingsAvatarName.textContent = displayName;

      var initial = displayName.charAt(0).toUpperCase();
      settingsAvatar.textContent = initial;

      if (user.avatar) {
        settingsAvatar.style.backgroundImage = 'url(' + user.avatar + ')';
        settingsAvatar.textContent = '';
      }
    })
    .catch(function () {
      // Silently fail — form remains with defaults
    });

  // Username validation
  settUsername.addEventListener('input', function () {
    var val = settUsername.value;
    var valid = /^[a-zA-Z0-9_]{0,20}$/.test(val);
    settUsername.style.borderColor = val.length > 0 && !valid ? '#f87171' : '';
  });

  // Avatar upload - clicking on overlay or button
  function triggerAvatarUpload() {
    avatarFileInput.click();
  }

  avatarUploadBtn.addEventListener('click', triggerAvatarUpload);
  if (avatarUploadOverlay) {
    avatarUploadOverlay.addEventListener('click', triggerAvatarUpload);
  }

  // Reset to email avatar
  if (avatarResetBtn) {
    avatarResetBtn.addEventListener('click', function () {
      if (!userEmail) {
        showToast('Email not available', 'error');
        return;
      }
      var emailAvatar = 'https://unavatar.io/google/' + encodeURIComponent(userEmail);
      pendingAvatarUrl = emailAvatar;
      settingsAvatar.style.backgroundImage = 'url(' + emailAvatar + ')';
      settingsAvatar.textContent = '';
      showToast('Email avatar selected. Save changes to apply.');
    });
  }

  // Avatar file upload with Cloudinary
  avatarFileInput.addEventListener('change', function () {
    var file = avatarFileInput.files[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      showToast('Image must be under 5MB', 'error');
      return;
    }

    // Show spinner
    if (avatarSpinner) avatarSpinner.classList.remove('hidden');

    Api.uploadAvatar(file)
      .then(function (result) {
        pendingAvatarUrl = result.url;
        settingsAvatar.style.backgroundImage = 'url(' + result.url + ')';
        settingsAvatar.textContent = '';
        showToast('Photo uploaded. Save changes to apply.');
      })
      .catch(function (err) {
        showToast(err.message || 'Failed to upload image', 'error');
      })
      .finally(function () {
        if (avatarSpinner) avatarSpinner.classList.add('hidden');
        avatarFileInput.value = '';
      });
  });

  // Account form submit
  accountForm.addEventListener('submit', function (e) {
    e.preventDefault();

    var uname = settUsername.value.trim();
    if (uname && !/^[a-zA-Z0-9_]{3,20}$/.test(uname)) {
      showToast('Username must be 3–20 chars (letters, numbers, underscores)', 'error');
      return;
    }

    var data = {
      username: uname,
      firstName: settFirstName.value.trim(),
      lastName: settLastName.value.trim(),
    };
    if (pendingAvatarUrl) data.avatar = pendingAvatarUrl;

    Api.updateProfile(data)
      .then(function (result) {
        if (uname) {
          localStorage.setItem('preecode_name', uname);
        }
        if (result.user && result.user.avatar) {
          localStorage.setItem('preecode_avatar', result.user.avatar);
        }
        pendingAvatarUrl = null;
        showToast('Profile updated successfully');
      })
      .catch(function (err) {
        showToast(err.message || 'Failed to update profile', 'error');
      });
  });

  // ── Appearance section ──
  var themeSelector = document.getElementById('settingsThemeSelector');
  if (themeSelector) {
    var themeButtons = themeSelector.querySelectorAll('.theme-option');

    function syncThemeUI() {
      var current = (typeof PreeCodeTheme !== 'undefined' && PreeCodeTheme.get) ? PreeCodeTheme.get() : 'dark';
      themeButtons.forEach(function (btn) {
        var val = btn.getAttribute('data-theme-value');
        btn.classList.toggle('active', val === current);
        btn.style.borderColor = val === current ? 'var(--accent)' : '';
      });
    }

    syncThemeUI();

    themeButtons.forEach(function (btn) {
      btn.addEventListener('click', function () {
        var val = btn.getAttribute('data-theme-value');
        if (typeof PreeCodeTheme !== 'undefined' && PreeCodeTheme.set) {
          PreeCodeTheme.set(val);
        }
        syncThemeUI();
        showToast('Theme updated');
      });
    });
  }

  // ── Security section ──
  var passwordForm = document.getElementById('passwordForm');
  var pwError = document.getElementById('pwError');

  passwordForm.addEventListener('submit', function (e) {
    e.preventDefault();
    pwError.textContent = '';

    var currentPw = document.getElementById('settCurrentPw').value;
    var newPw = document.getElementById('settNewPw').value;
    var confirmPw = document.getElementById('settConfirmPw').value;

    if (!currentPw) {
      pwError.textContent = 'Please enter your current password.';
      return;
    }
    if (newPw.length < 6) {
      pwError.textContent = 'New password must be at least 6 characters.';
      return;
    }
    if (newPw !== confirmPw) {
      pwError.textContent = 'Passwords do not match.';
      return;
    }

    Api.changePassword({ currentPassword: currentPw, newPassword: newPw })
      .then(function () {
        showToast('Password changed successfully');
        passwordForm.reset();
      })
      .catch(function (err) {
        pwError.textContent = err.message || 'Failed to change password';
      });
  });

  // Logout all devices
  var logoutAllBtn = document.getElementById('logoutAllBtn');
  if (logoutAllBtn) {
    logoutAllBtn.addEventListener('click', function () {
      logoutAllBtn.disabled = true;
      logoutAllBtn.textContent = 'Logging out...';

      Api.logoutAllDevices()
        .then(function () {
          showToast('All other sessions have been logged out');
          logoutAllBtn.disabled = false;
          logoutAllBtn.textContent = 'Logout All Devices';
        })
        .catch(function (err) {
          showToast(err.message || 'Failed to logout devices', 'error');
          logoutAllBtn.disabled = false;
          logoutAllBtn.textContent = 'Logout All Devices';
        });
    });
  }

  // ── Notifications section ──
  var notifKeys = ['notifEmail', 'notifStreak', 'notifAnnounce', 'notifMarketing'];
  var notifDebounce = null;

  // Load saved prefs
  try {
    var savedPrefs = JSON.parse(localStorage.getItem('preecode_notif_prefs') || '{}');
    notifKeys.forEach(function (key) {
      var el = document.getElementById(key);
      if (el && savedPrefs[key] !== undefined) {
        el.checked = savedPrefs[key];
      }
    });
  } catch (e) {
    // ignore
  }

  function saveNotifPrefs() {
    var prefs = {};
    notifKeys.forEach(function (key) {
      var el = document.getElementById(key);
      if (el) prefs[key] = el.checked;
    });
    localStorage.setItem('preecode_notif_prefs', JSON.stringify(prefs));

    // Attempt to sync to server (silently fail if endpoint missing)
    Api.updateNotificationPrefs(prefs).catch(function () {});
  }

  notifKeys.forEach(function (key) {
    var el = document.getElementById(key);
    if (el) {
      el.addEventListener('change', function () {
        clearTimeout(notifDebounce);
        notifDebounce = setTimeout(function () {
          saveNotifPrefs();
          showToast('Preferences saved');
        }, 500);
      });
    }
  });

  // ── Danger Zone ──
  var deleteAccountBtn = document.getElementById('deleteAccountBtn');
  var deleteModal = document.getElementById('deleteModal');
  var deleteConfirmInput = document.getElementById('deleteConfirmInput');
  var confirmDeleteBtn = document.getElementById('confirmDelete');
  var cancelDeleteBtn = document.getElementById('cancelDelete');

  if (deleteAccountBtn && deleteModal) {
    deleteAccountBtn.addEventListener('click', function () {
      deleteModal.classList.remove('hidden');
      deleteConfirmInput.value = '';
      confirmDeleteBtn.disabled = true;
      confirmDeleteBtn.classList.add('opacity-50', 'cursor-not-allowed');
      confirmDeleteBtn.classList.remove('hover:bg-red-500/30');
    });

    cancelDeleteBtn.addEventListener('click', function () {
      deleteModal.classList.add('hidden');
    });

    deleteModal.addEventListener('click', function (e) {
      if (e.target === deleteModal) {
        deleteModal.classList.add('hidden');
      }
    });

    deleteConfirmInput.addEventListener('input', function () {
      var valid = deleteConfirmInput.value.trim() === 'DELETE';
      confirmDeleteBtn.disabled = !valid;
      confirmDeleteBtn.classList.toggle('opacity-50', !valid);
      confirmDeleteBtn.classList.toggle('cursor-not-allowed', !valid);
      confirmDeleteBtn.classList.toggle('hover:bg-red-500/30', valid);
      confirmDeleteBtn.classList.toggle('cursor-pointer', valid);
    });

    confirmDeleteBtn.addEventListener('click', function () {
      if (confirmDeleteBtn.disabled) return;
      confirmDeleteBtn.disabled = true;
      confirmDeleteBtn.textContent = 'Deleting...';

      Api.deleteAccount()
        .then(function () {
          localStorage.clear();
          window.location.href = '/index.html';
        })
        .catch(function (err) {
          showToast(err.message || 'Failed to delete account', 'error');
          confirmDeleteBtn.disabled = false;
          confirmDeleteBtn.textContent = 'Delete Forever';
        });
    });
  }
})();
