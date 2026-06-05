import * as vscode from 'vscode';
import { getToken, deleteToken } from './authService';
import { ErrorTrackingService, classifyErrorType, createErrorHash } from './errorTrackingService';
import { SimilarityEngine } from './similarityEngine';
import { LearningMemoryEntry, MemorySettings, TrackingContext, SimilarErrorMatch } from '../models/memoryModels';

const API_BASE = 'https://preecode-backend.onrender.com/api';

export class LearningMemoryService {
  private errorTracker: ErrorTrackingService;
  private similarityEngine: SimilarityEngine;
  private settings: MemorySettings = {
    enabled: false,
    autoNotify: true,
    retentionDays: 180
  };
  private memories: LearningMemoryEntry[] = [];
  private disposables: vscode.Disposable[] = [];

  constructor() {
    this.errorTracker = new ErrorTrackingService();
    this.similarityEngine = new SimilarityEngine();
  }

  async initialize(context: vscode.ExtensionContext): Promise<void> {
    // Load settings from configuration
    const config = vscode.workspace.getConfiguration('preecode.learning');
    this.settings = {
      enabled: config.get('enabled', false),
      autoNotify: config.get('autoNotify', true),
      retentionDays: config.get('retentionDays', 180)
    };

    if (!this.settings.enabled) {
      return;
    }

    // Start error monitoring
    const tracker = this.errorTracker.monitor((error) => {
      void this.handleDetectedError(context, error);
    });
    this.disposables.push(tracker);
  }

