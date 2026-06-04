import * as vscode from 'vscode';

export interface MemorySettingsPanel {
  enabled: boolean;
  autoNotify: boolean;
  retentionDays: number;
}

export class MemorySettingsPanel {
  private static current: MemorySettingsPanel | undefined;
  private readonly panel: vscode.WebviewPanel;
  private disposables: vscode.Disposable[] = [];
  private settings: any;

  static render(
    context: vscode.ExtensionContext,
    extensionUri: vscode.Uri,
    settings: any,
    onSettingsChanged: (settings: any) => void
  ): MemorySettingsPanel {
    if (MemorySettingsPanel.current) {
      MemorySettingsPanel.current.panel.reveal(vscode.ViewColumn.Beside, true);
      return MemorySettingsPanel.current;
    }

    const panel = vscode.window.createWebviewPanel(
      'preecode.memorySettings',
      'Learning Memory Settings',
      vscode.ViewColumn.Beside,
      { enableScripts: true, retainContextWhenHidden: true }
    );

    MemorySettingsPanel.current = new MemorySettingsPanel(context, extensionUri, panel, settings, onSettingsChanged);
    return MemorySettingsPanel.current;
  }

  private constructor(
    private readonly context: vscode.ExtensionContext,
    private readonly extensionUri: vscode.Uri,
    panel: vscode.WebviewPanel,
    settings: any,
    onSettingsChanged: (settings: any) => void
  ) {
    this.panel = panel;
    this.settings = settings;

    this.panel.onDidDispose(() => this.dispose(), null, this.disposables);
    this.panel.webview.onDidReceiveMessage((message: any) => {
      if (message.type === 'settingsUpdated') {
        onSettingsChanged(message.settings);
      }
      if (message.type === 'deleteMemory') {
        vscode.commands.executeCommand('preecode.deleteMemory');
      }
      if (message.type === 'exportMemory') {
        vscode.commands.executeCommand('preecode.exportMemory');
      }
      if (message.type === 'viewHistory') {
        vscode.commands.executeCommand('preecode.viewMemoryHistory');
      }
    }, null, this.disposables);

    this.panel.webview.html = this.getHtml();
  }

