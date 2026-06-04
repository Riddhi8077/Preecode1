const vscode = acquireVsCodeApi();

// DOM Elements
const signInTab = document.getElementById('signInTab');
const signUpTab = document.getElementById('signUpTab');
const signInForm = document.getElementById('signInForm');
const signUpForm = document.getElementById('signUpForm');
const signInEmail = document.getElementById('signInEmail');
const signInPassword = document.getElementById('signInPassword');
const signInPasswordToggle = document.getElementById('signInPasswordToggle');
const signInSubmit = document.getElementById('signInSubmit');
const signUpEmail = document.getElementById('signUpEmail');
const signUpUsername = document.getElementById('signUpUsername');
const signUpPassword = document.getElementById('signUpPassword');
const signUpPasswordToggle = document.getElementById('signUpPasswordToggle');
const signUpSubmit = document.getElementById('signUpSubmit');
const closeBtn = document.getElementById('closeBtn');
const googleBtn = document.getElementById('googleBtn');
const errorContainer = document.getElementById('errorContainer');
const loadingContainer = document.getElementById('loadingContainer');

// Forgot password elements
const forgotPasswordLink = document.getElementById('forgotPasswordLink');
const forgotStep1 = document.getElementById('forgotStep1');
const forgotStep2 = document.getElementById('forgotStep2');
const forgotStep3 = document.getElementById('forgotStep3');
const forgotEmail = document.getElementById('forgotEmail');
const forgotOtp = document.getElementById('forgotOtp');
const newPassword = document.getElementById('newPassword');
const confirmPassword = document.getElementById('confirmPassword');
const newPasswordToggle = document.getElementById('newPasswordToggle');
const forgotStep1Submit = document.getElementById('forgotStep1Submit');
const forgotStep2Submit = document.getElementById('forgotStep2Submit');
const forgotStep3Submit = document.getElementById('forgotStep3Submit');
const backToSignIn1 = document.getElementById('backToSignIn1');
const resendOtp = document.getElementById('resendOtp');

// Forgot password state
let forgotState = { email: '', resetToken: '' };
let activeRequestTimeout = null;

function setControlsDisabled(disabled) {
  signInSubmit.disabled = disabled;
  signUpSubmit.disabled = disabled;
  googleBtn.disabled = disabled;
  if (forgotStep1Submit) forgotStep1Submit.disabled = disabled;
  if (forgotStep2Submit) forgotStep2Submit.disabled = disabled;
  if (forgotStep3Submit) forgotStep3Submit.disabled = disabled;
}

function clearRequestTimeout() {
  if (activeRequestTimeout) {
    window.clearTimeout(activeRequestTimeout);
    activeRequestTimeout = null;
  }
}

function startRequestTimeout() {
  clearRequestTimeout();
  // Recover UI controls if extension/backend message is delayed or dropped.
  activeRequestTimeout = window.setTimeout(() => {
    hideLoading();
    setControlsDisabled(false);
  }, 15000);
}

// Tab Management
function switchTab(tabName) {
  const forms = document.querySelectorAll('.auth-form');
  const tabs = document.querySelectorAll('.tab-btn');

  forms.forEach((form) => {
    form.classList.remove('active');
  });

  tabs.forEach((tab) => {
    tab.classList.remove('active');
  });

  // Toggle forgot-mode class on body to hide divider and Google button
  if (tabName.startsWith('forgot')) {
    document.body.classList.add('forgot-mode');
  } else {
    document.body.classList.remove('forgot-mode');
  }

  if (tabName === 'signin') {
    signInForm.classList.add('active');
    signInTab.classList.add('active');
  } else if (tabName === 'signup') {
    signUpForm.classList.add('active');
    signUpTab.classList.add('active');
  } else if (tabName === 'forgot1') {
    forgotStep1.classList.add('active');
  } else if (tabName === 'forgot2') {
    forgotStep2.classList.add('active');
  } else if (tabName === 'forgot3') {
    forgotStep3.classList.add('active');
  }

  // Clear error messages when switching tabs
  hideError();
  hideLoading();
}

signInTab.addEventListener('click', () => switchTab('signin'));
signUpTab.addEventListener('click', () => switchTab('signup'));

// Forgot password navigation
if (forgotPasswordLink) {
  forgotPasswordLink.addEventListener('click', (e) => {
    e.preventDefault();
    switchTab('forgot1');
  });
}

if (backToSignIn1) {
  backToSignIn1.addEventListener('click', (e) => {
    e.preventDefault();
    switchTab('signin');
  });
}

// Password Toggle Functionality
function togglePasswordVisibility(inputElement, toggleButton) {
  const isPassword = inputElement.type === 'password';
  inputElement.type = isPassword ? 'text' : 'password';
  toggleButton.textContent = isPassword ? '🙈' : '👁';
}

