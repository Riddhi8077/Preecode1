import * as vscode from 'vscode';
import { requestAssistantAnalysis } from './geminiService';
import { AiPanelSections } from '../panels/aiActionPanel';

export type ControlAction = 'debug' | 'explain' | 'review';

const actionMap: Record<ControlAction, 'debug' | 'explain' | 'find_bugs'> = {
  debug: 'debug',
  explain: 'explain',
  review: 'find_bugs'
};

export async function runAiAction(action: ControlAction): Promise<{
  language: string;
  selectedCode: string;
  sections: AiPanelSections;
}> {
  const editor = vscode.window.activeTextEditor;
  if (!editor) {
    throw new Error('No active editor');
  }

  const selection = editor.selection;
  const selectedCode = editor.document.getText(selection).trim() || editor.document.getText();
  const diagnostics = vscode.languages
    .getDiagnostics(editor.document.uri)
    .map((diag) => `${diag.severity}:${diag.message} @ ${diag.range.start.line + 1}`)
    .join('\n');

  const payload = await requestAssistantAnalysis({
    action: actionMap[action],
    code: selectedCode,
    language: editor.document.languageId,
    diagnostics,
    selectedLine: selection.active.line + 1,
    selectedText: selectedCode,
    fileName: editor.document.fileName
  });

  return {
    language: editor.document.languageId,
    selectedCode,
    sections: {
      problemSummary: payload.problem || '-',
      rootCause: payload.reason || '-',
      fixExplanation: Array.isArray(payload.step_by_step)
        ? payload.step_by_step.join('\n')
        : payload.step_by_step || '-',
      improvedCode: payload.fixed_code || selectedCode
    }
  };
}
