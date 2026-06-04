const vscode = acquireVsCodeApi();

const elements = {
  userName: document.getElementById('userName'),
  profileTitle: document.getElementById('profileTitle'),
  menuProfileTitle: document.getElementById('menuProfileTitle'),
  profileCard: document.getElementById('profileCard'),
  profileMenu: document.getElementById('profileMenu'),
  showOptionsBtn: document.getElementById('showOptionsBtn'),
  firstOptions: document.getElementById('firstOptions'),
  openToolsScreenBtn: document.getElementById('openToolsScreenBtn'),
  openPracticeScreenBtn: document.getElementById('openPracticeScreenBtn'),
  openSolutionScreenBtn: document.getElementById('openSolutionScreenBtn'),
  backToChatFromTools: document.getElementById('backToChatFromTools'),
  backToChatFromPractice: document.getElementById('backToChatFromPractice'),
  backToChatFromSolution: document.getElementById('backToChatFromSolution'),
  screens: Array.from(document.querySelectorAll('.screen')),
  gotoPracticeBtn: document.getElementById('gotoPracticeBtn'),
  gotoSolutionScreenBtn: document.getElementById('gotoSolutionScreenBtn'),
  generateQuestionBtn: document.getElementById('generateQuestionBtn'),
  detectQuestionBtn: document.getElementById('detectQuestionBtn'),
  toggleTools: document.getElementById('toggleTools'),
  toolsPanel: document.getElementById('toolsPanel'),
  openDashboardBtn: document.getElementById('openDashboardBtn'),
  askInput: document.getElementById('askInput'),
  askSendBtn: document.getElementById('askSendBtn'),
  chatFeed: document.getElementById('chatFeed'),
  timeDisplay: document.getElementById('timeDisplay'),
  solutionRating: document.getElementById('solutionRating'),
  explainQuestionBtn: document.getElementById('explainQuestionBtn'),
  showHintBtn: document.getElementById('showHintBtn'),
  showSolutionBtn: document.getElementById('showSolutionBtn'),
  explainSolutionBtn: document.getElementById('explainSolutionBtn'),
  evaluateSolutionBtn: document.getElementById('evaluateSolutionBtn'),
  anotherWayBtn: document.getElementById('anotherWayBtn'),
  timer: document.getElementById('timer'),
  fileName: document.getElementById('fileName'),
  fileLanguage: document.getElementById('fileLanguage'),
  monitorState: document.getElementById('monitorState'),
  monitorDiagnostics: document.getElementById('monitorDiagnostics'),
  monitorSelection: document.getElementById('monitorSelection'),
  monitorVisibleRange: document.getElementById('monitorVisibleRange'),
  monitorTopIssue: document.getElementById('monitorTopIssue'),
  topIssueCard: document.getElementById('topIssueCard'),
  typingIndicator: document.getElementById('typingIndicator'),
  helpPopup: document.getElementById('helpPopup'),
  helpYes: document.getElementById('helpYes'),
  helpLater: document.getElementById('helpLater'),
  problemOutput: document.getElementById('problemOutput'),
  reasonOutput: document.getElementById('reasonOutput'),
  issueHighlightOutput: document.getElementById('issueHighlightOutput'),
  expectedFixOutput: document.getElementById('expectedFixOutput'),
  stepsOutput: document.getElementById('stepsOutput'),
  lineExecutionOutput: document.getElementById('lineExecutionOutput'),
  fixedCodeOutput: document.getElementById('fixedCodeOutput'),
  suggestionsOutput: document.getElementById('suggestionsOutput')
};

let hasIssues = false;
let popupVisible = false;
let typingTimeout = null;
let currentScreen = 1;
const totalScreens = 4;
let optionsVisible = false;

function toggleFirstOptions(open) {
  optionsVisible = typeof open === 'boolean' ? open : !optionsVisible;
  if (elements.firstOptions) {
    elements.firstOptions.classList.toggle('open', optionsVisible);
  }
}

function switchScreen(index) {
  currentScreen = Math.max(1, Math.min(totalScreens, index));
  elements.screens.forEach((screen) => {
    const num = Number(screen.getAttribute('data-screen'));
    screen.classList.toggle('active', num === currentScreen);
  });
  if (currentScreen !== 1 && optionsVisible) {
    toggleFirstOptions(false);
  }
}

function appendChat(role, text) {
  if (!elements.chatFeed || !text) return;
  const bubble = document.createElement('div');
  bubble.className = `chat-bubble ${role}`;
  bubble.textContent = text;
  elements.chatFeed.appendChild(bubble);
  elements.chatFeed.scrollTop = elements.chatFeed.scrollHeight;
}

function sendCommand(command, payload = {}) {
  vscode.postMessage({ type: 'command', command, ...payload });
}

function sendChat() {
  const text = elements.askInput?.value?.trim();
  if (!text) return;
  appendChat('user', text);
  if (elements.askInput) elements.askInput.value = '';
  vscode.postMessage({ type: 'chat', prompt: text });
}