  private async handleDetectedError(context: vscode.ExtensionContext, error: any): Promise<void> {
    if (!this.settings.enabled) return;

    const token = await getToken(context);
    if (!token) return;

    try {
      const errorCategory = classifyErrorType(error.message, error.source);
      const errorId = createErrorHash(error.message, errorCategory);

      // Track error on backend
      const response = await this.doFetch(`${API_BASE}/memory/track-error`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          errorMessage: error.message,
          stackTrace: error.stackTrace || '',
          fileName: error.file ? vscode.workspace.asRelativePath(error.file) : '',
          fileLanguage: error.language,
          lineNumber: error.line,
          context: error.context,
          projectInfo: this.getProjectInfo(),
          tags: [error.source || 'extension']
        })
      });

      if (!response.ok) {
        console.warn('[Learning Memory] Failed to track error:', response.status);
        return;
      }

      const result: any = await response.json();

      // Check for similar errors
      if (this.settings.autoNotify && result.isNew === false) {
        await this.notifySimilarError(context, errorId, error.message);
      }
    } catch (err) {
      console.error('[Learning Memory] Error tracking failed:', err);
    }
  }

  private async notifySimilarError(context: vscode.ExtensionContext, errorId: string, errorMessage: string): Promise<void> {
    const token = await getToken(context);
    if (!token) return;

    try {
      const response = await this.doFetch(
        `${API_BASE}/memory/similar-errors?errorMessage=${encodeURIComponent(errorMessage.slice(0, 50))}&limit=3`,
        {
          headers: { 'Authorization': `Bearer ${token}` }
        }
      );

      if (!response.ok) return;

      const data: any = await response.json();
      if (data.suggestions && data.suggestions.length > 0) {
        const suggestion = data.suggestions[0];
        const action = await vscode.window.showInformationMessage(
          `Similar error detected! You faced this ${suggestion.solutionsCount || 1} time(s) before.`,
          'View History',
          'Dismiss'
        );

        if (action === 'View History') {
          // TODO: Open memory viewer panel
        }
      }
    } catch (err) {
      console.error('[Learning Memory] Similarity check failed:', err);
    }
  }

  async trackSolution(
    context: vscode.ExtensionContext,
    memoryId: string,
    solution: {
      approach: string;
      code: string;
      userApplied: boolean;
      outcome: 'success' | 'partial' | 'failed';
      timeToFix: number;
      attemptNumber: number;
      sourceType: 'ai' | 'user' | 'docs';
      notes?: string;
    }
  ): Promise<boolean> {
    const token = await getToken(context);
    if (!token) return false;

    try {
      const response = await this.doFetch(`${API_BASE}/memory/track-solution`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          memoryId,
          ...solution
        })
      });

      return response.ok;
    } catch (err) {
      console.error('[Learning Memory] Failed to track solution:', err);
      return false;
    }
  }

  async getHistory(context: vscode.ExtensionContext, page: number = 1): Promise<LearningMemoryEntry[]> {
    const token = await getToken(context);
    if (!token) return [];

    try {
      const response = await this.doFetch(
        `${API_BASE}/memory/history?page=${page}&limit=50`,
        {
          headers: { 'Authorization': `Bearer ${token}` }
        }
      );

      if (!response.ok) return [];

      const data: any = await response.json();
      return data.memories || [];
    } catch (err) {
      console.error('[Learning Memory] Failed to get history:', err);
      return [];
    }
  }

  async getPatterns(context: vscode.ExtensionContext): Promise<any[]> {
    const token = await getToken(context);
    if (!token) return [];

    try {
      const response = await this.doFetch(
        `${API_BASE}/memory/patterns`,
        {
          headers: { 'Authorization': `Bearer ${token}` }
        }
      );

      if (!response.ok) return [];

      const data: any = await response.json();
      return data.patterns || [];
    } catch (err) {
      console.error('[Learning Memory] Failed to get patterns:', err);
      return [];
    }
  }

  async exportMemory(context: vscode.ExtensionContext): Promise<any> {
    const token = await getToken(context);
    if (!token) {
      vscode.window.showErrorMessage('Please login to export memory.');
      return null;
    }

    try {
      const response = await this.doFetch(`${API_BASE}/memory/export`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({})
      });

      if (!response.ok) {
        vscode.window.showErrorMessage('Failed to export memory.');
        return null;
      }

      const data: any = await response.json();

      // Save to file
      const filename = `preecode-memory-${new Date().toISOString().split('T')[0]}.json`;
      const content = JSON.stringify(data, null, 2);

      await vscode.workspace
        .getConfiguration()
        .update('preecode.lastExport', new Date().toISOString(), vscode.ConfigurationTarget.Global);

      vscode.window.showInformationMessage(
        `Memory exported. ${data.summary.totalMemories} memories, ${data.summary.totalPatterns} patterns found.`
      );

      return data;
    } catch (err) {
      vscode.window.showErrorMessage(`Export failed: ${err}`);
      return null;
    }
  }

  async deleteMemory(context: vscode.ExtensionContext): Promise<boolean> {
    const confirm = await vscode.window.showWarningMessage(
      'Delete all learning memory? This cannot be undone.',
      'Delete',
      'Cancel'
    );

    if (confirm !== 'Delete') return false;

    const token = await getToken(context);
    if (!token) return false;

    try {
      const response = await this.doFetch(`${API_BASE}/memory/delete`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ confirmed: true })
      });

      if (response.ok) {
        vscode.window.showInformationMessage('All learning memory deleted.');
        return true;
      }
    } catch (err) {
      vscode.window.showErrorMessage(`Delete failed: ${err}`);
    }

    return false;
  }

  async updateSettings(newSettings: Partial<MemorySettings>): Promise<void> {
    this.settings = { ...this.settings, ...newSettings };

    // Update workspace settings
    await vscode.workspace
      .getConfiguration('preecode.learning')
      .update('enabled', this.settings.enabled, vscode.ConfigurationTarget.Global);
  }

  getSettings(): MemorySettings {
    return { ...this.settings };
  }

  isEnabled(): boolean {
    return this.settings.enabled;
  }

  private getProjectInfo(): TrackingContext {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    const folders = workspaceFolders?.map(f => f.name) || [];

    return {
      projectName: folders[0],
      projectType: 'unknown',
      frameworks: []
    };
  }

  private async doFetch(url: string, opts?: any): Promise<Response> {
    if ((globalThis as any).fetch) {
      return (globalThis as any).fetch(url, opts);
    }
    const mod = await import('node-fetch');
    const fn = (mod && (mod.default || mod)) as any;
    return fn(url, opts);
  }

  dispose(): void {
    this.disposables.forEach(d => d.dispose());
    this.disposables = [];
  }
}

// Global instance
let globalMemoryService: LearningMemoryService | undefined;

export function getLearningMemoryService(): LearningMemoryService {
  if (!globalMemoryService) {
    globalMemoryService = new LearningMemoryService();
  }
  return globalMemoryService;
}
