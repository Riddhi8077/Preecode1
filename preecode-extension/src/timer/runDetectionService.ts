import * as vscode from 'vscode';
import { preecodeStore } from '../state/store';
import { PracticeTimerService } from './practiceTimerService';

export class RunDetectionService {
  constructor(private readonly timerService: PracticeTimerService) {}

  private isPreecodeTerminal(event: vscode.TerminalShellExecutionStartEvent | vscode.TerminalShellExecutionEndEvent): boolean {
    return event.terminal.name === 'preecode';
  }

  private hasActiveEditorErrors(): boolean {
    const active = vscode.window.activeTextEditor;
    if (!active) {
      return false;
    }
    const diagnostics = vscode.languages.getDiagnostics(active.document.uri);
    return diagnostics.some((item) => item.severity === vscode.DiagnosticSeverity.Error);
  }

  bind(context: vscode.ExtensionContext): void {
    context.subscriptions.push(
      vscode.window.onDidStartTerminalShellExecution((event) => {
        if (!this.isPreecodeTerminal(event) || !this.timerService.isPracticeStarted()) {
          return;
        }
        this.timerService.pauseForRun();
        preecodeStore.setState((state) => ({
          ...state,
          practice: {
            ...state.practice,
            attempts: state.practice.attempts + 1,
            runStatus: 'running'
          }
        }));
      }),
      vscode.window.onDidEndTerminalShellExecution((event) => {
        if (!this.isPreecodeTerminal(event) || !this.timerService.isPracticeStarted()) {
          return;
        }

        const success = event.exitCode === 0 && !this.hasActiveEditorErrors();
        this.timerService.onRunResult(success);
        preecodeStore.setState((state) => ({
          ...state,
          practice: {
            ...state.practice,
            success,
            runStatus: success ? 'success' : 'failure'
          }
        }));
      })
    );
  }
}
