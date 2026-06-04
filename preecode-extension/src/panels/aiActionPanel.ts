import * as vscode from 'vscode';

export interface AiPanelSections {
  problemSummary: string;
  rootCause: string;
  fixExplanation: string;
  improvedCode: string;
}

export interface AiPanelContent extends AiPanelSections {
  language: string;
  selectedCode: string;
  action: string;
}

export class AiActionPanel {
  private static current: AiActionPanel | undefined;
  private readonly panel: vscode.WebviewPanel;
  private disposables: vscode.Disposable[] = [];
  private currentContent: AiPanelContent | null = null;

  static render(context: vscode.ExtensionContext, extensionUri: vscode.Uri, content: AiPanelContent): AiActionPanel {
    if (AiActionPanel.current) {
      AiActionPanel.current.panel.reveal(vscode.ViewColumn.Beside, true);
      AiActionPanel.current.update(content);
      return AiActionPanel.current;
    }

    const panel = vscode.window.createWebviewPanel(
      'preecode.aiActionPanel',
      'Preecode AI Review',
      { viewColumn: vscode.ViewColumn.Beside, preserveFocus: true },
      {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: [
          vscode.Uri.joinPath(extensionUri, 'webview'),
          vscode.Uri.joinPath(extensionUri, 'node_modules', 'monaco-editor', 'min')
        ]
      }
    );

    AiActionPanel.current = new AiActionPanel(context, extensionUri, panel);
    AiActionPanel.current.update(content);
    return AiActionPanel.current;
  }

  private constructor(
    private readonly context: vscode.ExtensionContext,
    private readonly extensionUri: vscode.Uri,
    panel: vscode.WebviewPanel
  ) {
    this.panel = panel;
    this.panel.onDidDispose(() => this.dispose(), null, this.disposables);
    this.panel.webview.onDidReceiveMessage(async (message: { type: string; payload?: string }) => {
      if (message.type === 'applyFix') {
        await this.applyFix(message.payload || this.currentContent?.improvedCode || '');
      }
    }, null, this.disposables);
  }

  update(content: AiPanelContent): void {
    this.currentContent = content;
    this.panel.webview.html = this.getHtml();
    this.panel.webview.postMessage({
      type: 'render',
      payload: content
    });
  }

  private async applyFix(code: string): Promise<void> {
    const editor = vscode.window.activeTextEditor;
    if (!editor || !code.trim()) {
      return;
    }

    const wholeRange = new vscode.Range(
      editor.document.positionAt(0),
      editor.document.positionAt(editor.document.getText().length)
    );

    await editor.edit((builder) => {
      builder.replace(wholeRange, code);
    });

    vscode.window.showInformationMessage('Preecode applied improved code to active editor.');
  }

  private getHtml(): string {
    const webview = this.panel.webview;
    const nonce = String(Date.now());
    const cssUri = webview.asWebviewUri(vscode.Uri.joinPath(this.extensionUri, 'webview', 'ai-panel.css'));
    const scriptUri = webview.asWebviewUri(vscode.Uri.joinPath(this.extensionUri, 'webview', 'ai-panel.js'));
    const monacoBase = webview.asWebviewUri(vscode.Uri.joinPath(this.extensionUri, 'node_modules', 'monaco-editor', 'min'));

    const csp = [
      "default-src 'none'",
      `img-src ${webview.cspSource} https: data:`,
      `style-src ${webview.cspSource} 'unsafe-inline'`,
      `script-src 'nonce-${nonce}'`,
      `font-src ${webview.cspSource}`
    ].join('; ');

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta http-equiv="Content-Security-Policy" content="${csp}" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <link rel="stylesheet" href="${cssUri}" />
  <title>Preecode AI Review</title>
</head>
<body data-monaco-base="${monacoBase}">
  <div class="panel-root">
    <header class="topbar">
      <div class="title">Preecode AI Analysis</div>
      <button id="applyFixBtn" class="primary">Apply Fix</button>
    </header>

    <section class="section">
      <h3>Problem Summary</h3>
      <p id="problemSummary">-</p>
    </section>

    <section class="section">
      <h3>Root Cause</h3>
      <p id="rootCause">-</p>
    </section>

    <section class="section">
      <h3>Fix Explanation</h3>
      <p id="fixExplanation">-</p>
    </section>

    <section class="section split">
      <div>
        <h3>Selected Code</h3>
        <div id="selectedCode" class="editor"></div>
      </div>
      <div>
        <h3>Improved Code</h3>
        <div id="improvedCode" class="editor"></div>
      </div>
    </section>
  </div>

  <script nonce="${nonce}" src="${scriptUri}"></script>
</body>
</html>`;
  }

  dispose(): void {
    AiActionPanel.current = undefined;
    this.panel.dispose();
    while (this.disposables.length > 0) {
      const disposable = this.disposables.pop();
      disposable?.dispose();
    }
  }
}
