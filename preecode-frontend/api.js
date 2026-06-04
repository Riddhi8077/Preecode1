/* api.js – Preecode API helper */

function resolveApiBase() {
  // Runtime override for deployments that inject config before api.js
  if (typeof window !== 'undefined' && window.PREECODE_CONFIG && window.PREECODE_CONFIG.BACKEND_URL) {
    return String(window.PREECODE_CONFIG.BACKEND_URL).replace(/\/$/, '') + '/api';
  }

  // Local development default
  if (typeof window !== 'undefined') {
    var host = window.location.hostname;
    if (host === 'localhost' || host === '127.0.0.1') {
      return 'http://localhost:5001/api';
    }
  }

  // Production default
  return 'https://preecode-backend.onrender.com/api';
}

var API_BASE = resolveApiBase();

var Api = {
  // Login user
  login: function (email, password) {
    return fetch(API_BASE + '/users/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ email: email, password: password }),
    }).then(function (res) {
      if (!res.ok) return res.json().then(function (d) { throw new Error(d.message || 'Login failed'); });
      return res.json();
    }).then(function (data) {
      if (data.token) localStorage.setItem('token', data.token);
      if (data.avatar) localStorage.setItem('preecode_avatar', data.avatar);
      return data;
    }).catch(function (err) {
      if (err instanceof TypeError) throw new Error('Network error — could not reach server');
      throw err;
    });
  },

  // Register a new user
  register: function (username, email, password) {
    return fetch(API_BASE + '/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ username: username, email: email, password: password }),
    }).then(function (res) {
      if (!res.ok) return res.json().then(function (d) { throw new Error(d.message || 'Registration failed'); });
      return res.json();
    }).then(function (data) {
      if (data.token) localStorage.setItem('token', data.token);
      if (data.avatar) localStorage.setItem('preecode_avatar', data.avatar);
      return data;
    }).catch(function (err) {
      if (err instanceof TypeError) throw new Error('Network error — could not reach server');
      throw err;
    });
  },

  // Get user profile by ID
  getUser: function (userId) {
    return fetch(API_BASE + '/users/' + userId, {
      headers: Api._authHeaders(),
      credentials: 'include',
    }).then(function (res) {
      if (!res.ok) return res.json().then(function (d) { throw new Error(d.message || 'Failed to fetch user'); });
      return res.json();
    });
  },

  // Get dashboard stats + recent submissions
  getStats: function (userId) {
    return fetch(API_BASE + '/users/stats/' + userId, {
      headers: Api._authHeaders(),
      credentials: 'include',
    }).then(function (res) {
      if (!res.ok) return res.json().then(function (d) { throw new Error(d.message || 'Failed to fetch stats'); });
      return res.json();
    });
  },

  // Get currently authenticated user profile
  getCurrentUser: function () {
    return fetch(API_BASE + '/users/me', {
      headers: Api._authHeaders(),
      credentials: 'include',
    }).then(function (res) {
      if (!res.ok) return res.json().then(function (d) { throw new Error(d.message || 'Failed to fetch current user'); });
      return res.json();
    });
  },

  // Add a submission
  addSubmission: function (userId, problemName, difficulty, status) {
    return fetch(API_BASE + '/submissions', {
      method: 'POST',
      headers: Api._authHeaders({ 'Content-Type': 'application/json' }),
      credentials: 'include',
      body: JSON.stringify({
        userId: userId,
        problemName: problemName,
        difficulty: difficulty,
        status: status,
      }),
    }).then(function (res) {
      if (!res.ok) return res.json().then(function (d) { throw new Error(d.message || 'Failed to add submission'); });
      return res.json();
    });
  },

  // Get all submissions for a user
  getSubmissions: function (userId) {
    return fetch(API_BASE + '/submissions/' + userId, {
      headers: Api._authHeaders(),
      credentials: 'include',
    }).then(function (res) {
      if (!res.ok) return res.json().then(function (d) { throw new Error(d.message || 'Failed to fetch submissions'); });
      return res.json();
    });
  },

  // Get practice sessions for a user
  getPractice: function () {
    return fetch(API_BASE + '/practice', {
      headers: Api._authHeaders(),
      credentials: 'include',
    }).then(function (res) {
      if (!res.ok) return res.json().then(function (d) { throw new Error(d.message || 'Failed to fetch practice data'); });
      return res.json();
    });
  },

  // AI Chat
  chatWithAI: function (message, context) {
    return fetch(API_BASE + '/ai/chat', {
      method: 'POST',
      headers: Api._authHeaders({ 'Content-Type': 'application/json' }),
      credentials: 'include',
      body: JSON.stringify({ message: message, context: context }),
    }).then(function (res) {
      if (!res.ok) {
        return res.json().then(function (d) {
          var error = new Error(d.message || 'AI chat failed');
          // Handle auth errors
          if (res.status === 401) {
            console.warn('[API] Authentication failed, clearing token');
            localStorage.removeItem('token');
            localStorage.removeItem('preecode_avatar');
          }
          throw error;
        });
      }
      return res.json();
    });
  },

  // AI Hint
  getAIHint: function (problemDescription, language) {
    return fetch(API_BASE + '/ai/hint', {
      method: 'POST',
      headers: Api._authHeaders({ 'Content-Type': 'application/json' }),
      credentials: 'include',
      body: JSON.stringify({ problemDescription: problemDescription, language: language }),
    }).then(function (res) {
      if (!res.ok) return res.json().then(function (d) { throw new Error(d.message || 'AI hint failed'); });
      return res.json();
    });
  },

  // AI Code Review
  reviewCode: function (code, language, problemDescription) {
    return fetch(API_BASE + '/ai/review', {
      method: 'POST',
      headers: Api._authHeaders({ 'Content-Type': 'application/json' }),
      credentials: 'include',
      body: JSON.stringify({ code: code, language: language, problemDescription: problemDescription }),
    }).then(function (res) {
      if (!res.ok) return res.json().then(function (d) { throw new Error(d.message || 'AI review failed'); });
      return res.json();
    });
  },

  // Get early access status
  getEarlyAccessStatus: function () {
    return fetch(API_BASE + '/early-access/status', {
      headers: Api._authHeaders(),
      credentials: 'include',
    }).then(function (res) {
      if (!res.ok) return res.json().then(function (d) { throw new Error(d.message || 'Failed to fetch early access status'); });
      return res.json();
    });
  },

  // Confirm share for elite status
  confirmShare: function () {
    return fetch(API_BASE + '/early-access/confirm-share', {
      method: 'POST',
      headers: Api._authHeaders({ 'Content-Type': 'application/json' }),
      credentials: 'include',
      body: JSON.stringify({}),
    }).then(function (res) {
      if (!res.ok) return res.json().then(function (d) { throw new Error(d.message || 'Failed to confirm share'); });
      return res.json();
    });
  },

  // Update user profile
  updateProfile: function (data) {
    return fetch(API_BASE + '/users/profile/update', {
      method: 'PUT',
      headers: Api._authHeaders({ 'Content-Type': 'application/json' }),
      credentials: 'include',
      body: JSON.stringify(data),
    }).then(function (res) {
      if (!res.ok) return res.json().then(function (d) { throw new Error(d.message || 'Failed to update profile'); });
      return res.json();
    });
  },

  // Change password
  changePassword: function (data) {
    return fetch(API_BASE + '/users/change-password', {
      method: 'PUT',
      headers: Api._authHeaders({ 'Content-Type': 'application/json' }),
      credentials: 'include',
      body: JSON.stringify(data),
    }).then(function (res) {
      if (!res.ok) return res.json().then(function (d) { throw new Error(d.message || 'Failed to change password'); });
      return res.json();
    });
  },

  // Delete account
  deleteAccount: function () {
    return fetch(API_BASE + '/users/account', {
      method: 'DELETE',
      headers: Api._authHeaders(),
      credentials: 'include',
    }).then(function (res) {
      if (!res.ok) return res.json().then(function (d) { throw new Error(d.message || 'Failed to delete account'); });
      return res.json();
    });
  },

  // Update notification preferences
  updateNotificationPrefs: function (prefs) {
    return fetch(API_BASE + '/users/notifications', {
      method: 'PUT',
      headers: Api._authHeaders({ 'Content-Type': 'application/json' }),
      credentials: 'include',
      body: JSON.stringify(prefs),
    }).then(function (res) {
      if (!res.ok) return res.json().then(function (d) { throw new Error(d.message || 'Failed to update preferences'); });
      return res.json();
    });
  },

  // Logout all devices
  logoutAllDevices: function () {
    return fetch(API_BASE + '/users/logout-all', {
      method: 'POST',
      headers: Api._authHeaders({ 'Content-Type': 'application/json' }),
      credentials: 'include',
      body: JSON.stringify({}),
    }).then(function (res) {
      if (!res.ok) return res.json().then(function (d) { throw new Error(d.message || 'Failed to logout all devices'); });
      return res.json();
    });
  },

  // Upload avatar image
  uploadAvatar: function (file) {
    var formData = new FormData();
    formData.append('avatar', file);
    return fetch(API_BASE + '/upload/avatar', {
      method: 'POST',
      headers: Api._authHeaders(),
      credentials: 'include',
      body: formData,
    }).then(function (res) {
      if (!res.ok) return res.json().then(function (d) { throw new Error(d.message || 'Failed to upload avatar'); });
      return res.json();
    });
  },

  // Forgot password - request OTP
  forgotPassword: function (email) {
    return fetch(API_BASE + '/users/forgot-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ email: email }),
    }).then(function (res) {
      if (!res.ok) return res.json().then(function (d) { throw new Error(d.message || 'Failed to send OTP'); });
      return res.json();
    });
  },

  // Verify OTP
  verifyOtp: function (email, otp) {
    return fetch(API_BASE + '/users/verify-otp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ email: email, otp: otp }),
    }).then(function (res) {
      if (!res.ok) return res.json().then(function (d) { throw new Error(d.message || 'Invalid OTP'); });
      return res.json();
    });
  },

  // Reset password with token
  resetPassword: function (email, resetToken, newPassword) {
    return fetch(API_BASE + '/users/reset-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ email: email, resetToken: resetToken, newPassword: newPassword }),
    }).then(function (res) {
      if (!res.ok) return res.json().then(function (d) { throw new Error(d.message || 'Failed to reset password'); });
      return res.json();
    });
  },

  // Build headers with Authorization token
  _authHeaders: function (extra) {
    var headers = {};
    var token = localStorage.getItem('token');
    
    // Check if token exists and is not empty
    if (token && token.trim().length > 0) {
      headers['Authorization'] = 'Bearer ' + token;
    } else {
      console.warn('[API] No valid token found in localStorage');
    }
    
    if (extra) {
      for (var key in extra) headers[key] = extra[key];
    }
    return headers;
  },
};
