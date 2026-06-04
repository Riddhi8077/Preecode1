import * as vscode from 'vscode';
import { preecodeStore } from '../state/store';
import { PreecodeState } from '../state/types';
import { getFrontendUrl } from '../services/apiService';

export interface ControlCenterHandlers {
  onQuickAction: (request: {
    action: 'practice' | 'practiceSeries' | 'generate' | 'detect' | 'debug' | 'fix' | 'explain' | 'review' | 'reviewProject' | 'explainQuestion' | 'showHint' | 'showSolution' | 'explainSolution' | 'evaluateCode' | 'differentApproach' | 'saveQuestion';
    payload?: {
      language?: string;
      difficulty?: 'easy' | 'medium' | 'hard';
    };
  }) => Promise<void>;
  onTimerMenu: () => Promise<void>;
  onPanelNarrowHint: () => Promise<void>;
  onLogout: () => Promise<void>;
  onAskChat: (text: string) => Promise<void>;
  onNewChat: () => Promise<void>;
  onDebugStart: (startLine: number, endLine: number) => Promise<void>;
  onDebugNavigate: (direction: 'prev' | 'next') => Promise<void>;
  onDebugAsk: (text: string) => Promise<void>;
  onLogin: () => Promise<void>;
  onTourStep: (step: string) => Promise<void>;
  onSidebarOpened: () => Promise<void>;
}

export class ControlCenterViewProvider implements vscode.WebviewViewProvider {
  public static readonly viewId = 'preecode.controlCenter';
  private webviewView: vscode.WebviewView | null = null;
  private unsubscribe: (() => void) | null = null;

  constructor(
    private readonly extensionUri: vscode.Uri,
    private readonly handlers: ControlCenterHandlers
  ) {}

  resolveWebviewView(view: vscode.WebviewView): void {
    this.webviewView = view;
    view.webview.options = {
      enableScripts: true,
      localResourceRoots: [vscode.Uri.joinPath(this.extensionUri, 'webview')]
    };

    view.webview.html = this.getHtml(view.webview);

    if (this.unsubscribe) {
      this.unsubscribe();
      this.unsubscribe = null;
    }

    this.unsubscribe = preecodeStore.subscribe((state) => {
      this.postState(state);
    });

    // Notify when sidebar opens for onboarding
    void this.handlers.onSidebarOpened();

    view.webview.onDidReceiveMessage(async (message: { type: string; payload?: any; action?: string; height?: number; startLine?: number; endLine?: number; direction?: 'prev' | 'next' }) => {
      if (message.type === 'quickAction' && message.action) {
        await this.handlers.onQuickAction({
          action: message.action as 'practice' | 'generate' | 'detect' | 'debug' | 'fix' | 'explain' | 'review' | 'reviewProject' | 'explainQuestion' | 'showHint' | 'showSolution' | 'explainSolution' | 'evaluateCode' | 'differentApproach' | 'saveQuestion',
          payload: message.payload
        });
        return;
      }

      if (message.type === 'debugStart' && typeof message.startLine === 'number' && typeof message.endLine === 'number') {
        await this.handlers.onDebugStart(message.startLine, message.endLine);
        return;
      }

      if (message.type === 'debugNavigate' && message.direction) {
        await this.handlers.onDebugNavigate(message.direction);
        return;
      }

      if (message.type === 'debugAsk' && message.payload) {
        await this.handlers.onDebugAsk(message.payload);
        return;
      }

      if (message.type === 'askChat' && message.payload) {
        await this.handlers.onAskChat(message.payload);
        return;
      }

      if (message.type === 'timerMenu') {
        await this.handlers.onTimerMenu();
        return;
      }

      if (message.type === 'panelNarrowHint') {
        await this.handlers.onPanelNarrowHint();
        return;
      }

      if (message.type === 'newChat') {
        await this.handlers.onNewChat();
        return;
      }

      if (message.type === 'login') {
        await this.handlers.onLogin();
        return;
      }

      if (message.type === 'logout') {
        await this.handlers.onLogout();
        return;
      }

      if (message.type === 'tourStep' && message.payload) {
        await this.handlers.onTourStep(message.payload);
        return;
      }

      if (message.type === 'openDashboard') {
        const url = `${getFrontendUrl()}/pages/dashboard.html`;
        await vscode.env.openExternal(vscode.Uri.parse(url));
        return;
      }

      if (message.type === 'ready') {
        this.postState(preecodeStore.getState());
        return;
      }

      if (message.type === 'chatDockResize') {
        const nextHeight = message.height;
        if (typeof nextHeight !== 'number') {
          return;
        }
        preecodeStore.setState((state) => ({
          ...state,
          chat: {
            ...state.chat,
            dockHeight: Math.max(120, nextHeight)
          }
        }));
      }
    });

    // Fire one initial state push for environments where webview is already ready.
    this.postState(preecodeStore.getState());
  }