signInPasswordToggle.addEventListener('click', (e) => {
  e.preventDefault();
  togglePasswordVisibility(signInPassword, signInPasswordToggle);
});

signUpPasswordToggle.addEventListener('click', (e) => {
  e.preventDefault();
  togglePasswordVisibility(signUpPassword, signUpPasswordToggle);
});

if (newPasswordToggle) {
  newPasswordToggle.addEventListener('click', (e) => {
    e.preventDefault();
    togglePasswordVisibility(newPassword, newPasswordToggle);
  });
}

// Error and Loading Message Handlers
function showError(message) {
  errorContainer.textContent = message;
  errorContainer.classList.remove('hidden');
  loadingContainer.classList.add('hidden');
}

function hideError() {
  errorContainer.classList.add('hidden');
  errorContainer.textContent = '';
}

function showLoading(message) {
  loadingContainer.innerHTML = `<div class="loading-spinner"></div><span>${message}</span>`;
  loadingContainer.classList.remove('hidden');
  errorContainer.classList.add('hidden');
}

function hideLoading() {
  loadingContainer.classList.add('hidden');
  loadingContainer.innerHTML = '';
}

function showSuccess(message) {
  errorContainer.style.background = 'rgba(74, 222, 128, 0.1)';
  errorContainer.style.borderColor = 'rgba(74, 222, 128, 0.3)';
  errorContainer.style.color = '#4ade80';
  errorContainer.textContent = message;
  errorContainer.classList.remove('hidden');
  loadingContainer.classList.add('hidden');
}

function resetErrorStyles() {
  errorContainer.style.background = '';
  errorContainer.style.borderColor = '';
  errorContainer.style.color = '';
}

// Form Validation
function validateEmail(email) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

function validateSignInForm() {
  hideError();
  resetErrorStyles();

  const email = signInEmail.value.trim();
  const password = signInPassword.value;

  if (!email) {
    showError('Email is required.');
    signInEmail.classList.add('error');
    return false;
  }

  if (!validateEmail(email)) {
    showError('Invalid email address.');
    signInEmail.classList.add('error');
    return false;
  }

  if (!password) {
    showError('Password is required.');
    signInPassword.classList.add('error');
    return false;
  }

  signInEmail.classList.remove('error');
  signInPassword.classList.remove('error');
  return true;
}

function validateSignUpForm() {
  hideError();
  resetErrorStyles();

  const email = signUpEmail.value.trim();
  const username = signUpUsername.value.trim();
  const password = signUpPassword.value;

  if (!email) {
    showError('Email is required.');
    signUpEmail.classList.add('error');
    return false;
  }

  if (!validateEmail(email)) {
    showError('Invalid email address.');
    signUpEmail.classList.add('error');
    return false;
  }

  if (!username) {
    showError('Username is required.');
    signUpUsername.classList.add('error');
    return false;
  }

  if (!password) {
    showError('Password is required.');
    signUpPassword.classList.add('error');
    return false;
  }

  if (password.length < 6) {
    showError('Password must be at least 6 characters.');
    signUpPassword.classList.add('error');
    return false;
  }

  signUpEmail.classList.remove('error');
  signUpUsername.classList.remove('error');
  signUpPassword.classList.remove('error');
  return true;
}

// Form Submission
signInForm.addEventListener('submit', (e) => {
  e.preventDefault();

  if (!validateSignInForm()) {
    return;
  }

  const email = signInEmail.value.trim();
  const password = signInPassword.value;

  // Disable submit button
  setControlsDisabled(true);
  startRequestTimeout();

  vscode.postMessage({
    type: 'loginWithEmail',
    payload: { email, password }
  });
});

signUpForm.addEventListener('submit', (e) => {
  e.preventDefault();

  if (!validateSignUpForm()) {
    return;
  }

  const email = signUpEmail.value.trim();
  const username = signUpUsername.value.trim();
  const password = signUpPassword.value;

  // Disable submit button
  setControlsDisabled(true);
  startRequestTimeout();

  vscode.postMessage({
    type: 'signupWithEmail',
    payload: { email, username, password }
  });
});

// Forgot password forms
if (forgotStep1) {
  forgotStep1.addEventListener('submit', (e) => {
    e.preventDefault();
    hideError();
    resetErrorStyles();

    const email = forgotEmail.value.trim();
    if (!email || !validateEmail(email)) {
      showError('Please enter a valid email address.');
      return;
    }

    forgotState.email = email;
    setControlsDisabled(true);
    startRequestTimeout();

    vscode.postMessage({
      type: 'forgotPassword',
      payload: { email }
    });
  });
}

