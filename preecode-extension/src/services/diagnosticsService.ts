import * as vscode from 'vscode';

export interface DiagnosticIssue {
  message: string;
  severity: 'error' | 'warning' | 'info' | 'hint';
  line: number;
  character: number;
  endLine: number;
  endCharacter: number;
  source?: string;
  code?: string | number;
}

export interface DiagnosticsSummary {
  hasErrors: boolean;
  hasWarnings: boolean;
  hasPotentialBugs: boolean;
  hasBadSyntax: boolean;
  issues: DiagnosticIssue[];
}

const POTENTIAL_BUG_PATTERNS = [
  /is not defined/i,
  /cannot find name/i,
  /cannot find module/i,
  /is not a function/i,
  /undefined/i,
  /no overload matches/i,
  /not assignable/i,
  /type mismatch/i,
  /missing import/i,
  /argument of type/i,
  /possibly undefined/i
];

const BAD_SYNTAX_PATTERNS = [
  /syntax/i,
  /unexpected/i,
  /parsing/i,
  /unterminated/i,
  /indentation/i,
  /invalid/i
];

function severityToLabel(severity: vscode.DiagnosticSeverity): DiagnosticIssue['severity'] {
  switch (severity) {
    case vscode.DiagnosticSeverity.Error:
      return 'error';
    case vscode.DiagnosticSeverity.Warning:
      return 'warning';
    case vscode.DiagnosticSeverity.Information:
      return 'info';
    case vscode.DiagnosticSeverity.Hint:
      return 'hint';
    default:
      return 'info';
  }
}

export function summarizeDiagnostics(document: vscode.TextDocument): DiagnosticsSummary {
  const diagnostics = vscode.languages.getDiagnostics(document.uri);

  let hasErrors = false;
  let hasWarnings = false;
  let hasPotentialBugs = false;
  let hasBadSyntax = false;

  const issues: DiagnosticIssue[] = diagnostics.map((diag) => {
    const message = diag.message || '';
    const severity = severityToLabel(diag.severity);

    if (severity === 'error') hasErrors = true;
    if (severity === 'warning') hasWarnings = true;

    if (POTENTIAL_BUG_PATTERNS.some((pattern) => pattern.test(message))) {
      hasPotentialBugs = true;
    }

    if (BAD_SYNTAX_PATTERNS.some((pattern) => pattern.test(message))) {
      hasBadSyntax = true;
    }

    return {
      message,
      severity,
      line: diag.range.start.line + 1,
      character: diag.range.start.character + 1,
      endLine: diag.range.end.line + 1,
      endCharacter: diag.range.end.character + 1,
      source: diag.source,
      code: diag.code as string | number | undefined
    };
  });

  return {
    hasErrors,
    hasWarnings,
    hasPotentialBugs,
    hasBadSyntax,
    issues
  };
}

export function diagnosticsToPrompt(summary: DiagnosticsSummary): string {
  if (!summary.issues.length) return 'No diagnostics reported.';

  return summary.issues
    .map((issue) => {
      const code = issue.code ? ` (code ${issue.code})` : '';
      return `[${issue.severity.toUpperCase()}] Line ${issue.line}:${issue.character}${code} - ${issue.message}`;
    })
    .join('\n');
}

export function hasIssueState(summary: DiagnosticsSummary): boolean {
  return summary.hasErrors || summary.hasPotentialBugs || summary.hasBadSyntax;
}