function updateTitles(userName) {
  const title = `${userName}'s Preecode AI`;
  if (elements.profileTitle) elements.profileTitle.textContent = title;
  if (elements.menuProfileTitle) elements.menuProfileTitle.textContent = title;
}

function parseRating(payload) {
  const haystack = [
    payload?.reason,
    payload?.problem,
    Array.isArray(payload?.suggestions) ? payload.suggestions.join(' ') : payload?.suggestions,
    Array.isArray(payload?.step_by_step) ? payload.step_by_step.join(' ') : payload?.step_by_step
  ].filter(Boolean).join(' ');

  const byTen = haystack.match(/(\d{1,2})\s*\/\s*10/);
  if (byTen) return Math.min(10, Number(byTen[1]));

  const outOfTen = haystack.match(/(?:score|rating|rated|evaluate(?:d)?)\D{0,8}(\d{1,2})\D{0,4}(?:out of\s*10|\/10)/i);
  if (outOfTen) return Math.min(10, Number(outOfTen[1]));

  return null;
}

function setTyping(active) {
  if (active) {
    elements.typingIndicator.classList.add('active');
    if (elements.monitorState) {
      elements.monitorState.textContent = 'User is typing';
    }
    if (typingTimeout) {
      clearTimeout(typingTimeout);
    }
    typingTimeout = setTimeout(() => {
      elements.typingIndicator.classList.remove('active');
      if (elements.monitorState && elements.monitorState.textContent === 'User is typing') {
        elements.monitorState.textContent = hasIssues ? 'Issue detected' : 'Monitoring';
      }
    }, 1200);
  }
}

function setIssues(active) {
  hasIssues = active;
  if (elements.topIssueCard && elements.topIssueCard.classList) {
    elements.topIssueCard.classList.toggle('has-issue', active);
  }
  if (active && !popupVisible) {
    elements.helpPopup.classList.add('show');
    popupVisible = true;
  }
  if (!active) {
    elements.helpPopup.classList.remove('show');
    popupVisible = false;
  }
}

function updateMonitor(payload) {
  if (!payload) return;
  if (elements.monitorState && payload.state) {
    elements.monitorState.textContent = payload.state;
  }
  if (elements.monitorDiagnostics) {
    const errors = Number(payload.errors || 0);
    const warnings = Number(payload.warnings || 0);
    elements.monitorDiagnostics.textContent = `E:${errors} W:${warnings}`;
  }
  if (elements.monitorSelection) {
    elements.monitorSelection.textContent = payload.selection || 'No selection';
  }
  if (elements.monitorVisibleRange) {
    elements.monitorVisibleRange.textContent = payload.visibleRange || '-';
  }
  if (elements.monitorTopIssue) {
    elements.monitorTopIssue.textContent = payload.topIssue || 'No issue detected';
  }
}

function renderOutput(payload) {
  const problem = payload.problem || '-';
  const reason = payload.reason || '-';
  const issueHighlight = payload.highlight_issue || '-';
  const expectedFix = payload.highlight_fix || '-';
  const steps = Array.isArray(payload.step_by_step)
    ? payload.step_by_step.join('\n')
    : payload.step_by_step || '-';
  const lineExec = Array.isArray(payload.line_execution)
    ? payload.line_execution.join('\n')
    : payload.line_execution || '-';
  const fixedCode = payload.fixed_code || '-';
  const suggestions = Array.isArray(payload.suggestions)
    ? payload.suggestions.join('\n')
    : payload.suggestions || '-';

  elements.problemOutput.textContent = problem;
  elements.reasonOutput.textContent = reason;
  elements.issueHighlightOutput.textContent = issueHighlight;
  elements.expectedFixOutput.textContent = expectedFix;
  elements.stepsOutput.textContent = steps;
  elements.lineExecutionOutput.textContent = lineExec;
  elements.fixedCodeOutput.textContent = fixedCode;
  elements.suggestionsOutput.textContent = suggestions;

  const concise = [problem, reason, steps].filter(Boolean).join('\n');
  if (concise.trim()) {
    appendChat('ai', concise);
  }

  const rating = parseRating(payload);
  if (rating !== null && elements.solutionRating) {
    elements.solutionRating.textContent = String(rating);
  }
}

function sendAction(action) {
  vscode.postMessage({ type: 'action', action });
}

Array.from(document.querySelectorAll('.action-btn')).forEach((button) => {
  button.addEventListener('click', () => {
    const action = button.getAttribute('data-action');
    if (action) {
      sendAction(action);
    }
  });
});

if (elements.showOptionsBtn) {
  elements.showOptionsBtn.addEventListener('click', () => toggleFirstOptions());
}

if (elements.openToolsScreenBtn) {
  elements.openToolsScreenBtn.addEventListener('click', () => switchScreen(2));
}

if (elements.openPracticeScreenBtn) {
  elements.openPracticeScreenBtn.addEventListener('click', () => switchScreen(3));
}

if (elements.openSolutionScreenBtn) {
  elements.openSolutionScreenBtn.addEventListener('click', () => switchScreen(4));
}

