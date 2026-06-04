import * as vscode from 'vscode';
import { preecodeStore } from '../state/store';

export class PracticeTimerService implements vscode.Disposable {
  private interval: NodeJS.Timeout | null = null;
  private elapsedSeconds = 0;
  private active = false;
  private practiceStarted = false;
  private manuallyPaused = false;
  private completed = false;

  private format(seconds: number): string {
    const mm = String(Math.floor(seconds / 60)).padStart(2, '0');
    const ss = String(seconds % 60).padStart(2, '0');
    return `${mm}:${ss}`;
  }

  start(): void {
    if (this.active) {
      return;
    }

    this.active = true;
    this.interval = setInterval(() => {
      this.elapsedSeconds += 1;
      preecodeStore.setState((state) => ({
        ...state,
        compactTimer: this.format(this.elapsedSeconds),
        practice: {
          ...state.practice,
          timeSpentSeconds: this.elapsedSeconds
        }
      }));
    }, 1000);
  }

  prepareForPractice(): void {
    this.pauseInternal();
    this.elapsedSeconds = 0;
    this.practiceStarted = true;
    this.manuallyPaused = false;
    this.completed = false;
    preecodeStore.setState((state) => ({
      ...state,
      compactTimer: '00:00',
      practice: {
        ...state.practice,
        timeSpentSeconds: 0
      }
    }));
  }

  pause(): void {
    this.manuallyPaused = true;
    this.pauseInternal();
  }

  resumeOnTyping(): void {
    if (!this.practiceStarted || this.completed || this.manuallyPaused) {
      return;
    }
    if (!this.active) {
      this.start();
    }
  }

  resume(): void {
    if (!this.practiceStarted || this.completed) {
      return;
    }
    this.manuallyPaused = false;
    if (!this.active) {
      this.start();
    }
  }

  startNow(): void {
    if (!this.practiceStarted) {
      this.practiceStarted = true;
    }
    this.completed = false;
    this.manuallyPaused = false;
    if (!this.active) {
      this.start();
    }
  }

  stop(): void {
    this.completed = true;
    this.practiceStarted = false;
    this.manuallyPaused = false;
    this.pauseInternal();
  }

  pauseForRun(): void {
    this.pauseInternal();
  }

  onRunResult(success: boolean): void {
    if (!this.practiceStarted) {
      return;
    }
    if (success) {
      this.stop();
      return;
    }
    if (!this.manuallyPaused && !this.completed && !this.active) {
      this.start();
    }
  }

  reset(): void {
    this.pauseInternal();
    this.elapsedSeconds = 0;
    this.practiceStarted = false;
    this.manuallyPaused = false;
    this.completed = false;
    preecodeStore.setState((state) => ({
      ...state,
      compactTimer: '00:00',
      practice: {
        ...state.practice,
        timeSpentSeconds: 0
      }
    }));
  }

  getElapsedSeconds(): number {
    return this.elapsedSeconds;
  }

  isActive(): boolean {
    return this.active;
  }

  isPracticeStarted(): boolean {
    return this.practiceStarted;
  }

  private pauseInternal(): void {
    if (!this.active) {
      return;
    }

    this.active = false;
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
  }

  bindWorkspaceLifecycle(context: vscode.ExtensionContext): void {
    context.subscriptions.push(
      vscode.workspace.onDidChangeTextDocument((event) => {
        const activeEditor = vscode.window.activeTextEditor;
        if (!activeEditor) {
          return;
        }
        if (event.document.uri.toString() !== activeEditor.document.uri.toString()) {
          return;
        }
        // Start timer when user actually types non-whitespace content.
        const hasTypingSignal = event.contentChanges.some((change) => {
          const text = String(change.text || '');
          if (!text || text.indexOf('\n') !== -1 || text.indexOf('\r') !== -1) {
            return false;
          }
          return /\S/.test(text);
        });

        if (hasTypingSignal) {
          this.resumeOnTyping();
        }
      }),
      vscode.window.onDidChangeActiveTextEditor(() => {
        this.pauseInternal();
      })
    );
  }

  dispose(): void {
    this.pauseInternal();
  }
}
