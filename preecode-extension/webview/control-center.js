const vscode = acquireVsCodeApi();
console.log('Preecode webview initialized');

const state = {
  chatDockHeight: 168,
  mode: 'collapsed',
  isAuthenticated: false,
  userResizedChat: false,
  editorLanguage: 'plaintext',
  practiceDifficulty: 'easy',
  onboarding: {
    isActive: false,
    currentStep: 'none',
    isCompleted: false
  }
};

let lastChatSignature = '';
let panelNarrowHintSent = false;
const PANEL_NARROW_HINT_THRESHOLD = 250;

const userName = document.getElementById('userName');
const syncStatus = document.getElementById('syncStatus');
const profileAvatar = document.getElementById('profileAvatar');
const profileTrigger = document.getElementById('profileTrigger');
const profileMenu = document.getElementById('profileMenu');
const profileLogoutBtn = document.getElementById('profileLogoutBtn');
const compactTimer = document.getElementById('compactTimer');
const practiceQuestion = document.getElementById('practiceQuestion');
const practiceDifficulty = document.getElementById('practiceDifficulty');
const practiceAttempts = document.getElementById('practiceAttempts');
const runStatus = document.getElementById('runStatus');
const practiceTimerValue = document.getElementById('practiceTimerValue');
const solutionTimerValue = document.getElementById('solutionTimerValue');
const practiceStatePrimary = document.getElementById('practiceStatePrimary');
const practiceStateSecondary = document.getElementById('practiceStateSecondary');
const toolsFlow = document.getElementById('toolsFlow');
const practiceFlow = document.getElementById('practiceFlow');
const solutionFlow = document.getElementById('solutionFlow');
const chatFeed = document.getElementById('chatFeed');
const chatInput = document.getElementById('chatInput');
const sendBtn = document.getElementById('sendBtn');
const newChatBtn = document.getElementById('newChatBtn');
const loginBtn = document.getElementById('loginBtn');
const chatDock = document.getElementById('chatDock');
const chatGrip = document.getElementById('chatGrip');
const problemInCodeLine = document.getElementById('problemInCodeLine');
const expectedFixLine = document.getElementById('expectedFixLine');
const problemInCodeLabel = document.getElementById('problemInCodeLabel');
const expectedFixLabel = document.getElementById('expectedFixLabel');
const explainQuestionBtn = document.getElementById('explainQuestionBtn');
const explainSelectionBtn = document.getElementById('explainSelectionBtn');
const showHintBtn = document.getElementById('showHintBtn');
const showSolutionBtn = document.getElementById('showSolutionBtn');
const explainSolutionBtn = document.getElementById('explainSolutionBtn');
const evaluateCodeBtn = document.getElementById('evaluateCodeBtn');
const reviewCodeBtn = document.getElementById('reviewCodeBtn');
const debugPanel = document.getElementById('debugPanel');
const debugRangeForm = document.getElementById('debugRangeForm');
const debugSession = document.getElementById('debugSession');
const debugStartLine = document.getElementById('debugStartLine');
const debugEndLine = document.getElementById('debugEndLine');
const debugStartBtn = document.getElementById('debugStartBtn');
const debugCloseBtn = document.getElementById('debugCloseBtn');
const debugPrevBtn = document.getElementById('debugPrevBtn');
const debugNextBtn = document.getElementById('debugNextBtn');
const debugLineBadge = document.getElementById('debugLineBadge');
const debugCodeView = document.getElementById('debugCodeView');
const debugCurrentExplain = document.getElementById('debugCurrentExplain');

function setDebugOpen(isOpen) {
  chatDock?.classList.toggle('debug-open', isOpen);
}

function maybeNotifyNarrowPanel() {
  if (panelNarrowHintSent) {
    return;
  }
  if (window.innerWidth <= PANEL_NARROW_HINT_THRESHOLD) {
    panelNarrowHintSent = true;
    vscode.postMessage({ type: 'panelNarrowHint' });
  }
}