if (elements.backToChatFromTools) {
  elements.backToChatFromTools.addEventListener('click', () => switchScreen(1));
}

if (elements.backToChatFromPractice) {
  elements.backToChatFromPractice.addEventListener('click', () => switchScreen(1));
}

if (elements.backToChatFromSolution) {
  elements.backToChatFromSolution.addEventListener('click', () => switchScreen(1));
}

if (elements.profileCard) {
  elements.profileCard.addEventListener('click', () => {
    if (elements.profileMenu) {
      elements.profileMenu.classList.toggle('open');
    }
  });
}

if (elements.openDashboardBtn) {
  elements.openDashboardBtn.addEventListener('click', (event) => {
    event.stopPropagation();
    sendCommand('preecode.openDashboard');
  });
}

if (elements.toggleTools) {
  elements.toggleTools.addEventListener('click', () => {
    elements.toolsPanel?.classList.toggle('open');
  });
}

if (elements.gotoPracticeBtn) {
  elements.gotoPracticeBtn.addEventListener('click', () => switchScreen(3));
}

if (elements.gotoSolutionScreenBtn) {
  elements.gotoSolutionScreenBtn.addEventListener('click', () => switchScreen(4));
}

if (elements.generateQuestionBtn) {
  elements.generateQuestionBtn.addEventListener('click', () => sendCommand('preecode.startPractice'));
}

if (elements.detectQuestionBtn) {
  elements.detectQuestionBtn.addEventListener('click', () => sendCommand('preecode.startPractice'));
}

if (elements.explainQuestionBtn) {
  elements.explainQuestionBtn.addEventListener('click', () => {
    if (elements.askInput) {
      elements.askInput.value = 'Explain the current practice question in simple words.';
    }
    sendChat();
  });
}

if (elements.showHintBtn) {
  elements.showHintBtn.addEventListener('click', () => sendCommand('preecode.showHint'));
}

if (elements.showSolutionBtn) {
  elements.showSolutionBtn.addEventListener('click', () => sendCommand('preecode.showSolution'));
}

if (elements.explainSolutionBtn) {
  elements.explainSolutionBtn.addEventListener('click', () => sendAction('explain'));
}

if (elements.evaluateSolutionBtn) {
  elements.evaluateSolutionBtn.addEventListener('click', () => sendCommand('preecode.evaluateSolution'));
}

if (elements.anotherWayBtn) {
  elements.anotherWayBtn.addEventListener('click', () => {
    if (elements.askInput) {
      elements.askInput.value = 'Show me another way to solve this question.';
    }
    sendChat();
  });
}

if (elements.askSendBtn) {
  elements.askSendBtn.addEventListener('click', sendChat);
}

if (elements.askInput) {
  elements.askInput.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      sendChat();
    }
  });
}

if (elements.helpYes) {
  elements.helpYes.addEventListener('click', () => {
    elements.helpPopup.classList.remove('show');
    popupVisible = false;
    sendAction('debug');
  });
}

if (elements.helpLater) {
  elements.helpLater.addEventListener('click', () => {
    elements.helpPopup.classList.remove('show');
    popupVisible = false;
  });
}

window.addEventListener('message', (event) => {
  const message = event.data;
  if (!message || !message.type) return;

  switch (message.type) {
    case 'init':
      if (message.userName) {
        if (elements.userName) elements.userName.textContent = message.userName;
        updateTitles(message.userName);
      }
      if (message.timer) elements.timer.textContent = message.timer;
      if (message.timer && elements.timeDisplay) elements.timeDisplay.textContent = message.timer;
      if (message.fileName) elements.fileName.textContent = message.fileName;
      if (message.language) elements.fileLanguage.textContent = message.language;
      updateMonitor(message.monitor || null);
      break;
    case 'fileInfo':
      if (message.fileName) elements.fileName.textContent = message.fileName;
      if (message.language) elements.fileLanguage.textContent = message.language;
      break;
    case 'typing':
      setTyping(true);
      break;
    case 'diagnostics':
      setIssues(Boolean(message.hasIssues));
      updateMonitor(message.monitor || null);
      break;
    case 'monitor':
      updateMonitor(message.payload || null);
      break;
    case 'timer':
      if (message.timer) {
        elements.timer.textContent = message.timer;
        if (elements.timeDisplay) elements.timeDisplay.textContent = message.timer;
      }
      break;
    case 'assistantResponse':
      renderOutput(message.payload || {});
      break;
    case 'assistantError':
      appendChat('ai', message.error || 'Unknown error');
      renderOutput({
        problem: 'Request failed',
        reason: message.error || 'Unknown error',
        highlight_issue: 'Review top issue from monitor section.',
        highlight_fix: 'Apply the shown keyword/syntax correction.',
        step_by_step: 'Check API key or use Fix Code for local automatic correction.',
        line_execution: '-',
        fixed_code: '-',
        suggestions: '-'
      });
      break;
    default:
      break;
  }
});

vscode.postMessage({ type: 'ready' });
switchScreen(1);
