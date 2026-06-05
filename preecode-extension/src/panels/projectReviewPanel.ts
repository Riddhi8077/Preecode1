import * as vscode from 'vscode';

export interface ProjectReviewFinding {
  category: 'bugs' | 'security' | 'performance' | 'architecture' | 'quality' | 'maintainability';
  severity: 'critical' | 'high' | 'medium' | 'low';
  title: string;
  description: string;
  affectedFiles: string[];
  suggestedFix: string;
  improvedCode?: string;
  rationale?: string;
}

export interface ProjectReviewContent {
  projectSummary: {
    overallScore: number;
    riskLevel: 'low' | 'medium' | 'high';
    mainFindings: string[];
  };
  findings: ProjectReviewFinding[];
  bestPractices: {
    observed: string[];
    recommendations: string[];
    frameworkSpecific: string[];
  };
  performanceInsights: {
    potentialBottlenecks: string[];
    optimization: string;
  };
  filesAnalyzed: number;
  totalFiles: number;
}

export class ProjectReviewPanel {
  private static current: ProjectReviewPanel | undefined;
  private readonly panel: vscode.WebviewPanel;
  private disposables: vscode.Disposable[] = [];
  private currentContent: ProjectReviewContent | null = null;
  private selectedFinding: ProjectReviewFinding | null = null;

  static render(context: vscode.ExtensionContext, extensionUri: vscode.Uri, content: ProjectReviewContent): ProjectReviewPanel {
    if (ProjectReviewPanel.current) {
      ProjectReviewPanel.current.panel.reveal(vscode.ViewColumn.Beside, true);
      ProjectReviewPanel.current.update(content);
      return ProjectReviewPanel.current;
    }

    const panel = vscode.window.createWebviewPanel(
      'preecode.projectReviewPanel',
      'Project Review Results',
      { viewColumn: vscode.ViewColumn.Beside, preserveFocus: true },
      {
        enableScripts: true,
        retainContextWhenHidden: true
      }
    );

    ProjectReviewPanel.current = new ProjectReviewPanel(context, extensionUri, panel);
    ProjectReviewPanel.current.update(content);
    return ProjectReviewPanel.current;
  }

  private constructor(
    private readonly context: vscode.ExtensionContext,
    private readonly extensionUri: vscode.Uri,
    panel: vscode.WebviewPanel
  ) {
    this.panel = panel;
    this.panel.onDidDispose(() => this.dispose(), null, this.disposables);
    this.panel.webview.onDidReceiveMessage(async (message: any) => {
      if (message.type === 'applyFix' && this.selectedFinding?.improvedCode) {
        await this.applyFix(this.selectedFinding.improvedCode);
      }
    }, null, this.disposables);
  }

  update(content: ProjectReviewContent): void {
    this.currentContent = content;
    this.panel.webview.html = this.getHtml();
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
    if (!this.currentContent) {
      return '<html><body>Loading...</body></html>';
    }

    const content = this.currentContent;
    const findingsByCategory: Record<string, ProjectReviewFinding[]> = {};

    for (const finding of content.findings) {
      if (!findingsByCategory[finding.category]) {
        findingsByCategory[finding.category] = [];
      }
      findingsByCategory[finding.category].push(finding);
    }

    const severityColors: Record<string, string> = {
      critical: '#ff4444',
      high: '#ff6666',
      medium: '#ffaa44',
      low: '#44aa44'
    };

    const findingsHtml = Object.entries(findingsByCategory)
      .map(([category, findings]) => `
        <div class="category-group">
          <h4>${category.charAt(0).toUpperCase() + category.slice(1)} (${findings.length})</h4>
          ${findings.map((f, idx) => `
            <div class="finding" style="border-left: 4px solid ${severityColors[f.severity]}">
              <div class="finding-header">
                <span class="title">${f.title}</span>
                <span class="severity">${f.severity.toUpperCase()}</span>
              </div>
              <p>${f.description}</p>
              ${f.affectedFiles.length > 0 ? `<p><strong>Files:</strong> ${f.affectedFiles.join(', ')}</p>` : ''}
              <p><strong>Fix:</strong> ${f.suggestedFix}</p>
              ${f.improvedCode ? `<button onclick="applyCode('${idx}')">Apply Fix</button>` : ''}
            </div>
          `).join('')}
        </div>
      `)
      .join('');

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
      background: var(--vscode-editor-background);
      color: var(--vscode-editor-foreground);
      padding: 20px;
      font-size: 14px;
    }
    .panel-root {
      max-width: 900px;
    }
    .topbar {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 30px;
      padding-bottom: 15px;
      border-bottom: 1px solid var(--vscode-panel-border);
    }
    .title {
      font-size: 18px;
      font-weight: bold;
    }
    .summary {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 20px;
      margin-bottom: 30px;
      padding: 20px;
      background: var(--vscode-panel-background);
      border-radius: 6px;
    }
    .summary-item h3 {
      margin-bottom: 10px;
      font-size: 14px;
      text-transform: uppercase;
      opacity: 0.7;
    }
    .overall-score {
      font-size: 36px;
      font-weight: bold;
      color: #4ec9b0;
    }
    .risk-level {
      font-size: 20px;
      font-weight: bold;
    }
    .main-findings {
      margin-top: 30px;
    }
    .main-findings h3 {
      margin-bottom: 15px;
    }
    .finding-item {
      padding: 8px 12px;
      margin: 8px 0;
      background: var(--vscode-panel-background);
      border-left: 3px solid #cc9944;
      opacity: 0.8;
    }
    .category-group {
      margin-bottom: 25px;
    }
    .category-group h4 {
      margin: 20px 0 10px 0;
      font-size: 14px;
      text-transform: uppercase;
      opacity: 0.7;
    }
    .finding {
      padding: 15px;
      margin: 12px 0;
      background: var(--vscode-panel-background);
      border-radius: 4px;
    }
    .finding-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 10px;
    }
    .finding-header .title {
      font-weight: bold;
      font-size: 13px;
    }
    .finding-header .severity {
      font-size: 11px;
      font-weight: bold;
      padding: 2px 8px;
      background: rgba(255, 68, 68, 0.2);
      border-radius: 3px;
    }
    .finding p {
      margin: 8px 0;
      opacity: 0.9;
      line-height: 1.5;
    }
    button {
      margin-top: 10px;
      padding: 6px 12px;
      background: var(--vscode-button-background);
      color: var(--vscode-button-foreground);
      border: none;
      border-radius: 4px;
      cursor: pointer;
      font-size: 12px;
    }
    button:hover {
      background: var(--vscode-button-hoverBackground);
    }
    .best-practices {
      margin-top: 30px;
      padding: 20px;
      background: var(--vscode-panel-background);
      border-radius: 6px;
    }
    .best-practices h3 {
      margin-bottom: 15px;
    }
    .best-practices h4 {
      margin: 15px 0 8px 0;
      opacity: 0.8;
    }
    .best-practices ul {
      margin-left: 20px;
      opacity: 0.8;
    }
    .best-practices li {
      margin: 5px 0;
    }
    .performance-insights {
      margin-top: 30px;
      padding: 20px;
      background: var(--vscode-panel-background);
      border-radius: 6px;
    }
  </style>