  private getHtml(): string {
    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: var(--vscode-editor-background);
      color: var(--vscode-editor-foreground);
      padding: 30px;
      font-size: 14px;
    }
    .container { max-width: 600px; margin: 0 auto; }
    .header { margin-bottom: 30px; }
    .header h1 { font-size: 24px; margin-bottom: 10px; }
    .header p { opacity: 0.7; }
    .section {
      background: var(--vscode-panel-background);
      padding: 20px;
      border-radius: 6px;
      margin-bottom: 20px;
      border: 1px solid var(--vscode-panel-border);
    }
    .section-title {
      font-size: 16px;
      font-weight: bold;
      margin-bottom: 15px;
      display: flex;
      align-items: center;
    }
    .toggle { display: inline-flex; align-items: center; gap: 10px; margin: 10px 0; }
    .toggle input { cursor: pointer; }
    .toggle label { cursor: pointer; }
    .setting-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin: 12px 0;
      padding: 10px 0;
      border-bottom: 1px solid var(--vscode-panel-border);
    }
    .setting-row:last-child { border-bottom: none; }
    .setting-label { font-weight: 500; }
    .setting-description {
      font-size: 12px;
      opacity: 0.7;
      margin-top: 4px;
    }
    .button-group {
      display: flex;
      gap: 10px;
      margin-top: 15px;
    }
    button {
      flex: 1;
      padding: 8px 16px;
      border: none;
      border-radius: 4px;
      cursor: pointer;
      font-size: 13px;
      font-weight: 500;
    }
    .btn-primary {
      background: var(--vscode-button-background);
      color: var(--vscode-button-foreground);
    }
    .btn-primary:hover {
      background: var(--vscode-button-hoverBackground);
    }
    .btn-danger {
      background: rgba(255, 68, 68, 0.2);
      color: #ff4444;
      border: 1px solid #ff4444;
    }
    .btn-danger:hover {
      background: rgba(255, 68, 68, 0.3);
    }
    .info-box {
      background: rgba(68, 170, 255, 0.1);
      border-left: 3px solid #44aaff;
      padding: 12px;
      border-radius: 4px;
      margin: 15px 0;
      font-size: 13px;
      line-height: 1.5;
    }
    .stats {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 10px;
      margin: 15px 0;
    }
    .stat-item {
      padding: 12px;
      background: var(--vscode-editor-background);
      border-radius: 4px;
      text-align: center;
    }
    .stat-value {
      font-size: 20px;
      font-weight: bold;
      color: #4ec9b0;
    }
    .stat-label {
      font-size: 11px;
      opacity: 0.7;
      margin-top: 4px;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>🧠 Learning Memory Settings</h1>
      <p>Your coding errors and solutions are stored locally to help you improve</p>
    </div>

    <div class="section">
      <div class="section-title">Feature Status</div>
      <div class="toggle">
        <input type="checkbox" id="enabledToggle" ${this.settings.enabled ? 'checked' : ''} />
        <label for="enabledToggle">Enable Learning Memory</label>
      </div>
      <div class="setting-description">
        When enabled, Preecode will track errors you encounter and suggest solutions based on your history.
      </div>
    </div>

    <div class="section">
      <div class="section-title">Notifications</div>
      <div class="toggle">
        <input type="checkbox" id="notifyToggle" ${this.settings.autoNotify ? 'checked' : ''} ${this.settings.enabled ? '' : 'disabled'} />
        <label for="notifyToggle">Notify on similar errors</label>
      </div>
      <div class="setting-description">
        Get notified when you encounter an error similar to one you've seen before.
      </div>
    </div>

    <div class="section">
      <div class="section-title">Data Retention</div>
      <div class="setting-row">
        <div>
          <div class="setting-label">Keep memories for</div>
          <div class="setting-description">Older entries will be automatically deleted</div>
        </div>
        <select id="retentionDays" style="padding: 6px 12px; border: 1px solid var(--vscode-panel-border); background: var(--vscode-editor-background); color: var(--vscode-editor-foreground); border-radius: 4px;">
          <option value="30" ${this.settings.retentionDays === 30 ? 'selected' : ''}>30 days</option>
          <option value="90" ${this.settings.retentionDays === 90 ? 'selected' : ''}>90 days</option>
          <option value="180" ${this.settings.retentionDays === 180 ? 'selected' : ''}>180 days</option>
          <option value="365" ${this.settings.retentionDays === 365 ? 'selected' : ''}>1 year</option>
        </select>
      </div>
    </div>

    <div class="section">
      <div class="section-title">Privacy</div>
      <div class="info-box">
        <strong>What we track:</strong>
        <ul style="margin-left: 20px; margin-top: 8px;">
          <li>Error messages and categories</li>
          <li>File names and line numbers</li>
          <li>Project information (frameworks, languages)</li>
          <li>Your solutions and fixes</li>
        </ul>
      </div>
      <div class="info-box" style="border-left-color: #44ff44; background: rgba(68, 255, 68, 0.05);">
        <strong>What we DO NOT track:</strong>
        <ul style="margin-left: 20px; margin-top: 8px;">
          <li>Your source code content</li>
          <li>System information or environment details</li>
          <li>Personal or sensitive information</li>
        </ul>
      </div>
    </div>

    <div class="section">
      <div class="section-title">Memory Management</div>
      <div class="button-group">
        <button class="btn-primary" onclick="viewHistory()">📋 View History</button>
        <button class="btn-primary" onclick="exportMemory()">💾 Export</button>
      </div>
      <div class="button-group">
        <button class="btn-danger" onclick="deleteMemory()">🗑️ Delete All</button>
      </div>
    </div>

    <div class="section">
      <div class="section-title">About</div>
      <p style="font-size: 13px; line-height: 1.6; opacity: 0.8;">
        Learning Memory is an optional feature that helps you learn from your mistakes.
        All data is stored securely and associated only with your account.
        You have full control to disable, export, or delete your data at any time.
      </p>
    </div>
  </div>

  <script>
    const vscode = acquireVsCodeApi();

    document.getElementById('enabledToggle').addEventListener('change', (e) => {
      updateSetting('enabled', e.target.checked);
    });

    document.getElementById('notifyToggle').addEventListener('change', (e) => {
      updateSetting('autoNotify', e.target.checked);
    });

    document.getElementById('retentionDays').addEventListener('change', (e) => {
      updateSetting('retentionDays', parseInt(e.target.value));
    });

    function updateSetting(key, value) {
      vscode.postMessage({
        type: 'settingsUpdated',
        settings: { ${this.settings.enabled ? 'enabled: document.getElementById("enabledToggle").checked' : 'enabled: false'}, autoNotify: document.getElementById('notifyToggle').checked, retentionDays: parseInt(document.getElementById('retentionDays').value) }
      });
    }

    function viewHistory() {
      vscode.postMessage({ type: 'viewHistory' });
    }

    function exportMemory() {
      vscode.postMessage({ type: 'exportMemory' });
    }

    function deleteMemory() {
      vscode.postMessage({ type: 'deleteMemory' });
    }
  </script>
</body>
</html>`;

    return html;
  }

  dispose(): void {
    MemorySettingsPanel.current = undefined;
    this.panel.dispose();
    while (this.disposables.length > 0) {
      const disposable = this.disposables.pop();
      disposable?.dispose();
    }
  }
}