if (forgotStep2) {
  forgotStep2.addEventListener('submit', (e) => {
    e.preventDefault();
    hideError();
    resetErrorStyles();

    const otp = forgotOtp.value.trim();
    if (!otp || otp.length !== 6) {
      showError('Please enter the 6-digit code.');
      return;
    }

    setControlsDisabled(true);
    startRequestTimeout();

    vscode.postMessage({
      type: 'verifyOtp',
      payload: { email: forgotState.email, otp }
    });
  });
}

if (forgotStep3) {
  forgotStep3.addEventListener('submit', (e) => {
    e.preventDefault();
    hideError();
    resetErrorStyles();

    const pwd = newPassword.value;
    const confirmPwd = confirmPassword.value;

    if (!pwd || pwd.length < 6) {
      showError('Password must be at least 6 characters.');
      return;
    }

    if (pwd !== confirmPwd) {
      showError('Passwords do not match.');
      return;
    }

    setControlsDisabled(true);
    startRequestTimeout();

    vscode.postMessage({
      type: 'resetPassword',
      payload: {
        email: forgotState.email,
        resetToken: forgotState.resetToken,
        newPassword: pwd
      }
    });
  });
}

// Resend OTP
if (resendOtp) {
  resendOtp.addEventListener('click', (e) => {
    e.preventDefault();
    hideError();
    resetErrorStyles();

    vscode.postMessage({
      type: 'forgotPassword',
      payload: { email: forgotState.email }
    });
  });
}

// Auto-format OTP input
if (forgotOtp) {
  forgotOtp.addEventListener('input', () => {
    forgotOtp.value = forgotOtp.value.replace(/\D/g, '').slice(0, 6);
  });
}

// Google OAuth
googleBtn.addEventListener('click', () => {
  setControlsDisabled(true);
  startRequestTimeout();
  vscode.postMessage({ type: 'googleLogin' });
});

// Close Button
closeBtn.addEventListener('click', () => {
  vscode.postMessage({ type: 'closePanel' });
});

// Handle messages from extension
window.addEventListener('message', (event) => {
  const message = event.data;

  if (message.type === 'loading') {
    showLoading(message.loadingMessage || 'Loading...');
    setControlsDisabled(true);
    startRequestTimeout();
  } else if (message.type === 'error') {
    clearRequestTimeout();
    hideLoading();
    resetErrorStyles();
    showError(message.error);
    // Clear password fields on error
    signInPassword.value = '';
    signUpPassword.value = '';
    signInPassword.classList.remove('error');
    signUpPassword.classList.remove('error');
    // Re-enable submit buttons
    setControlsDisabled(false);
  } else if (message.type === 'success') {
    clearRequestTimeout();
    hideLoading();
    hideError();
    // Disable all controls briefly before closing
    signInSubmit.disabled = true;
    signUpSubmit.disabled = true;
    googleBtn.disabled = true;
    signInEmail.disabled = true;
    signInPassword.disabled = true;
    signUpEmail.disabled = true;
    signUpUsername.disabled = true;
    signUpPassword.disabled = true;
  } else if (message.type === 'otpSent') {
    clearRequestTimeout();
    hideLoading();
    showSuccess(message.message || 'Verification code sent!');
    setTimeout(() => {
      hideError();
      resetErrorStyles();
      switchTab('forgot2');
    }, 1500);
    setControlsDisabled(false);
    if (resendOtp) resendOtp.style.pointerEvents = 'auto'; // Enable resend link
  } else if (message.type === 'otpVerified') {
    clearRequestTimeout();
    hideLoading();
    forgotState.resetToken = message.resetToken;
    showSuccess(message.message || 'Code verified!');
    setTimeout(() => {
      hideError();
      resetErrorStyles();
      switchTab('forgot3');
    }, 1500);
    // Re-enable all buttons for next step
    setControlsDisabled(false);
  } else if (message.type === 'passwordReset') {
    clearRequestTimeout();
    hideLoading();
    showSuccess(message.message || 'Password reset successfully!');
    // Re-enable button immediately before switching
    setControlsDisabled(false);
    setTimeout(() => {
      hideError();
      resetErrorStyles();
      forgotState = { email: '', resetToken: '' };
      if (forgotOtp) forgotOtp.value = '';
      if (newPassword) newPassword.value = '';
      if (confirmPassword) confirmPassword.value = '';
      switchTab('signin');
    }, 2000);
  }
});

// Focus management - clear error on input focus
[signInEmail, signInPassword, signUpEmail, signUpUsername, signUpPassword].forEach((input) => {
  if (input) {
    input.addEventListener('focus', () => {
      input.classList.remove('error');
    });

    input.addEventListener('input', () => {
      if (input.classList.contains('error')) {
        hideError();
        resetErrorStyles();
      }
    });
  }
});

console.log('Preecode login panel initialized');