const debugState = {
  active: false,
  lines: [],
  lineNumbers: [],
  currentIndex: 0,
  totalSteps: 0,
  currentLine: 0,
  explanation: ''
};

function closeProfileMenu() {
  profileMenu?.classList.add('hidden');
}

function toggleProfileMenu() {
  if (!state.isAuthenticated || !profileMenu) {
    return;
  }
  profileMenu.classList.toggle('hidden');
}

function appendHighlightedCode(lineElement, lineText) {
  const tokenRegex = /(#[^\n]*|"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|\b\d+\b|\b(def|return|if|else|elif|for|while|in|import|from|class|function|const|let|var|new|try|catch|finally|await|async|print)\b)/g;
  let lastIndex = 0;
  const text = String(lineText || '');
  let match = tokenRegex.exec(text);

  while (match) {
    if (match.index > lastIndex) {
      lineElement.appendChild(document.createTextNode(text.slice(lastIndex, match.index)));
    }

    const token = match[0];
    const span = document.createElement('span');
    if (token.startsWith('#')) {
      span.className = 'tok-comment';
    } else if ((token.startsWith('"') && token.endsWith('"')) || (token.startsWith("'") && token.endsWith("'"))) {
      span.className = 'tok-string';
    } else if (/^\d+$/.test(token)) {
      span.className = 'tok-number';
    } else {
      span.className = 'tok-keyword';
    }
    span.textContent = token;
    lineElement.appendChild(span);
    lastIndex = tokenRegex.lastIndex;
    match = tokenRegex.exec(text);
  }

  if (lastIndex < text.length) {
    lineElement.appendChild(document.createTextNode(text.slice(lastIndex)));
  }
}

function renderDebugCode() {
  if (!debugCodeView) {
    return;
  }
  debugCodeView.innerHTML = '';
  for (let index = 0; index < debugState.lines.length; index++) {
    const line = debugState.lines[index];
    const lineElement = document.createElement('span');
    const lineNumber = Number(debugState.lineNumbers[index] || 0);
    lineElement.className = `debug-code-line${lineNumber === debugState.currentLine ? ' current' : ''}`;
    appendHighlightedCode(lineElement, line);
    debugCodeView.appendChild(lineElement);
  }
}

function updateDebugNavButtons() {
  const hasSteps = debugState.totalSteps > 0;
  if (debugPrevBtn) {
    debugPrevBtn.disabled = !hasSteps || debugState.currentIndex <= 0;
  }
  if (debugNextBtn) {
    debugNextBtn.disabled = !hasSteps || debugState.currentIndex >= debugState.totalSteps - 1;
  }
}

function setIssueBox(element, label, text) {
  if (!element || !label) {
    return;
  }
  const content = String(text || '').trim();
  const hasContent = content && content !== '-' && content !== '...' && content !== 'Problem in code' && content !== 'Expected Fix';
  element.classList.toggle('hidden', !hasContent);
  label.classList.toggle('hidden', !hasContent);
  element.textContent = hasContent ? content : '';
}

function showMode(mode) {
  state.mode = mode;
  const showTools = state.isAuthenticated && mode === 'tools';
  const showPractice = state.isAuthenticated && mode === 'practice';
  const showSolution = state.isAuthenticated && mode === 'solution';

  toolsFlow?.classList.toggle('hidden', !showTools);
  practiceFlow?.classList.toggle('hidden', !showPractice);
  solutionFlow?.classList.toggle('hidden', !showSolution);
}

function syncLabel(value) {
  void value;
  return '';
}

function setProfileAvatar(avatarUrl, displayName) {
  if (!profileAvatar) {
    return;
  }

  const safeName = String(displayName || 'User').trim();
  const initials = safeName.charAt(0).toUpperCase() || 'U';

  if (avatarUrl) {
    profileAvatar.innerHTML = '';
    const img = document.createElement('img');
    img.className = 'avatar-image';
    img.alt = `${safeName} avatar`;
    img.src = avatarUrl;
    img.onerror = () => {
      profileAvatar.innerHTML = '';
      profileAvatar.textContent = initials;
    };
    profileAvatar.appendChild(img);
    return;
  }

  profileAvatar.innerHTML = '';
  profileAvatar.textContent = initials;
}

function buildChatSignature(messages, isLoading) {
  return (messages || [])
    .map((msg) => `${msg.role}|${msg.timestamp || 0}|${msg.text}`)
    .join('\n') + `|loading:${isLoading ? 1 : 0}`;
}

function renderChat(messages, isLoading) {
  const signature = buildChatSignature(messages, isLoading);
  if (signature === lastChatSignature) {
    return;
  }

  const previousDistanceFromBottom = chatFeed.scrollHeight - chatFeed.scrollTop - chatFeed.clientHeight;
  const shouldStickToBottom = previousDistanceFromBottom <= 40 || lastChatSignature === '';

  chatFeed.innerHTML = '';
  for (const msg of messages || []) {
    const div = document.createElement('div');
    div.className = `chat-msg ${msg.role}`;
    div.textContent = msg.text;
    chatFeed.appendChild(div);
  }

  if (isLoading) {
    const loadingRow = document.createElement('div');
    loadingRow.className = 'chat-loading-row';

    const spinner = document.createElement('span');
    spinner.className = 'chat-loading-spinner';
    spinner.setAttribute('aria-hidden', 'true');

    loadingRow.appendChild(spinner);
    chatFeed.appendChild(loadingRow);
  }

  if (shouldStickToBottom) {
    chatFeed.scrollTop = chatFeed.scrollHeight;
  } else {
    const nextScrollTop = chatFeed.scrollHeight - chatFeed.clientHeight - previousDistanceFromBottom;
    chatFeed.scrollTop = Math.max(0, nextScrollTop);
  }

  lastChatSignature = signature;
}

function applyState(payload) {
  const isAuthenticated = Boolean(payload.user?.isAuthenticated);
  state.isAuthenticated = isAuthenticated;
  const rawName = payload.user?.username
    || (payload.user?.email ? payload.user.email.split('@')[0] : '')
    || '';
  const displayName = rawName || 'User';
  const avatarUrl = payload.user?.avatarUrl || '';
  userName.textContent = isAuthenticated && rawName ? `${rawName}'s Preecode` : 'Preecode';
  setProfileAvatar(avatarUrl, displayName);
  syncStatus.textContent = syncLabel(payload.syncStatus);
  if (syncStatus) {
    syncStatus.style.display = 'none';
  }
  compactTimer.textContent = payload.compactTimer || '00:00';
  if (practiceTimerValue) {
    practiceTimerValue.textContent = payload.compactTimer || '00:00';
  }
  if (solutionTimerValue) {
    solutionTimerValue.textContent = payload.compactTimer || '00:00';
  }

  if (loginBtn) {
    const mode = isAuthenticated ? 'dashboard' : 'login';
    loginBtn.dataset.mode = mode;
    loginBtn.setAttribute('aria-label', mode === 'dashboard' ? 'Open Dashboard' : 'Login');
    const textNode = loginBtn.querySelector('.profile-btn-text');
    if (textNode) {
      textNode.textContent = mode === 'dashboard' ? 'Dashboard' : 'Login';
    }
  }

  if (!isAuthenticated) {
    closeProfileMenu();
  }

  practiceQuestion.textContent = payload.practice?.question || '-';
  practiceDifficulty.textContent = payload.practice?.difficulty || 'easy';
  state.practiceDifficulty = payload.practice?.difficulty || 'easy';
  state.editorLanguage = payload.editor?.language || 'plaintext';
  practiceAttempts.textContent = String(payload.practice?.attempts || 0);
  runStatus.textContent = payload.practice?.runStatus || 'idle';

  setIssueBox(problemInCodeLine, problemInCodeLabel, payload.editor?.topIssue || '');
  setIssueBox(expectedFixLine, expectedFixLabel, payload.editor?.expectedFix || '');

  if (explainQuestionBtn) {
    explainQuestionBtn.textContent = payload.editor?.hasQuestionExplanation ? 'Remove Question Explanation' : 'Explain Question';
  }
  if (explainSelectionBtn) {
    const hasSelection = Boolean(payload.editor?.hasSelection);
    const hasSelectionExplanation = Boolean(payload.editor?.hasSelectionExplanation);
    explainSelectionBtn.textContent = hasSelection || !hasSelectionExplanation
      ? 'Explain Selection'
      : 'Hide Explanation';
  }
  if (showHintBtn) {
    showHintBtn.textContent = payload.editor?.hasHint ? 'Hide Hint' : 'Show Hint';
  }
  if (showSolutionBtn) {
    showSolutionBtn.textContent = payload.editor?.hasVisibleSolution ? 'Hide Solution' : 'Show Solution';
  }
  if (explainSolutionBtn) {
    explainSolutionBtn.textContent = payload.editor?.hasSolutionExplanation ? 'Hide Solution Explanation' : 'Explain Solution';
  }
  if (evaluateCodeBtn) {
    evaluateCodeBtn.textContent = payload.editor?.hasCodeEvaluation ? 'Remove Code Evaluation' : 'Evaluate Code';
  }
  if (reviewCodeBtn) {
    reviewCodeBtn.textContent = payload.editor?.hasReview ? 'Hide Review' : 'Review Code';
  }

  if (!isAuthenticated) {
    showMode('collapsed');
  } else if (state.mode === 'collapsed') {
    showMode('tools');
  } else {
    showMode(state.mode);
  }

  if (practiceStatePrimary && practiceStateSecondary) {
    practiceStatePrimary.classList.toggle('hidden', state.mode !== 'practice');
    practiceStateSecondary.classList.toggle('hidden', state.mode !== 'solution');
  }

  if (!state.userResizedChat) {
    chatDock.style.height = 'auto';
  } else {
    chatDock.style.height = `${state.chatDockHeight}px`;
  }

  const isLoading = Boolean(payload.chat?.isLoading);
  renderChat(payload.chat?.messages || [], isLoading);
  if (sendBtn) {
    sendBtn.disabled = isLoading;
    sendBtn.textContent = isLoading ? '...' : 'Send';
  }
}

function applyOnboardingUI(onboardingState) {
  if (!onboardingState.isActive) {
    hideAllOnboardingElements();
    return;
  }

  const step = onboardingState.currentStep;
  console.log('Applying onboarding UI for step:', step);

  hideAllOnboardingElements();

  if (step === 'click-sidebar-icon') {
    // This step is auto-skipped since sidebar opens automatically
    console.log('Sidebar opening automatically, skipping click-sidebar-icon step...');
  } else if (step === 'sidebar-open') {
    // Step 1: Sidebar just opened - show login button
    showOnboardingTooltip(
      loginBtn,
      '👋 Welcome to Preecode!',
      'Click "Login" to connect your account and unlock all features.',
      'next',
      () => vscode.postMessage({ type: 'tourStep', payload: 'login' })
    );
  } else if (step === 'login') {
    // Waiting for login - show subtle message
    console.log('Waiting for user to login...');
    showOnboardingLoadingMessage('Waiting for login...');
  } else if (step === 'start-practicing') {
    // Step 2: Highlight the Start Practicing button
    const startPracticeBtn = toolsFlow?.querySelector('[data-action="practice"]') ||
                           document.querySelector('[data-mode-target="practice"]');

    showOnboardingTooltip(
      startPracticeBtn,
      '🎯 Start Practicing',
      'Solve coding questions to improve your skills.',
      'next',
      () => vscode.postMessage({ type: 'tourStep', payload: 'debug-code' })
    );
  } else if (step === 'debug-code') {
    // Highlight Debug Code button
    const debugBtn = document.querySelector('[data-action="debug"]');
    showOnboardingTooltip(
      debugBtn,
      '🐛 Debug Code',
      'Step through your code line-by-line to see what happens.',
      'next',
      () => vscode.postMessage({ type: 'tourStep', payload: 'fix-code' })
    );
  } else if (step === 'fix-code') {
    // Highlight Fix Code button
    const fixBtn = document.querySelector('[data-action="fix"]');
    showOnboardingTooltip(
      fixBtn,
      '🔧 Fix Code',
      'Automatically find and fix errors in your code.',
      'next',
      () => vscode.postMessage({ type: 'tourStep', payload: 'explain-selection' })
    );
  } else if (step === 'explain-selection') {
    // Highlight Explain Selection button
    showOnboardingTooltip(
      explainSelectionBtn,
      '💡 Explain Code',
      'Select any code snippet and get a simple explanation.',
      'next',
      () => vscode.postMessage({ type: 'tourStep', payload: 'review-code' })
    );
  } else if (step === 'review-code') {
    // Highlight Review Code button
    showOnboardingTooltip(
      reviewCodeBtn,
      '👁️ Review Code',
      'Get professional feedback on code quality and improvements.',
      'next',
      () => vscode.postMessage({ type: 'tourStep', payload: 'ai-chat' })
    );
  } else if (step === 'ai-chat') {
    // Highlight AI Chat input
    const chatInput = document.querySelector('#chatInput');
    showOnboardingTooltip(
      chatInput,
      '💬 Ask Preecode AI',
      'Ask anything about coding, debugging, or how to use these tools.',
      'finish',
      () => {
        vscode.postMessage({ type: 'tourStep', payload: 'completed' });
        showOnboardingCompletion();
      }
    );
  }
}

function hideAllOnboardingElements() {
  const existing = document.querySelectorAll('.onboarding-overlay, .onboarding-tooltip, .onboarding-loading, .onboarding-highlight, .onboarding-highlight-box, .sidebar-icon-pointer');
  existing.forEach(el => {
    if (el.classList.contains('onboarding-highlight')) {
      el.classList.remove('onboarding-highlight');
    } else {
      el.remove();
    }
  });
}

function showOnboardingLoadingMessage(text) {
  const loading = document.createElement('div');
  loading.className = 'onboarding-loading';
  loading.innerHTML = `
    <div class="loading-spinner"></div>
    <span>${text}</span>
  `;
  document.body.appendChild(loading);
}

function showSidebarIconPointer() {
  // Create a visual arrow/beacon pointing to the sidebar icon
  const pointer = document.createElement('div');
  pointer.className = 'sidebar-icon-pointer';
  pointer.innerHTML = `
    <div class="pointer-beacon">
      <div class="beacon-light"></div>
      <div class="beacon-ring"></div>
    </div>
    <div class="pointer-arrow">👇</div>
  `;
  document.body.appendChild(pointer);
}

function showOnboardingTooltip(targetElement, title, message, buttonType, onNext) {
  if (!targetElement) {
    console.warn('Target element not found for onboarding. Title:', title);
    return;
  }

  const overlay = document.createElement('div');
  overlay.className = 'onboarding-overlay';

  const tooltip = document.createElement('div');
  tooltip.className = 'onboarding-tooltip';

  const titleEl = document.createElement('div');
  titleEl.className = 'onboarding-title';
  titleEl.textContent = title;

  const messageEl = document.createElement('div');
  messageEl.className = 'onboarding-message';
  messageEl.textContent = message;

  const buttonContainer = document.createElement('div');
  buttonContainer.className = 'onboarding-buttons';

  const nextBtn = document.createElement('button');
  nextBtn.className = 'onboarding-btn primary';
  nextBtn.textContent = buttonType === 'finish' ? '✨ Finish Tour' : 'Next →';
  nextBtn.onclick = (e) => {
    e.preventDefault();
    e.stopPropagation();
    hideAllOnboardingElements();
    onNext();
  };

  const skipBtn = document.createElement('button');
  skipBtn.className = 'onboarding-btn secondary';
  skipBtn.textContent = 'Skip';
  skipBtn.onclick = (e) => {
    e.preventDefault();
    e.stopPropagation();
    hideAllOnboardingElements();
    vscode.postMessage({ type: 'tourStep', payload: 'completed' });
  };

  buttonContainer.appendChild(nextBtn);
  buttonContainer.appendChild(skipBtn);

  tooltip.appendChild(titleEl);
  tooltip.appendChild(messageEl);
  tooltip.appendChild(buttonContainer);

  // Create a visual border box around the element
  const highlightBox = document.createElement('div');
  highlightBox.className = 'onboarding-highlight-box';
  document.body.appendChild(highlightBox);

  // Add highlight effect to the button itself
  targetElement.classList.add('onboarding-highlight');

  overlay.appendChild(tooltip);
  document.body.appendChild(overlay);

  setTimeout(() => {
    const rect = targetElement.getBoundingClientRect();
    const tooltipWidth = 300;
    const tooltipHeight = 160;
    const padding = 15;
    const minLeftMargin = 75; // Space from left panel (0.5cm + left panel width)
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    // Always position to the right, aligned with button's left edge or slightly right
    let tooltipLeft = rect.left + rect.width / 2;
    let tooltipTop = rect.top - tooltipHeight - padding;

    // Primary: Try to position to the right of button
    if (rect.right + padding + tooltipWidth <= viewportWidth) {
      tooltipLeft = rect.right + padding;
      tooltipTop = rect.top + rect.height / 2 - tooltipHeight / 2;
    } else if (rect.left >= tooltipWidth + padding) {
      // Secondary: If no space on right, try left side
      tooltipLeft = rect.left - tooltipWidth - padding;
      tooltipTop = rect.top + rect.height / 2 - tooltipHeight / 2;
    } else {
      // Fallback: Position below the button
      tooltipLeft = Math.max(minLeftMargin, Math.min(rect.left, viewportWidth - tooltipWidth - padding));
      tooltipTop = rect.bottom + padding;
    }

    // Ensure tooltip stays within viewport with minimum left margin
    if (tooltipLeft < minLeftMargin) {
      tooltipLeft = minLeftMargin;
    }
    if (tooltipLeft + tooltipWidth > viewportWidth) {
      tooltipLeft = viewportWidth - tooltipWidth - padding;
    }
    if (tooltipTop < padding) {
      tooltipTop = padding;
    }
    if (tooltipTop + tooltipHeight > viewportHeight) {
      tooltipTop = viewportHeight - tooltipHeight - padding;
    }

    tooltip.style.position = 'fixed';
    tooltip.style.left = tooltipLeft + 'px';
    tooltip.style.top = tooltipTop + 'px';

    // Position highlight box around target element
    if (highlightBox) {
      highlightBox.style.position = 'fixed';
      highlightBox.style.left = (rect.left - 5) + 'px';
      highlightBox.style.top = (rect.top - 5) + 'px';
      highlightBox.style.width = (rect.width + 10) + 'px';
      highlightBox.style.height = (rect.height + 10) + 'px';
    }

    overlay.classList.add('active');
  }, 100);
}

function showOnboardingCompletion() {
  setTimeout(() => {
    // Create overlay to dim background
    const overlay = document.createElement('div');
    overlay.className = 'onboarding-overlay';
    overlay.style.zIndex = '10000';
    document.body.appendChild(overlay);

    const completion = document.createElement('div');
    completion.className = 'onboarding-completion';
    completion.innerHTML = `
      <div class="completion-content">
        <div class="completion-emoji">🎉</div>
        <h2>You're all set!</h2>
        <p>You've learned all the core features. Start practicing and improving your coding skills with Preecode!</p>
      </div>
    `;
    const startBtn = document.createElement('button');
    startBtn.className = 'onboarding-btn primary';
    startBtn.textContent = 'Start Coding →';
    startBtn.onclick = (e) => {
      e.preventDefault();
      e.stopPropagation();
      completion.remove();
      overlay.remove();
    };
    completion.querySelector('.completion-content').appendChild(startBtn);
    document.body.appendChild(completion);

    setTimeout(() => {
      overlay.classList.add('active');
    }, 10);
  }, 300);
}

for (const btn of Array.from(document.querySelectorAll('[data-mode-target]'))) {
  btn.addEventListener('click', () => {
    const modeTarget = btn.getAttribute('data-mode-target');
    const action = btn.getAttribute('data-action');
    if ((action === 'generate' || action === 'detect') && modeTarget === 'solution') {
      return;
    }
    if (modeTarget === 'practice' && state.isAuthenticated) {
      showMode('practice');
    }
    if (modeTarget === 'solution' && state.isAuthenticated) {
      showMode('solution');
    }
  });
}

for (const btn of Array.from(document.querySelectorAll('[data-nav-back]'))) {
  btn.addEventListener('click', () => {
    const target = btn.getAttribute('data-nav-back');
    if (!target || !state.isAuthenticated) {
      return;
    }
    if (target === 'tools' || target === 'practice' || target === 'solution') {
      showMode(target);
    }
  });
}

for (const btn of Array.from(document.querySelectorAll('[data-action]'))) {
  btn.addEventListener('click', () => {
    const action = btn.getAttribute('data-action');
    if (!action) {
      return;
    }
    if (action === 'debug') {
      debugPanel?.classList.remove('hidden');
      debugRangeForm?.classList.remove('hidden');
      debugSession?.classList.add('hidden');
      debugState.active = false;
      setDebugOpen(true);
      if (debugStartLine) {
        debugStartLine.value = '';
      }
      if (debugEndLine) {
        debugEndLine.value = '';
      }
      return;
    }
    vscode.postMessage({
      type: 'quickAction',
      action,
      payload: {
        language: state.editorLanguage,
        difficulty: state.practiceDifficulty
      }
    });
  });
}

debugCloseBtn?.addEventListener('click', () => {
  debugPanel?.classList.add('hidden');
  debugRangeForm?.classList.remove('hidden');
  debugSession?.classList.add('hidden');
  debugState.active = false;
  setDebugOpen(false);
});

debugStartBtn?.addEventListener('click', () => {
  const startLine = Number(debugStartLine?.value || 0);
  const endLine = Number(debugEndLine?.value || 0);
  if (!startLine || !endLine || startLine > endLine) {
    return;
  }
  vscode.postMessage({ type: 'debugStart', startLine, endLine });
});

debugPrevBtn?.addEventListener('click', () => {
  if (debugPrevBtn.disabled) {
    return;
  }
  vscode.postMessage({ type: 'debugNavigate', direction: 'prev' });
});

debugNextBtn?.addEventListener('click', () => {
  if (debugNextBtn.disabled) {
    return;
  }
  vscode.postMessage({ type: 'debugNavigate', direction: 'next' });
});

sendBtn.addEventListener('click', () => {
  const text = (chatInput.value || '').trim();
  if (!text) {
    return;
  }
  chatInput.value = '';
  vscode.postMessage({ type: 'askChat', payload: text });
});

chatInput.addEventListener('keydown', (event) => {
  if (event.key === 'Enter') {
    event.preventDefault();
    sendBtn.click();
  }
});

practiceTimerValue?.addEventListener('click', () => {
  vscode.postMessage({ type: 'timerMenu' });
});

solutionTimerValue?.addEventListener('click', () => {
  vscode.postMessage({ type: 'timerMenu' });
});

loginBtn.addEventListener('click', () => {
  closeProfileMenu();
  if (loginBtn.dataset.mode === 'dashboard') {
    vscode.postMessage({ type: 'openDashboard' });
    return;
  }
  vscode.postMessage({ type: 'login' });
});

profileTrigger?.addEventListener('click', (event) => {
  event.stopPropagation();
  toggleProfileMenu();
});

profileLogoutBtn?.addEventListener('click', () => {
  closeProfileMenu();
  vscode.postMessage({ type: 'logout' });
});

document.addEventListener('click', (event) => {
  if (!profileMenu || profileMenu.classList.contains('hidden')) {
    return;
  }
  const target = event.target;
  if (!(target instanceof Node)) {
    closeProfileMenu();
    return;
  }
  if (!profileMenu.contains(target) && !profileTrigger?.contains(target)) {
    closeProfileMenu();
  }
});

newChatBtn?.addEventListener('click', () => {
  vscode.postMessage({ type: 'newChat' });
});

let dragActive = false;
chatGrip.addEventListener('mousedown', (event) => {
  event.preventDefault();
  dragActive = true;
});

window.addEventListener('mousemove', (event) => {
  if (!dragActive) {
    return;
  }
  const rootTop = document.querySelector('.root').getBoundingClientRect().top;
  const desired = window.innerHeight - (event.clientY - rootTop) - 8;
  const next = Math.max(120, Math.min(window.innerHeight - 120, desired));
  state.chatDockHeight = next;
  state.userResizedChat = true;
  chatDock.style.height = `${next}px`;
});

window.addEventListener('mouseup', () => {
  if (!dragActive) {
    return;
  }
  dragActive = false;
  vscode.postMessage({ type: 'chatDockResize', height: state.chatDockHeight });
});

window.addEventListener('resize', () => {
  maybeNotifyNarrowPanel();
});

maybeNotifyNarrowPanel();

vscode.postMessage({ type: 'ready' });
console.log('Preecode webview sent ready message');

window.addEventListener('message', (event) => {
  const message = event.data;
  console.log('Preecode webview received message:', message?.type || 'unknown');
  if (message.type === 'state') {
    applyState(message.payload || {});
  }
  if (message.type === 'setMode' && state.isAuthenticated) {
    const nextMode = message.mode;
    if (nextMode === 'tools' || nextMode === 'practice' || nextMode === 'solution') {
      showMode(nextMode);
    }
  }
  if (message.type === 'debugState') {
    const payload = message.payload || {};
    debugPanel?.classList.remove('hidden');
    setDebugOpen(true);
    debugRangeForm?.classList.add('hidden');
    debugSession?.classList.remove('hidden');
    debugState.active = true;
    debugState.lines = Array.isArray(payload.lines) ? payload.lines : [];
    debugState.lineNumbers = Array.isArray(payload.lineNumbers) ? payload.lineNumbers : [];
    debugState.currentIndex = Number(payload.currentIndex || 0);
    debugState.totalSteps = Number(payload.totalSteps || 0);
    debugState.currentLine = Number(payload.currentLine || 0);
    debugState.explanation = payload.explanation || '-';
    if (debugLineBadge) {
      if (debugState.totalSteps > 0) {
        debugLineBadge.textContent = `Step ${debugState.currentIndex + 1} of ${debugState.totalSteps}`;
      } else {
        const currentLine = Number(payload.currentLine || 0);
        const endLine = Number(payload.endLine || currentLine || 0);
        debugLineBadge.textContent = currentLine > 0 ? `Line ${currentLine} of ${endLine}` : 'Line -';
      }
    }
    if (debugCurrentExplain) {
      debugCurrentExplain.textContent = debugState.explanation || '-';
    }
    renderDebugCode();
    updateDebugNavButtons();
  }
  if (message.type === 'onboarding') {
    const payload = message.payload || {};
    state.onboarding = {
      isActive: Boolean(payload.isActive),
      currentStep: String(payload.currentStep || 'none'),
      isCompleted: Boolean(payload.isCompleted)
    };
    console.log('Onboarding state updated:', state.onboarding);
    applyOnboardingUI(state.onboarding);
  }
});
