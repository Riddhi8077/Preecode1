import * as vscode from 'vscode';
import { TrackingContext, LearningMemoryEntry } from '../models/memoryModels';

export class ErrorTrackingService {
  private diagnosticsMap: Map<string, vscode.Diagnostic[]> = new Map();

  monitor(onErrorDetected: (error: any) => void): vscode.Disposable {
    return vscode.languages.onDidChangeDiagnostics((event) => {
      for (const uri of event.uris) {
        const diagnostics = vscode.languages.getDiagnostics(uri);
        this.diagnosticsMap.set(uri.toString(), diagnostics);

        // Extract error information
        for (const diag of diagnostics) {
          if (diag.severity === vscode.DiagnosticSeverity.Error) {
            const error = this.extractErrorInfo(uri, diag);
            onErrorDetected(error);
          }
        }
      }
    });
  }

  private extractErrorInfo(uri: vscode.Uri, diagnostic: vscode.Diagnostic): any {
    const document = vscode.workspace.textDocuments.find(d => d.uri.toString() === uri.toString());

    return {
      message: diagnostic.message,
      severity: diagnostic.severity,
      range: diagnostic.range,
      source: diagnostic.source,
      code: diagnostic.code,
      file: uri.fsPath,
      language: document?.languageId,
      line: diagnostic.range.start.line,
      character: diagnostic.range.start.character,
      context: document ? this.getContext(document, diagnostic.range.start.line) : ''
    };
  }

  private getContext(document: vscode.TextDocument, lineNumber: number): string {
    const start = Math.max(0, lineNumber - 3);
    const end = Math.min(document.lineCount, lineNumber + 4);
    const contextLines = [];

    for (let i = start; i < end; i++) {
      contextLines.push(document.lineAt(i).text);
    }

    return contextLines.join('\n');
  }

  getErrorsForFile(uri: vscode.Uri): vscode.Diagnostic[] {
    return this.diagnosticsMap.get(uri.toString()) || [];
  }

  getAllErrors(): Map<string, vscode.Diagnostic[]> {
    return new Map(this.diagnosticsMap);
  }

  extractStackTrace(): string {
    // Try to get stack trace from output channels or terminal
    // This is a limitation - we can't directly access output text
    // Stack trace extraction would require hooking into the debug adapter
    let stackTrace = '';
    return stackTrace;
  }
}

export function classifyErrorType(message: string, source?: string): string {
  const msg = message.toLowerCase();
  const src = (source || '').toLowerCase();

  if (msg.includes('syntaxerror') || msg.includes('syntax')) return 'syntax';
  if (msg.includes('typeerror') || msg.includes('is not a function') || msg.includes('cannot read')) return 'type';
  if (msg.includes('promise') || msg.includes('await') || msg.includes('async')) return 'async';
  if (msg.includes('performance') || msg.includes('timeout') || msg.includes('slow')) return 'performance';
  if (msg.includes('undefined') || msg.includes('null')) return 'runtime';
  if (src.includes('eslint') && msg.includes('logic')) return 'logic';

  return 'other';
}

export function createErrorHash(message: string, category: string): string {
  // Simple hash - in production, use a proper crypto library
  const str = `${message}|${category}`;
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return Math.abs(hash).toString(16);
}
