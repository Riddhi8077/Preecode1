import * as vscode from 'vscode';
import { preecodeStore } from '../state/store';
import { API_BASE, doFetch } from './apiService';

export interface SyncPayload {
  userId: string;
  topic: string;
  difficulty: string;
  fileName: string;
  timeSpent: number;
  attempts: number;
  hintsUsed: number;
  solutionViewed: boolean;
  success: boolean;
  timestamp: string;
}

export class BackendSyncService implements vscode.Disposable {
  private syncInterval: NodeJS.Timeout | null = null;

  start(): void {
    if (this.syncInterval) {
      return;
    }

    this.syncInterval = setInterval(() => {
      void this.sync('interval');
    }, 120_000);
  }

  async sync(reason: 'interval' | 'major-event'): Promise<void> {
    const state = preecodeStore.getState();
    if (!state.user.isAuthenticated || !state.user.userId || !state.user.token) {
      return;
    }

    preecodeStore.update('syncStatus', 'syncing');

    const payload: SyncPayload = {
      userId: state.user.userId,
      topic: state.practice.topic,
      difficulty: state.practice.difficulty,
      fileName: state.editor.fileName,
      timeSpent: state.practice.timeSpentSeconds,
      attempts: state.practice.attempts,
      hintsUsed: state.practice.hintsUsed,
      solutionViewed: state.practice.solutionViewed,
      success: state.practice.success,
      timestamp: new Date().toISOString()
    };

    if (reason === 'interval' && !String(state.practice.question || '').trim()) {
      preecodeStore.update('syncStatus', 'idle');
      return;
    }

    try {
      const response = await doFetch(`${API_BASE}/practice`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${state.user.token}`,
          'x-sync-reason': reason
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        preecodeStore.update('syncStatus', 'idle');
        return;
      }

      preecodeStore.setState((current) => ({
        ...current,
        syncStatus: 'success',
        lastSyncAt: Date.now()
      }));
    } catch {
      preecodeStore.update('syncStatus', 'idle');
    }
  }

  dispose(): void {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
    }
  }
}