  private postState(state: PreecodeState): void {
    this.webviewView?.webview.postMessage({
      type: 'state',
      payload: state
    });
    // Also send onboarding state separately for webview to handle
    this.webviewView?.webview.postMessage({
      type: 'onboarding',
      payload: state.onboarding
    });
  }

  public postMessage(message: unknown): void {
    this.webviewView?.webview.postMessage(message);
  }

  private getHtml(webview: vscode.Webview): string {
    const nonce = String(Date.now());
    const cssUri = webview.asWebviewUri(vscode.Uri.joinPath(this.extensionUri, 'webview', 'control-center.css'));
    const jsUri = webview.asWebviewUri(vscode.Uri.joinPath(this.extensionUri, 'webview', 'control-center.js'));

    const csp = [
      "default-src 'none'",
      `style-src ${webview.cspSource} 'unsafe-inline'`,
      `script-src 'nonce-${nonce}'`,
      `img-src ${webview.cspSource} data: https:`
    ].join('; ');

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta http-equiv="Content-Security-Policy" content="${csp}" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <link rel="stylesheet" href="${cssUri}" />
  <title>Preecode Control Center</title>
</head>
<body>
  <div class="root">
    <section class="card header-card">
      <div class="header-row">
        <div id="profileTrigger" class="profile-group">
          <div id="profileAvatar" class="avatar" aria-hidden="true">PC</div>
          <div class="profile-copy">
            <div id="userName" class="title">Preecode</div>
            <div id="syncStatus" class="sub">Sync: idle</div>
          </div>
        </div>
        <div class="header-right">
          <button id="loginBtn" class="small-btn profile-btn" data-mode="login" aria-label="Login">
            <span class="profile-btn-text">Login</span>
            <span class="profile-btn-icon" aria-hidden="true">⌂</span>
          </button>
        </div>
        <div id="profileMenu" class="profile-menu hidden">
          <button id="profileLogoutBtn" class="profile-menu-item" type="button">Logout</button>
        </div>
      </div>
    </section>

    <section class="card section-card hidden" id="toolsFlow">
      <button class="primary-btn full main-action" data-mode-target="practice" data-action="practice">Start Practicing Question</button>
      <button class="primary-btn full main-action" data-mode-target="practice" data-action="practiceSeries">Start Practice Series</button>
      <div class="action-grid" id="quickActionsSection">
        <button class="primary-btn" data-action="debug">Debug Code</button>
        <button class="primary-btn" data-action="fix">Fix Code</button>
        <button id="explainSelectionBtn" class="primary-btn" data-action="explain">Explain Selection</button>
        <button id="reviewCodeBtn" class="primary-btn" data-action="review">Review Code</button>
        <button id="reviewProjectBtn" class="primary-btn" data-action="reviewProject">Review Project</button>
      </div>
      <div id="problemInCodeLabel" class="section-label normal insight-title hidden">Problem In Code</div>
      <div class="ghost-line hidden" id="problemInCodeLine"></div>
      <div id="expectedFixLabel" class="section-label normal insight-title hidden">Expected Fix Code</div>
      <div class="ghost-line hidden" id="expectedFixLine"></div>

      <div class="hidden-bindings" aria-hidden="true">
        <strong id="practiceQuestion">-</strong>
        <strong id="practiceDifficulty">easy</strong>
        <strong id="practiceAttempts">0</strong>
        <strong id="runStatus">idle</strong>
      </div>
    </section>

    <section class="card section-card hidden" id="practiceFlow">
      <div class="section-head-row">
        <button class="back-btn" data-nav-back="tools" aria-label="Go home">⌂</button>
        <div class="section-label normal">Practice Questions</div>
        <span id="practiceTimerValue" class="timer">00:00</span>
      </div>

      <div class="practice-actions state-open" id="practiceStatePrimary">
        <button class="primary-btn full" data-action="generate">Generate Question</button>
        <button class="primary-btn full" data-action="detect">Detect Question</button>
      </div>

      <div class="hidden-bindings" aria-hidden="true">
        <strong id="practiceQuestionFlow">-</strong>
        <strong id="practiceDifficultyFlow">easy</strong>
        <strong id="practiceAttemptsFlow">0</strong>
        <strong id="runStatusFlow">idle</strong>
      </div>
    </section>

    <section class="card section-card hidden" id="solutionFlow">
      <div class="section-head-row">
        <button class="back-btn" data-nav-back="tools" aria-label="Go home">⌂</button>
        <div class="section-label normal">Practice Questions</div>
        <span id="solutionTimerValue" class="timer">00:00</span>
      </div>
      <div id="practiceStateSecondary" class="practice-actions open">
        <div class="action-grid two-col">
          <button id="explainQuestionBtn" class="primary-btn" data-action="explainQuestion">Explain Question</button>
          <button id="showHintBtn" class="primary-btn" data-action="showHint">Show Hint</button>
        </div>
        <div class="action-grid two-col">
          <button id="showSolutionBtn" class="primary-btn" data-action="showSolution">Show Solution</button>
          <button class="primary-btn" data-action="differentApproach">Different Approach</button>
        </div>
        <div class="action-grid two-col">
          <button id="explainSolutionBtn" class="primary-btn" data-action="explainSolution">Explain Solution</button>
          <button id="evaluateCodeBtn" class="primary-btn" data-action="evaluateCode">Evaluate Code</button>
        </div>
        <button id="saveQuestionBtn" class="primary-btn full save-question-btn" data-action="saveQuestion">Save Question</button>
      </div>

      <div class="hidden-bindings" aria-hidden="true">
        <strong id="practiceQuestionSolution">-</strong>
        <strong id="practiceDifficultySolution">easy</strong>
        <strong id="practiceAttemptsSolution">0</strong>
        <strong id="runStatusSolution">idle</strong>
      </div>
    </section>

    <div id="chatDock" class="chat-dock">
      <div id="chatGrip" class="chat-grip" aria-hidden="true"></div>
      <div class="dock-head">
        <span>AI CHAT</span>
        <button id="newChatBtn" class="dock-plus-btn" aria-label="Start new chat">+</button>
      </div>
      <section id="debugPanel" class="debug-panel hidden">
        <div class="debug-head-row">
          <div class="section-label">Debugging Code...</div>
          <button id="debugCloseBtn" class="debug-close-btn" aria-label="Close debug">×</button>
        </div>
        <div id="debugRangeForm" class="debug-range-form">
          <div class="debug-preview-box" aria-hidden="true"></div>
          <div class="debug-range-row">
            <input id="debugStartLine" type="number" min="1" placeholder="Start line" />
            <input id="debugEndLine" type="number" min="1" placeholder="End line" />
            <button id="debugStartBtn" class="small-btn">Start</button>
          </div>
        </div>
        <div id="debugSession" class="debug-session hidden">
          <div class="debug-nav-row">
            <button id="debugPrevBtn" class="small-btn">← Prev</button>
            <div id="debugLineBadge" class="debug-line-badge">Line -</div>
            <button id="debugNextBtn" class="small-btn">Next →</button>
          </div>
          <pre id="debugCodeView" class="debug-code-view"></pre>
          <div id="debugCurrentExplain" class="debug-current-explain">-</div>
        </div>
      </section>
      <div id="chatFeed" class="chat-feed"></div>
      <div class="ask-row">
        <input id="chatInput" type="text" placeholder="Ask Preecode AI" />
        <button id="sendBtn" class="send-btn">Send</button>
      </div>

      <div class="hidden-bindings" aria-hidden="true">
        <span id="compactTimer">00:00</span>
      </div>
    </div>
  </div>

  <script nonce="${nonce}" src="${jsUri}"></script>
</body>
</html>`;
  }

  dispose(): void {
    this.unsubscribe?.();
  }
}