</head>
<body>
  <div class="panel-root">
    <div class="topbar">
      <div class="title">Project Review Results</div>
    </div>

    <div class="summary">
      <div class="summary-item">
        <h3>Overall Score</h3>
        <div class="overall-score">${content.projectSummary.overallScore}/100</div>
      </div>
      <div class="summary-item">
        <h3>Risk Level</h3>
        <div class="risk-level">${content.projectSummary.riskLevel.toUpperCase()}</div>
      </div>
    </div>

    ${content.projectSummary.mainFindings.length > 0 ? `
      <div class="main-findings">
        <h3>Key Findings</h3>
        ${content.projectSummary.mainFindings.map(f => `<div class="finding-item">• ${f}</div>`).join('')}
      </div>
    ` : ''}

    ${findingsHtml ? `
      <div>
        <h3 style="margin: 30px 0 15px 0;">Detailed Findings</h3>
        ${findingsHtml}
      </div>
    ` : ''}

    ${content.bestPractices.observed.length > 0 || content.bestPractices.recommendations.length > 0 ? `
      <div class="best-practices">
        <h3>Best Practices</h3>
        ${content.bestPractices.observed.length > 0 ? `
          <h4>✓ What's Working Well</h4>
          <ul>
            ${content.bestPractices.observed.map(p => `<li>${p}</li>`).join('')}
          </ul>
        ` : ''}
        ${content.bestPractices.recommendations.length > 0 ? `
          <h4>Recommendations</h4>
          <ul>
            ${content.bestPractices.recommendations.map(r => `<li>${r}</li>`).join('')}
          </ul>
        ` : ''}
        ${content.bestPractices.frameworkSpecific.length > 0 ? `
          <h4>Framework-Specific</h4>
          <ul>
            ${content.bestPractices.frameworkSpecific.map(f => `<li>${f}</li>`).join('')}
          </ul>
        ` : ''}
      </div>
    ` : ''}

    ${content.performanceInsights.potentialBottlenecks.length > 0 ? `
      <div class="performance-insights">
        <h3>Performance Insights</h3>
        <h4>Potential Bottlenecks</h4>
        <ul>
          ${content.performanceInsights.potentialBottlenecks.map(b => `<li>${b}</li>`).join('')}
        </ul>
        ${content.performanceInsights.optimization ? `
          <h4 style="margin-top: 15px;">Optimization Advice</h4>
          <p>${content.performanceInsights.optimization}</p>
        ` : ''}
      </div>
    ` : ''}

    <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid var(--vscode-panel-border); opacity: 0.6; font-size: 12px;">
      Analyzed ${content.filesAnalyzed} of ${content.totalFiles} files
    </div>
  </div>

  <script>
    function applyCode(idx) {
      vscode.postMessage({ type: 'applyFix', payload: idx });
    }
  </script>
</body>
</html>`;

    return html;
  }

  dispose(): void {
    ProjectReviewPanel.current = undefined;
    this.panel.dispose();
    while (this.disposables.length > 0) {
      const disposable = this.disposables.pop();
      disposable?.dispose();
    }
  }
}
