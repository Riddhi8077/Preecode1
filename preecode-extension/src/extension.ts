import * as dotenv from 'dotenv';
import * as path from 'path';
import * as vscode from 'vscode';
import { AuthManager } from './auth/authManager';
import { generateQuestionFromBackend, sendAIChatMessage, sendPracticeData, sendSubmission, sendProjectReviewRequest } from './services/apiService';
import { BackendSyncService } from './services/backendSyncService';
import { preecodeStore } from './state/store';
import { RunDetectionService } from './timer/runDetectionService';
import { PracticeTimerService } from './timer/practiceTimerService';
import { ControlCenterViewProvider } from './views/controlCenterView';
import { OnboardingService } from './onboarding/onboardingService';
import * as projectReviewService from './services/projectReviewService';
import { ProjectReviewPanel } from './panels/projectReviewPanel';
import { getLearningMemoryService } from './services/learningMemoryService';
import { MemorySettingsPanel } from './panels/memorySettingsPanel';

dotenv.config({
  path: path.resolve(__dirname, '../.env')
});

type QuickAction = FullQuickAction;
const CHAT_HISTORY_KEY = 'preecode.chatHistory';
const MARKER_TOKEN = 'PREECODE';

type MarkerLabel =
  | 'QUESTION_EXPLANATION'
  | 'HINT'
  | 'SOLUTION'
  | 'SOLUTION_EXPLANATION'
  | 'CODE_EVALUATION';

type PracticeAction =
  | 'practice'
  | 'practiceSeries'
  | 'generate'
  | 'detect'
  | 'explainQuestion'
  | 'showHint'
  | 'showSolution'
  | 'explainSolution'
  | 'evaluateCode'
  | 'differentApproach'
  | 'saveQuestion';

interface QuickActionPayload {
  language?: string;
  difficulty?: 'easy' | 'medium' | 'hard';
}

type ToolAction = 'debug' | 'fix' | 'explain' | 'review' | 'reviewProject';

type FullQuickAction = PracticeAction | ToolAction;

interface DebugExecutionStep {
  lineNumber: number;
  codeLine: string;
  variableState: Record<string, unknown>;
  variableChanges: string[];
  explanation: string;
  outputEffect: string;
  conditionResult: 'true' | 'false' | 'n/a';
}

interface DebugSessionState {
  fileUri: string;
  lines: string[];
  lineNumbers: number[];
  startLine: number;
  endLine: number;
  currentIndex: number;
  executionSteps: DebugExecutionStep[];
  lastAnswer: string;
}

function commentPrefixForLanguage(language: string): string {
  return language === 'python' ? '# ' : '// ';
}

function stripCodeFences(text: string): string {
  return text
    .replace(/```[\w-]*\n?/g, '')
    .replace(/```/g, '')
    .trim();
}

function extractNamedBlock(raw: string, name: 'QUESTION' | 'HINT' | 'SOLUTION'): string {
  const rx = new RegExp(`\\[${name}\\]([\\s\\S]*?)(?=\\[QUESTION\\]|\\[HINT\\]|\\[SOLUTION\\]|$)`, 'i');
  const match = raw.match(rx);
  return stripCodeFences((match?.[1] || '').trim());
}

function extractQuestionBlock(raw: string): string {
  const match = raw.match(/\[QUESTION\]([\s\S]*?)(?=\[HINT\]|\[SOLUTION\]|$)/i);
  return (match?.[1] || raw).trim();
}

function wrapLongLine(line: string, maxWidth = 96): string[] {
  const text = String(line || '').trimEnd();
  if (!text || text.length <= maxWidth) {
    return [text];
  }

  const words = text.split(/\s+/).filter(Boolean);
  if (!words.length) {
    return [text];
  }

  const lines: string[] = [];
  let current = '';
  for (const word of words) {
    if (!current) {
      current = word;
      continue;
    }
    const next = `${current} ${word}`;
    if (next.length > maxWidth) {
      lines.push(current);
      current = word;
    } else {
      current = next;
    }
  }
  if (current) {
    lines.push(current);
  }
  return lines;
}

function wrapCommentBody(text: string, maxWidth = 96): string {
  return String(text || '')
    .split('\n')
    .flatMap((line) => wrapLongLine(line, maxWidth))
    .join('\n');
}

async function insertGeneratedQuestion(editor: vscode.TextEditor, rawQuestionText: string, difficulty: string): Promise<void> {
  const language = editor.document.languageId || 'plaintext';
  const prefix = commentPrefixForLanguage(language);
  const questionBody = wrapCommentBody(extractQuestionBlock(rawQuestionText));
  const commented = questionBody
    .split('\n')
    .map((line) => `${prefix}${line}`)
    .join('\n');

  const block = `${prefix}Question (${difficulty})\n${commented}\n`;

  const current = editor.document.getText();
  const glue = current.trim().length === 0 ? '' : '\n\n';

  await editor.edit((builder) => {
    builder.insert(new vscode.Position(editor.document.lineCount, 0), `${glue}${block}`);
  });
}

function markerLine(language: string, label: MarkerLabel, type: 'START' | 'END'): string {
  return `${commentPrefixForLanguage(language)}[${MARKER_TOKEN} ${label} ${type}]`;
}

function getMarkerLines(language: string, label: MarkerLabel): { start: string; end: string } {
  return {
    start: markerLine(language, label, 'START'),
    end: markerLine(language, label, 'END')
  };
}

function hasMarkerBlock(source: string, label: MarkerLabel): boolean {
  return source.includes(`[${MARKER_TOKEN} ${label} START]`) && source.includes(`[${MARKER_TOKEN} ${label} END]`);
}

function removeMarkerBlock(source: string, language: string, label: MarkerLabel): string {
  const { start, end } = getMarkerLines(language, label);
  const from = source.indexOf(start);
  if (from < 0) return source;
  const to = source.indexOf(end, from);
  if (to < 0) return source;
  const endIndex = to + end.length;
  const before = source.slice(0, from).replace(/[ \t]*\n?$/, '\n');
  const after = source.slice(endIndex).replace(/^\n+/, '\n');
  return `${before}${after}`.replace(/\n{3,}/g, '\n\n').trimEnd();
}

function appendSection(source: string, block: string): string {
  const trimmed = source.trimEnd();
  if (!trimmed) return `${block.trim()}\n`;
  return `${trimmed}\n\n${block.trim()}\n`;
}

function buildCommentSection(language: string, label: MarkerLabel, heading: string, body: string): string {
  const prefix = commentPrefixForLanguage(language);
  const { start, end } = getMarkerLines(language, label);
  const lines = stripCodeFences(body)
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => `${prefix}${line}`)
    .join('\n');

  const headingLine = `${prefix}${heading}`;
  return `${start}\n${headingLine}\n${lines || `${prefix}No details available.`}\n${end}`;
}

async function replaceDocument(editor: vscode.TextEditor, nextText: string): Promise<void> {
  const lastLine = editor.document.lineAt(editor.document.lineCount - 1);
  const fullRange = new vscode.Range(new vscode.Position(0, 0), lastLine.range.end);
  await editor.edit((builder) => {
    builder.replace(fullRange, nextText);
  });
}

function detectQuestionFromFile(editor: vscode.TextEditor): { question: string; difficulty: 'easy' | 'medium' | 'hard' } | null {
  const text = editor.document.getText();
  const lines = text.split('\n');
  const prefix = commentPrefixForLanguage(editor.document.languageId).trim();
  const questionLines: string[] = [];

  let difficulty: 'easy' | 'medium' | 'hard' = 'medium';

  // Strategy 1: Try to detect new format [DIFFICULTY: Easy] followed by question
  let difficultyLineIndex = -1;
  for (let i = 0; i < Math.min(lines.length, 5); i++) {
    const trimmed = lines[i].trim();
    const diffMatch = trimmed.match(/\[DIFFICULTY:\s*(easy|medium|hard)\]/i);
    if (diffMatch) {
      difficulty = diffMatch[1].toLowerCase() as 'easy' | 'medium' | 'hard';
      difficultyLineIndex = i;
      break;
    }
  }

  // If new format detected, collect all following comment lines as question
  if (difficultyLineIndex >= 0) {
    for (let i = difficultyLineIndex + 1; i < lines.length; i++) {
      const line = lines[i];
      const trimmed = line.trim();

      if (!trimmed) {
        if (questionLines.length > 0) break;
        continue;
      }

      // Check if line starts with comment prefix
      if (!trimmed.startsWith(prefix)) {
        if (questionLines.length > 0) break;
        continue;
      }

      // Remove comment prefix
      const content = trimmed.replace(new RegExp(`^\\${prefix}\\s*`), '').trim();
      if (content) {
        questionLines.push(content);
      }
    }

    if (questionLines.length > 0) {
      return { question: questionLines.join(' '), difficulty };
    }
  }

  // Strategy 2: Try to detect old format: # question(easy|medium|hard)
  let startAt = -1;
  for (let index = lines.length - 1; index >= 0; index--) {
    const trimmed = lines[index].trim();
    if (!trimmed.startsWith(prefix)) {
      continue;
    }
    const content = trimmed.replace(new RegExp(`^\\${prefix}\\s*`), '').trim();
    const diffMatch = content.match(/^question\s*\((easy|medium|hard)\)/i);
    if (diffMatch) {
      difficulty = diffMatch[1].toLowerCase() as 'easy' | 'medium' | 'hard';
      startAt = index + 1;
      break;
    }
  }

  if (startAt >= 0) {
    questionLines.length = 0; // Reset for new detection
    for (let index = startAt; index < lines.length; index++) {
      const line = lines[index];
      const trimmed = line.trim();
      if (!trimmed) {
        if (questionLines.length > 0) break;
        continue;
      }
      if (!trimmed.startsWith(prefix)) {
        if (questionLines.length > 0) break;
        continue;
      }
      const content = trimmed.replace(new RegExp(`^\\${prefix}\\s*`), '').trim();
      if (!content || /^question\s*\(/i.test(content)) continue;
      questionLines.push(content);
    }

    if (questionLines.length > 0) {
      return { question: questionLines.join(' '), difficulty };
    }
  }

  return null;
}

function toTitleCase(text: string): string {
  return text
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ')
    .trim();
}

const CODING_TOPIC_RULES: Array<{ topic: string; patterns: RegExp[] }> = [
  { topic: 'Loops', patterns: [/\bloop|loops|iteration|iterate|while|for\b/i] },
  { topic: 'Conditionals', patterns: [/\bconditional|conditionals|if|else|elif|switch\b/i] },
  { topic: 'Arrays', patterns: [/\barray|arrays|list|lists|vector\b/i] },
  { topic: 'Strings', patterns: [/\bstring|strings|text|substring|palindrome\b/i] },
  { topic: 'Hashing', patterns: [/\bhash|hashmap|hashing|dictionary|dict|map|set\b/i] },
  { topic: 'Sorting', patterns: [/\bsort|sorting|merge|quick|heap\b/i] },
  { topic: 'Searching', patterns: [/\bsearch|searching|binarysearch|linearsearch\b/i] },
  { topic: 'Recursion', patterns: [/\brecursion|recursive\b/i] },
  { topic: 'Trees', patterns: [/\btree|trees|bst|binarytree|trie\b/i] },
  { topic: 'Graphs', patterns: [/\bgraph|graphs|bfs|dfs|dijkstra|topological\b/i] },
  { topic: 'DP', patterns: [/\bdp|dynamicprogramming|memoization|tabulation\b/i] },
  { topic: 'Greedy', patterns: [/\bgreedy\b/i] },
  { topic: 'Backtracking', patterns: [/\bbacktracking|backtrack\b/i] },
  { topic: 'Stacks', patterns: [/\bstack|stacks\b/i] },
  { topic: 'Queues', patterns: [/\bqueue|queues|deque\b/i] },
  { topic: 'Math', patterns: [/\bmath|number|numbers|prime|gcd|lcm\b/i] }
];

const CODING_FALLBACK_TOPICS = CODING_TOPIC_RULES.map((entry) => entry.topic);

function normalizeTopicToOneWord(input: string, fallback = 'General'): string {
  const text = String(input || '').trim();
  if (!text) {
    return fallback;
  }

  for (const rule of CODING_TOPIC_RULES) {
    if (rule.patterns.some((pattern) => pattern.test(text))) {
      return rule.topic;
    }
  }

  const firstWord = text
    .replace(/[^a-zA-Z\s]/g, ' ')
    .trim()
    .split(/\s+/)[0];
  if (!firstWord) {
    return fallback;
  }
  return toTitleCase(firstWord);
}

function stableRandomTopic(seedSource: string): string {
  const seed = String(seedSource || 'general');
  let hash = 0;
  for (let index = 0; index < seed.length; index++) {
    hash = (hash * 31 + seed.charCodeAt(index)) >>> 0;
  }
  return CODING_FALLBACK_TOPICS[hash % CODING_FALLBACK_TOPICS.length] || 'General';
}

function inferTopicFromPath(filePath: string, language: string, sourceHint = ''): string {
  const extension = path.extname(filePath);
  const fileStem = path.basename(filePath, extension).replace(/[._-]+/g, ' ').trim();
  const parentFolder = path.basename(path.dirname(filePath)).replace(/[._-]+/g, ' ').trim();
  const grandParentFolder = path.basename(path.dirname(path.dirname(filePath))).replace(/[._-]+/g, ' ').trim();

  const ignored = new Set(['src', 'app', 'pages', 'components', 'utils', 'lib', 'code', 'files', 'vscode', 'test']);
  const segments = [grandParentFolder, parentFolder, fileStem]
    .map((segment) => segment.toLowerCase())
    .filter((segment) => segment && !ignored.has(segment));

  const combined = `${segments.join(' ')} ${String(sourceHint || '').slice(0, 1200)}`;
  for (const rule of CODING_TOPIC_RULES) {
    if (rule.patterns.some((pattern) => pattern.test(combined))) {
      return rule.topic;
    }
  }

  const languageDefault = normalizeTopicToOneWord(language, 'General');
  const maybeGeneralLike = ['python', 'javascript', 'typescript', 'java', 'cpp', 'c', 'go', 'ruby'];
  if (!maybeGeneralLike.includes(languageDefault.toLowerCase())) {
    return languageDefault;
  }

  return stableRandomTopic(`${filePath}|${language}|${combined}`);
}

function getTopDiagnostic(editor: vscode.TextEditor): vscode.Diagnostic | null {
  const diagnostics = vscode.languages.getDiagnostics(editor.document.uri);
  if (!diagnostics.length) {
    return null;
  }
  return diagnostics
    .slice()
    .sort((a, b) => {
      const severityDiff = Number(a.severity) - Number(b.severity);
      if (severityDiff !== 0) return severityDiff;
      const lineDiff = a.range.start.line - b.range.start.line;
      if (lineDiff !== 0) return lineDiff;
      return a.range.start.character - b.range.start.character;
    })[0];
}

function getProblemSnippetForDiagnostic(editor: vscode.TextEditor, diagnostic: vscode.Diagnostic): { text: string; range: vscode.Range } {
  const line = editor.document.lineAt(diagnostic.range.start.line);
  return {
    text: line.text.trim(),
    range: line.range
  };
}

async function generateExactReplacement(
  context: vscode.ExtensionContext,
  editor: vscode.TextEditor,
  diagnostic: vscode.Diagnostic,
  problemCode: string
): Promise<string> {
  const prompt = [
    'Return ONLY the corrected replacement code for this exact problematic snippet.',
    'No explanation.',
    `Language: ${editor.document.languageId}`,
    `Diagnostic: ${diagnostic.message} @ line ${diagnostic.range.start.line + 1}`,
    `Snippet:\n${problemCode}`
  ].join('\n\n');

  const response = await askBackendAssistant(context, editor, prompt);
  return stripCodeFences(response || '').trim();
}

function getSortedDiagnostics(editor: vscode.TextEditor): vscode.Diagnostic[] {
  return vscode.languages
    .getDiagnostics(editor.document.uri)
    .slice()
    .sort((a, b) => {
      const severityDiff = Number(a.severity) - Number(b.severity);
      if (severityDiff !== 0) return severityDiff;
      const lineDiff = a.range.start.line - b.range.start.line;
      if (lineDiff !== 0) return lineDiff;
      return a.range.start.character - b.range.start.character;
    });
}

function buildDiagnosticsSummary(editor: vscode.TextEditor): string {
  return getSortedDiagnostics(editor)
    .map((diag) => `L${diag.range.start.line + 1}: ${diag.message}`)
    .join('\n');
}

function buildEditorContext(editor: vscode.TextEditor): string {
  return [
    `Current file: ${editor.document.fileName}`,
    `Language: ${editor.document.languageId}`,
    `Diagnostics:\n${buildDiagnosticsSummary(editor) || 'none'}`
  ].join('\n\n');
}

async function askBackendAssistant(context: vscode.ExtensionContext, editor: vscode.TextEditor, prompt: string): Promise<string> {
  return sendAIChatMessage(
    context,
    prompt,
    `${buildEditorContext(editor)}\n\nCode:\n${editor.document.getText()}`,
    []
  );
}

async function generateFixedFileCode(context: vscode.ExtensionContext, editor: vscode.TextEditor): Promise<string> {
  const prompt = [
    'Fix all diagnostics in this file.',
    'Return the full corrected file code only.',
    'Do not add explanations.',
    'Keep functionality the same and only apply error-fix changes.'
  ].join(' ');
  const raw = await askBackendAssistant(context, editor, prompt);
  return stripCodeFences(raw || '').trim();
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getTopIssueAndFix(editor: vscode.TextEditor, previewCache: Map<string, string>): { topIssue: string; expectedFix: string; cacheKey: string | null } {
  const top = getTopDiagnostic(editor);
  if (!top) {
    return {
      topIssue: '',
      expectedFix: '',
      cacheKey: null
    };
  }

  const problem = getProblemSnippetForDiagnostic(editor, top);
  const cacheKey = [
    editor.document.uri.toString(),
    top.range.start.line,
    top.range.start.character,
    top.range.end.line,
    top.range.end.character,
    top.message,
    problem.text
  ].join('|');

  return {
    topIssue: problem.text || `L${top.range.start.line + 1}: ${top.message}`,
    expectedFix: previewCache.get(cacheKey) || '...',
    cacheKey
  };
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function getLatestMarkerContent(source: string, language: string, label: MarkerLabel): string {
  const { start, end } = getMarkerLines(language, label);
  const pattern = new RegExp(`${escapeRegExp(start)}\\n([\\s\\S]*?)\\n${escapeRegExp(end)}`, 'g');
  let latest = '';
  let match: RegExpExecArray | null = pattern.exec(source);
  while (match) {
    latest = match[1] || '';
    match = pattern.exec(source);
  }
  return latest.trim();
}

function findLastSimpleHintRange(source: string, language: string): { startLine: number; endLine: number } | null {
  const prefix = commentPrefixForLanguage(language).trim();
  const lines = source.split('\n');
  const hintHeading = new RegExp(`^${escapeRegExp(prefix)}\\s*hint\\s*$`, 'i');

  let startLine = -1;
  for (let index = lines.length - 1; index >= 0; index--) {
    if (hintHeading.test(lines[index].trim())) {
      startLine = index;
      break;
    }
  }

  if (startLine < 0) {
    return null;
  }

  let endLine = startLine;
  for (let index = startLine + 1; index < lines.length; index++) {
    const trimmed = lines[index].trim();
    if (!trimmed.startsWith(prefix) || trimmed.includes(`[${MARKER_TOKEN} `)) {
      break;
    }
    endLine = index;
  }

  return { startLine, endLine };
}

function findLastHeadingCommentRange(source: string, language: string, heading: string): { startLine: number; endLine: number } | null {
  const prefix = commentPrefixForLanguage(language).trim();
  const lines = source.split('\n');
  const headingPattern = new RegExp(`^${escapeRegExp(prefix)}\\s*${escapeRegExp(heading)}\\s*$`, 'i');

  let startLine = -1;
  for (let index = lines.length - 1; index >= 0; index--) {
    if (headingPattern.test(lines[index].trim())) {
      startLine = index;
      break;
    }
  }

  if (startLine < 0) {
    return null;
  }

  let endLine = startLine;
  for (let index = startLine + 1; index < lines.length; index++) {
    const trimmed = lines[index].trim();
    if (!trimmed.startsWith(prefix) || trimmed.includes(`[${MARKER_TOKEN} `)) {
      break;
    }
    endLine = index;
  }

  return { startLine, endLine };
}

function hasSimpleQuestionExplanationBlock(source: string, language: string): boolean {
  return findLastHeadingCommentRange(source, language, 'Question Explanation') !== null;
}

function removeSimpleQuestionExplanationBlock(source: string, language: string): string {
  const range = findLastHeadingCommentRange(source, language, 'Question Explanation');
  if (!range) {
    return source;
  }
  const lines = source.split('\n');
  lines.splice(range.startLine, range.endLine - range.startLine + 1);
  return lines.join('\n').replace(/\n{3,}/g, '\n\n').trimEnd();
}

function hasSimpleHintBlock(source: string, language: string): boolean {
  return findLastSimpleHintRange(source, language) !== null;
}

function removeSimpleHintBlock(source: string, language: string): string {
  const range = findLastSimpleHintRange(source, language);
  if (!range) {
    return source;
  }

  const lines = source.split('\n');
  lines.splice(range.startLine, range.endLine - range.startLine + 1);
  return lines.join('\n').replace(/\n{3,}/g, '\n\n').trimEnd();
}

function singleLineHint(text: string): string {
  const line = text
    .split('\n')
    .map((value) => value.trim())
    .find((value) => value.length > 0) || 'Try solving one small example by hand first, then convert those steps into code.';

  return line
    .replace(/^[-*\d.\s]+/, '')
    .replace(/^hint\s*[:\-]?\s*/i, '')
    .trim();
}

function replaceLastOccurrence(source: string, find: string, replaceWith: string): string {
  const idx = source.lastIndexOf(find);
  if (idx < 0) {
    return source;
  }
  return `${source.slice(0, idx)}${replaceWith}${source.slice(idx + find.length)}`;
}

function removeLastOccurrence(source: string, value: string): string {
  return replaceLastOccurrence(source, value, '').replace(/\n{3,}/g, '\n\n').trimEnd();
}

function removeAllOccurrences(source: string, value: string): string {
  if (!value) {
    return source;
  }
  return source.split(value).join('');
}

function findLatestQuestionRange(source: string, language: string): { startLine: number; endLine: number } | null {
  const prefix = commentPrefixForLanguage(language).trim();
  const lines = source.split('\n');
  const headingPattern = new RegExp(`^${escapeRegExp(prefix)}\\s*question\\s*\\((easy|medium|hard)\\)`, 'i');
  const hintPattern = new RegExp(`^${escapeRegExp(prefix)}\\s*hint\\b`, 'i');

  let startLine = -1;
  for (let index = lines.length - 1; index >= 0; index--) {
    if (headingPattern.test(lines[index].trim())) {
      startLine = index;
      break;
    }
  }

  if (startLine < 0) {
    return null;
  }

  let endLine = startLine;
  for (let index = startLine + 1; index < lines.length; index++) {
    const trimmed = lines[index].trim();
    if (!trimmed) {
      endLine = index;
      continue;
    }
    if (hintPattern.test(trimmed)) {
      break;
    }
    if (!trimmed.startsWith(prefix)) {
      break;
    }
    endLine = index;
  }

  return { startLine, endLine };
}

function insertHintAfterQuestion(source: string, language: string, block: string): string {
  const range = findLatestQuestionRange(source, language);
  if (!range) {
    return appendSection(source, block);
  }

  const lines = source.split('\n');
  const before = lines.slice(0, range.endLine + 1).join('\n').trimEnd();
  const after = lines.slice(range.endLine + 1).join('\n').trimStart();

  if (!after) {
    return `${before}\n\n${block.trim()}\n`;
  }

  return `${before}\n\n${block.trim()}\n\n${after}`;
}

function looksLikeRunnableCode(code: string, language: string): boolean {
  const text = stripCodeFences(code).trim();
  if (!text || text.length < 20) {
    return false;
  }
  // Reject responses that are clearly prose/error messages, not code
  if (/^(I'm sorry|I cannot|As an AI|Here is an explanation|This is not|Unfortunately)/i.test(text)) {
    return false;
  }
  return true;
}

function commentOutSolutionBlocks(source: string, language: string): string {
  const prefix = commentPrefixForLanguage(language);
  const { start, end } = getMarkerLines(language, 'SOLUTION');
  const pattern = new RegExp(`${escapeRegExp(start)}\\n([\\s\\S]*?)\\n${escapeRegExp(end)}`, 'g');
  return source.replace(pattern, (_full, inner) => {
    const commented = String(inner)
      .split('\n')
      .map((line) => {
        const trimmed = line.trim();
        if (!trimmed) return line;
        if (trimmed.startsWith(commentPrefixForLanguage(language).trim())) return line;
        return `${prefix}${line}`;
      })
      .join('\n');
    return `${start}\n${commented}\n${end}`;
  });
}

function getCurrentQuestion(editor: vscode.TextEditor): string {
  const fromState = preecodeStore.getState().practice.question.trim();
  if (fromState) return fromState;
  const detected = detectQuestionFromFile(editor);
  return detected?.question || '';
}

function formatElapsedToClock(totalSeconds: number): string {
  const safeSeconds = Math.max(0, Math.floor(totalSeconds));
  const mm = String(Math.floor(safeSeconds / 60)).padStart(2, '0');
  const ss = String(safeSeconds % 60).padStart(2, '0');
  return `${mm}:${ss}`;
}

function parseAiRating(raw: string): number {
  const match = String(raw || '').match(/\d+(?:\.\d+)?/);
  if (!match) {
    return 7;
  }
  const value = Number(match[0]);
  if (!Number.isFinite(value)) {
    return 7;
  }
  return Math.max(0, Math.min(10, Math.round(value)));
}

async function getSimpleAssistantText(
  context: vscode.ExtensionContext,
  editor: vscode.TextEditor,
  prompt: string,
  fallback?: string
): Promise<string> {
  try {
    const text = stripCodeFences(await askBackendAssistant(context, editor, prompt)).trim();
    if (text) {
      return text;
    }

    if (fallback) {
      return fallback;
    }
    throw new Error('AI returned empty output.');
  } catch (error) {
    if (fallback) {
      return fallback;
    }
    const message = error instanceof Error ? error.message : 'AI request failed.';
    throw new Error(message);
  }
}

async function generateRunnableSolution(context: vscode.ExtensionContext, editor: vscode.TextEditor, question: string): Promise<string> {
  const language = editor.document.languageId || 'plaintext';
  const prompt = [
    `Write a complete runnable ${language} solution for this coding question.`,
    'Return only raw code and no markdown.',
    'Include function definition and a small execution block to print/log output.',
    `Question:\n${question}`
  ].join('\n\n');

  const raw = await askBackendAssistant(context, editor, prompt);
  const code = stripCodeFences(raw);
  if (!looksLikeRunnableCode(code, language)) {
    throw new Error('AI returned non-runnable solution output. Try again.');
  }
  return code;
}

async function generateAlternativeRunnableSolution(
  context: vscode.ExtensionContext,
  editor: vscode.TextEditor,
  question: string,
  previousSolution: string
): Promise<string> {
  const language = editor.document.languageId || 'plaintext';
  const prompt = [
    `Write a different runnable ${language} solution for the same coding question.`,
    'Return only raw code with no markdown and no explanation.',
    'Use a genuinely different approach from the previous solution.',
    'Include function definition and an execution block.',
    `Question:\n${question}`,
    `Previous solution to avoid:\n${previousSolution || '(none)'}`
  ].join('\n\n');

  const raw = await askBackendAssistant(context, editor, prompt);
  const code = stripCodeFences(raw);
  if (!looksLikeRunnableCode(code, language)) {
    throw new Error('AI returned non-runnable alternative solution output. Try again.');
  }
  return code;
}

function lineWhy(line: string): string {
  const t = line.trim();
  if (!t) return 'This keeps spacing clear and readable.';
  if (/^(def|function)\b/.test(t)) return 'This defines the main function used to solve the question.';
  if (/^if\s+__name__\s*==\s*["']__main__["']/.test(t)) return 'This ensures the test code runs only when you execute this file directly.';
  if (/^if\b/.test(t)) return 'This checks a condition to choose the correct branch.';
  if (/^for\b|^while\b/.test(t)) return 'This loop processes values step by step.';
  if (/\breturn\b/.test(t)) return 'This returns the final computed result from the function.';
  if (/\bprint\(|\bconsole\.log\(/.test(t)) return 'This prints the output so you can verify the result quickly.';
  if (/=/.test(t)) return 'This stores a value needed for the next steps.';
  return 'This line is part of the solution logic for the question.';
}

interface DebugSourceLine {
  lineNumber: number;
  code: string;
  trimmed: string;
  indent: number;
}

const DEFAULT_DEBUG_INPUT = 4;

function cloneVariableState(state: Record<string, unknown>): Record<string, unknown> {
  try {
    return structuredClone(state);
  } catch {
    return JSON.parse(JSON.stringify(state)) as Record<string, unknown>;
  }
}

function formatDebugValue(value: unknown): string {
  if (value === undefined) return 'undefined';
  if (typeof value === 'string') return `"${value}"`;
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function computeVariableChanges(before: Record<string, unknown>, after: Record<string, unknown>): string[] {
  const keys = new Set([...Object.keys(before), ...Object.keys(after)]);
  const changes: string[] = [];
  for (const key of keys) {
    const prev = before[key];
    const next = after[key];
    if (JSON.stringify(prev) !== JSON.stringify(next)) {
      changes.push(`${key}: ${formatDebugValue(prev)} → ${formatDebugValue(next)}`);
    }
  }
  return changes;
}

function toJsExpression(expr: string): string {
  return expr
    .replace(/\bTrue\b/g, 'true')
    .replace(/\bFalse\b/g, 'false')
    .replace(/\bNone\b/g, 'null')
    .replace(/\bint\s*\(/g, 'Number(')
    .replace(/\bfloat\s*\(/g, 'Number(')
    .replace(/\bstr\s*\(/g, 'String(')
    .replace(/\band\b/g, '&&')
    .replace(/\bor\b/g, '||')
    .replace(/\bnot\b/g, '!');
}

function evaluateExpression(expr: string, variables: Record<string, unknown>): unknown {
  const cleaned = expr.trim();
  if (!cleaned) {
    return undefined;
  }

  const jsExpr = toJsExpression(cleaned).replace(/\binput\s*\([^)]*\)/g, '__preecode_input');
  const keys = Object.keys(variables);
  const values = keys.map((key) => variables[key]);
  try {
    const evaluator = new Function(...keys, '__preecode_input', `return (${jsExpr});`);
    return evaluator(...values, DEFAULT_DEBUG_INPUT);
  } catch {
    return undefined;
  }
}

function parseRangeValues(rawArgs: string, variables: Record<string, unknown>): number[] {
  const args = rawArgs
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => Number(evaluateExpression(part, variables)));

  if (!args.length || args.some((value) => Number.isNaN(value))) {
    return [];
  }

  let start = 0;
  let end = 0;
  let step = 1;

  if (args.length === 1) {
    end = args[0];
  } else if (args.length === 2) {
    start = args[0];
    end = args[1];
  } else {
    start = args[0];
    end = args[1];
    step = args[2];
  }

  if (step === 0) {
    return [];
  }

  const values: number[] = [];
  if (step > 0) {
    for (let current = start; current < end; current += step) {
      values.push(current);
    }
  } else {
    for (let current = start; current > end; current += step) {
      values.push(current);
    }
  }
  return values;
}

function parseIterableValues(raw: string, variables: Record<string, unknown>): unknown[] {
  const match = raw.match(/^range\((.*)\)$/);
  if (match) {
    return parseRangeValues(match[1], variables);
  }

  const evaluated = evaluateExpression(raw, variables);
  if (Array.isArray(evaluated)) {
    return evaluated;
  }
  if (typeof evaluated === 'string') {
    return evaluated.split('');
  }
  if (evaluated && typeof evaluated === 'object') {
    return Object.values(evaluated as Record<string, unknown>);
  }
  return [];
}

function findBlockEnd(lines: DebugSourceLine[], blockStart: number, parentIndent: number): number {
  let index = blockStart;
  while (index < lines.length) {
    const line = lines[index];
    if (!line.trimmed) {
      index += 1;
      continue;
    }
    if (line.indent <= parentIndent) {
      break;
    }
    index += 1;
  }
  return index;
}

function formatRuntimeInline(runtime: Record<string, unknown>): string {
  const keys = Object.keys(runtime);
  if (!keys.length) {
    return 'No variables yet.';
  }
  return keys.map((key) => `${key} = ${formatDebugValue(runtime[key])}`).join(', ');
}

function buildExecutionSteps(lines: DebugSourceLine[]): DebugExecutionStep[] {
  const runtime: Record<string, unknown> = {};
  const executionSteps: DebugExecutionStep[] = [];
  const MAX_WHILE_ITERATIONS = 100;

  const addStep = (
    sourceLine: DebugSourceLine,
    before: Record<string, unknown>,
    after: Record<string, unknown>,
    explanation: string,
    outputEffect = 'None',
    conditionResult: 'true' | 'false' | 'n/a' = 'n/a'
  ): void => {
    executionSteps.push({
      lineNumber: sourceLine.lineNumber,
      codeLine: sourceLine.code,
      variableState: cloneVariableState(after),
      variableChanges: computeVariableChanges(before, after),
      explanation,
      outputEffect,
      conditionResult
    });
  };

  const executeBlock = (start: number, end: number, expectedIndent: number): number => {
    let index = start;

    while (index < end) {
      const line = lines[index];
      if (!line.trimmed || line.trimmed.startsWith('#')) {
        index += 1;
        continue;
      }

      if (line.indent < expectedIndent) {
        break;
      }

      if (line.indent > expectedIndent) {
        index += 1;
        continue;
      }

      const forMatch = line.trimmed.match(/^for\s+([A-Za-z_][\w]*)\s+in\s+(.+):$/);
      if (forMatch) {
        const variableName = forMatch[1];
        const iterableExpr = forMatch[2].trim();
        const blockEnd = findBlockEnd(lines, index + 1, line.indent);
        const iterableValues = parseIterableValues(iterableExpr, runtime);

        if (!iterableValues.length) {
          const before = cloneVariableState(runtime);
          addStep(line, before, cloneVariableState(runtime), `Loop checks ${iterableExpr}, but it has no values so the loop body does not run.`);
        } else {
          for (let iterationIndex = 0; iterationIndex < iterableValues.length; iterationIndex++) {
            const iterationValue = iterableValues[iterationIndex];
            const before = cloneVariableState(runtime);
            runtime[variableName] = iterationValue;
            const after = cloneVariableState(runtime);
            addStep(
              line,
              before,
              after,
              `Loop iteration ${iterationIndex + 1} starts. ${variableName} = ${formatDebugValue(iterationValue)}. Current values: ${formatRuntimeInline(after)}.`
            );
            executeBlock(index + 1, blockEnd, line.indent + 1);
          }

          const beforeExit = cloneVariableState(runtime);
          addStep(line, beforeExit, cloneVariableState(runtime), `Loop ends after ${iterableValues.length} iterations. Current values: ${formatRuntimeInline(runtime)}.`);
        }

        index = blockEnd;
        continue;
      }

      const defMatch = line.trimmed.match(/^def\s+([A-Za-z_][\w]*)\s*\(.*\)\s*:\s*$/);
      if (defMatch) {
        const functionName = defMatch[1];
        const blockEnd = findBlockEnd(lines, index + 1, line.indent);
        const before = cloneVariableState(runtime);
        addStep(line, before, cloneVariableState(runtime), `Defines the function ${functionName}. Function body will run only when it is called.`);
        index = blockEnd;
        continue;
      }

      const whileMatch = line.trimmed.match(/^while\s+(.+):$/);
      if (whileMatch) {
        const conditionExpr = whileMatch[1].trim();
        const blockEnd = findBlockEnd(lines, index + 1, line.indent);
        let guard = 0;
        while (guard < MAX_WHILE_ITERATIONS) {
          const conditionValue = Boolean(evaluateExpression(conditionExpr, runtime));
          const before = cloneVariableState(runtime);
          addStep(
            line,
            before,
            cloneVariableState(runtime),
            conditionValue
              ? `While condition ${conditionExpr} is true, so this iteration runs. Current values: ${formatRuntimeInline(runtime)}.`
              : `While condition ${conditionExpr} is false, so the loop stops.`,
            'None',
            conditionValue ? 'true' : 'false'
          );

          if (!conditionValue) {
            break;
          }

          executeBlock(index + 1, blockEnd, line.indent + 1);
          guard += 1;
        }
        index = blockEnd;
        continue;
      }

      const ifMatch = line.trimmed.match(/^if\s+(.+):$/);
      if (ifMatch) {
        type Clause = { index: number; type: 'if' | 'elif' | 'else'; condition?: string; blockEnd: number };
        const clauses: Clause[] = [];
        let scan = index;

        while (scan < end) {
          const current = lines[scan];
          if (!current.trimmed || current.indent !== line.indent) {
            break;
          }

          const ifClause = current.trimmed.match(/^if\s+(.+):$/);
          const elifClause = current.trimmed.match(/^elif\s+(.+):$/);
          const elseClause = /^else\s*:$/.test(current.trimmed);

          if (ifClause) {
            clauses.push({ index: scan, type: 'if', condition: ifClause[1].trim(), blockEnd: findBlockEnd(lines, scan + 1, current.indent) });
          } else if (elifClause) {
            clauses.push({ index: scan, type: 'elif', condition: elifClause[1].trim(), blockEnd: findBlockEnd(lines, scan + 1, current.indent) });
          } else if (elseClause) {
            clauses.push({ index: scan, type: 'else', blockEnd: findBlockEnd(lines, scan + 1, current.indent) });
          } else {
            break;
          }

          scan = clauses[clauses.length - 1].blockEnd;
          const next = lines[scan];
          if (!next || next.indent !== line.indent || !/^(elif\s+.+:|else\s*:)$/.test(next.trimmed)) {
            break;
          }
        }

        let executedClause: Clause | null = null;
        for (const clause of clauses) {
          const clauseLine = lines[clause.index];
          if (clause.type === 'else') {
            const before = cloneVariableState(runtime);
            addStep(clauseLine, before, cloneVariableState(runtime), 'All previous conditions are false, so else block runs.', 'None', 'n/a');
            executedClause = clause;
            break;
          }

          const conditionExpr = clause.condition || 'False';
          const conditionValue = Boolean(evaluateExpression(conditionExpr, runtime));
          const before = cloneVariableState(runtime);
          addStep(
            clauseLine,
            before,
            cloneVariableState(runtime),
            conditionValue
              ? `Condition ${conditionExpr} is true, so this block runs. Current values: ${formatRuntimeInline(runtime)}.`
              : `Condition ${conditionExpr} is false, so the next branch is checked.`,
            'None',
            conditionValue ? 'true' : 'false'
          );

          if (conditionValue) {
            executedClause = clause;
            break;
          }
        }

        if (executedClause) {
          executeBlock(executedClause.index + 1, executedClause.blockEnd, line.indent + 1);
          index = clauses[clauses.length - 1].blockEnd;
        } else {
          index = scan;
        }
        continue;
      }

      const augAssignMatch = line.trimmed.match(/^([A-Za-z_][\w]*)\s*([+\-*/%]=)\s*(.+)$/);
      if (augAssignMatch) {
        const variableName = augAssignMatch[1];
        const operator = augAssignMatch[2];
        const expr = augAssignMatch[3].trim();
        const before = cloneVariableState(runtime);
        const previousValue = Number(runtime[variableName] ?? 0);
        const evalValue = Number(evaluateExpression(expr, runtime) ?? 0);
        let nextValue = previousValue;
        if (operator === '+=') nextValue = previousValue + evalValue;
        if (operator === '-=') nextValue = previousValue - evalValue;
        if (operator === '*=') nextValue = previousValue * evalValue;
        if (operator === '/=') nextValue = evalValue === 0 ? previousValue : previousValue / evalValue;
        if (operator === '%=') nextValue = evalValue === 0 ? previousValue : previousValue % evalValue;
        runtime[variableName] = nextValue;
        const after = cloneVariableState(runtime);
        const readable = operator.replace('=', '');
        addStep(
          line,
          before,
          after,
          `${variableName} = ${formatDebugValue(previousValue)} ${readable} ${formatDebugValue(evalValue)} → ${formatDebugValue(nextValue)}. Current values: ${formatRuntimeInline(after)}.`
        );
        index += 1;
        continue;
      }

      const assignMatch = line.trimmed.match(/^([A-Za-z_][\w]*)\s*=\s*(.+)$/);
      if (assignMatch && !line.trimmed.includes('==')) {
        const variableName = assignMatch[1];
        const expr = assignMatch[2].trim();
        const before = cloneVariableState(runtime);
        const evaluated = evaluateExpression(expr, runtime);
        runtime[variableName] = evaluated;
        const after = cloneVariableState(runtime);
        if (/\binput\s*\(/.test(expr)) {
          addStep(
            line,
            before,
            after,
            `Reads simulated input value ${DEFAULT_DEBUG_INPUT} and stores it in ${variableName}. Current values: ${formatRuntimeInline(after)}.`
          );
        } else {
          addStep(
            line,
            before,
            after,
            `${variableName} is set to ${formatDebugValue(evaluated)}. Current values: ${formatRuntimeInline(after)}.`
          );
        }
        index += 1;
        continue;
      }

      const printMatch = line.trimmed.match(/^print\((.*)\)$/);
      if (printMatch) {
        const before = cloneVariableState(runtime);
        const expr = printMatch[1].trim();
        const printParts = expr
          .split(',')
          .map((part) => part.trim())
          .filter(Boolean)
          .map((part) => {
            const value = evaluateExpression(part, runtime);
            if (value === undefined) {
              return part.replace(/^['"]|['"]$/g, '');
            }
            return String(value);
          });
        const output = printParts.join(' ');
        addStep(
          line,
          before,
          cloneVariableState(runtime),
          `Prints output: ${output || '(empty)'}. Current values: ${formatRuntimeInline(runtime)}.`,
          output || 'None'
        );
        index += 1;
        continue;
      }

      const before = cloneVariableState(runtime);
      addStep(line, before, cloneVariableState(runtime), lineWhy(line.code));
      index += 1;
    }

    return index;
  };

  executeBlock(0, lines.length, 0);
  return executionSteps;
}

function formatDebugStepSummary(step: DebugExecutionStep, stepIndex: number, totalSteps: number): string {
  void stepIndex;
  void totalSteps;
  return [`Line ${step.lineNumber}`, step.explanation].join('\n');
}

async function buildInlineExplainedSolution(
  context: vscode.ExtensionContext,
  editor: vscode.TextEditor,
  language: string,
  code: string
): Promise<string> {
  const prompt = [
    `Explain this ${language} solution line by line for a beginner.`,
    'Return only code and inline comments.',
    'Rules:',
    `- Keep the original ${language} code lines unchanged in order.`,
    `- After each meaningful line, add exactly one ${language === 'python' ? '#' : '//'} comment line in simple language.`,
    '- Do not use markdown fences.',
    '- Keep comments short and practical.',
    `Code:\n${code}`
  ].join('\n');

  const explained = await askBackendAssistant(context, editor, prompt);
  return stripCodeFences(explained).trim();
}

function blockCommentForLanguage(language: string, title: string, body: string): string {
  const cleanBody = stripCodeFences(body).trim() || 'No details available.';
  if (language === 'python') {
    const lines = cleanBody.split('\n').map((line) => `# ${line}`);
    return [`# ${title}`, ...lines].join('\n');
  }
  return [
    '/*',
    `${title}`,
    '',
    cleanBody,
    '*/'
  ].join('\n');
}

function toShortSimpleExplanation(text: string, maxLines = 2): string {
  const cleaned = stripCodeFences(text)
    .replace(/\s+/g, ' ')
    .trim();

  if (!cleaned) {
    return 'This code runs step by step to produce the result.';
  }

  const sentenceParts = cleaned
    .split(/(?<=[.!?])\s+/)
    .map((part) => part.trim())
    .filter(Boolean);

  const selectedParts = (sentenceParts.length ? sentenceParts : [cleaned]).slice(0, maxLines);
  return selectedParts.join(' ');
}

async function insertSelectionExplanationAsComments(editor: vscode.TextEditor, explanation: string): Promise<void> {
  const selection = editor.selection;
  if (selection.isEmpty) {
    throw new Error('No code selected');
  }

  const language = editor.document.languageId || 'plaintext';
  const prefix = commentPrefixForLanguage(language);
  const commentBlock = [
    `${prefix}Explanation:`,
    ...stripCodeFences(explanation)
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => `${prefix}${line}`)
  ].join('\n');

  const insertionPoint = new vscode.Position(selection.start.line, 0);
  await editor.edit((builder) => {
    builder.insert(insertionPoint, `${commentBlock}\n`);
  });
}

async function generateDebugLineExplanation(
  context: vscode.ExtensionContext,
  editor: vscode.TextEditor,
  lineText: string,
  lineNumber: number,
  startLine: number,
  endLine: number
): Promise<string> {
  const fallback = lineWhy(lineText);
  return getSimpleAssistantText(
    context,
    editor,
    [
      `Explain this line in simple language for a beginner: ${lineText}`,
      `Line number: ${lineNumber}`,
      `Debug range: ${startLine}-${endLine}`,
      'Keep the explanation to 1-2 short sentences.'
    ].join('\n'),
    fallback
  );
}

export async function activate(context: vscode.ExtensionContext): Promise<void> {
  const authManager = new AuthManager(context);
  const onboardingService = new OnboardingService(context);
  const timerService = new PracticeTimerService();
  const runDetectionService = new RunDetectionService(timerService);
  const backendSyncService = new BackendSyncService();
  const memoryService = getLearningMemoryService();

  // Initialize learning memory service (feature is disabled by default)
  await memoryService.initialize(context);
  const latestSolutionByFile = new Map<string, string>();
  const plainSolutionBackupByFile = new Map<string, string>();
  const explainedSolutionByFile = new Map<string, string>();
  const evaluationBlockByFile = new Map<string, string>();
  const selectionExplanationBlocksByFile = new Map<string, string[]>();
  const reviewBlockByFile = new Map<string, string>();
  const issueFixPreviewCache = new Map<string, string>();
  const issueFixPreviewInFlight = new Set<string>();
  const recentGeneratedQuestions: string[] = [];
  let debugSession: DebugSessionState | null = null;

  const getFileKey = (editor: vscode.TextEditor): string => editor.document.uri.toString();

  // Handle fresh install/reinstall - clear auth state on new extension version
  const VERSION_KEY = 'preecode.extensionVersion';
  const CURRENT_VERSION = context.extension.packageJSON.version;
  const previousVersion = context.globalState.get<string>(VERSION_KEY);

  if (previousVersion !== CURRENT_VERSION) {
    // Version changed or first activation - this handles uninstall/reinstall
    await context.globalState.update(VERSION_KEY, CURRENT_VERSION);
    // Clear all authentication state for fresh start
    await authManager.clearAuthState();
    // Reset onboarding for a fresh install
    await onboardingService.resetTour();
  }

  const withGenerationNotification = async <T>(title: string, work: () => Promise<T>): Promise<T> => {
    const result = await vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title,
        cancellable: false
      },
      async () => work()
    );
    void vscode.window.showInformationMessage(`${title} completed.`);
    return result;
  };

  context.subscriptions.push(
    vscode.window.registerUriHandler(authManager),
    timerService,
    backendSyncService,
    {
      dispose: () => memoryService.dispose()
    }
  );

  await authManager.restoreSession();

  // Initialize onboarding
  await onboardingService.init();
  const initialOnboardingState = onboardingService.getState();
  preecodeStore.setState((state) => ({
    ...state,
    onboarding: {
      isActive: initialOnboardingState.isActive,
      currentStep: initialOnboardingState.currentStep,
      isCompleted: initialOnboardingState.isCompleted
    }
  }));

  // Show "Click Preecode icon" message when tour starts
  const unsubscribeOnboardingStart = preecodeStore.subscribe((state) => {
    if (state.onboarding.currentStep === 'click-sidebar-icon' && state.onboarding.isActive) {
      // Auto-transition to next step after sidebar opens (300ms delay)
      setTimeout(async () => {
        await onboardingService.nextStep('sidebar-open');
        const updatedState = onboardingService.getState();
        preecodeStore.setState((s) => ({
          ...s,
          onboarding: {
            isActive: updatedState.isActive,
            currentStep: updatedState.currentStep,
            isCompleted: updatedState.isCompleted
          }
        }));
      }, 500);
    }
  });

  context.subscriptions.push({
    dispose: () => unsubscribeOnboardingStart()
  });

  // Track auth state for onboarding
  let lastAuthState = false;
  const unsubscribeOnboarding = preecodeStore.subscribe((state) => {
    const isNowAuthenticated = state.user.isAuthenticated;
    const wasAuthenticated = lastAuthState;
    lastAuthState = isNowAuthenticated;

    // Detect transition from not logged in to logged in
    if (!wasAuthenticated && isNowAuthenticated && state.onboarding.isActive && state.onboarding.currentStep === 'login') {
      // Wait for UI to fully render, then move to next step
      setTimeout(async () => {
        await onboardingService.nextStep('start-practicing');
        const updatedState = onboardingService.getState();
        preecodeStore.setState((s) => ({
          ...s,
          onboarding: {
            isActive: updatedState.isActive,
            currentStep: updatedState.currentStep,
            isCompleted: updatedState.isCompleted
          }
        }));
        // Show transition message
        void vscode.window.showInformationMessage('🎉 Great! You\'re logged in. Now let\'s explore features!');
      }, 400);
    }
  });

  context.subscriptions.push({
    dispose: () => unsubscribeOnboarding()
  });

  let lastAuthSyncAt = 0;
  const syncAuthIfNeeded = async (): Promise<void> => {
    const now = Date.now();
    if (now - lastAuthSyncAt < 8000) {
      return;
    }
    lastAuthSyncAt = now;
    await authManager.syncFromStoredToken();
  };

  context.subscriptions.push(
    vscode.window.onDidChangeWindowState((event) => {
      if (event.focused) {
        void syncAuthIfNeeded();
      }
    })
  );

  const getChatDisplayName = (): string => {
    const session = preecodeStore.getState().user;
    return (session.username || session.email || 'there').toString();
  };

  const newChatGreeting = (): string => {
    const name = getChatDisplayName();
    return `Hi ${name}! I’m your Preecode AI assistant. Ask me anything about your code, file, or any topic and I’ll guide you step by step.`;
  };

  const resetChat = async (): Promise<void> => {
    preecodeStore.setState((state) => ({
      ...state,
      chat: {
        ...state.chat,
        isLoading: false,
        messages: [
          {
            role: 'assistant',
            text: newChatGreeting(),
            timestamp: Date.now()
          }
        ]
      }
    }));
    await context.workspaceState.update(CHAT_HISTORY_KEY, []);
  };

  await resetChat();

  timerService.bindWorkspaceLifecycle(context);
  runDetectionService.bind(context);
  backendSyncService.start();

  const updateExactFixPreview = async (editor: vscode.TextEditor): Promise<void> => {
    const issueInfo = getTopIssueAndFix(editor, issueFixPreviewCache);
    if (!issueInfo.cacheKey || issueFixPreviewCache.has(issueInfo.cacheKey) || issueFixPreviewInFlight.has(issueInfo.cacheKey)) {
      return;
    }

    const top = getTopDiagnostic(editor);
    if (!top) {
      return;
    }

    issueFixPreviewInFlight.add(issueInfo.cacheKey);
    try {
      const problem = getProblemSnippetForDiagnostic(editor, top);
      const fixed = await generateExactReplacement(context, editor, top, problem.text);
      if (!fixed) {
        return;
      }
      issueFixPreviewCache.set(issueInfo.cacheKey, fixed);

      const active = vscode.window.activeTextEditor;
      if (active && active.document.uri.toString() === editor.document.uri.toString()) {
        updateEditorState(active);
      }
    } catch {
      // Keep fallback text when exact replacement can't be generated.
    } finally {
      issueFixPreviewInFlight.delete(issueInfo.cacheKey);
    }
  };

  const updateEditorState = (editor: vscode.TextEditor | undefined): void => {
    if (!editor) {
      preecodeStore.setState((state) => ({
        ...state,
        editor: {
          fileName: 'No file',
          language: '-',
          selection: '',
          hasSelection: false,
          topIssue: '',
          expectedFix: '',
          hasQuestionExplanation: false,
          hasHint: false,
          hasSolutionExplanation: false,
          hasCodeEvaluation: false,
          hasSelectionExplanation: false,
          hasVisibleSolution: false,
          hasReview: false
        }
      }));
      return;
    }

    const selectionText = editor.document.getText(editor.selection);
    const issueInfo = getTopIssueAndFix(editor, issueFixPreviewCache);
    const source = editor.document.getText();
    const fileKey = getFileKey(editor);
    const trackedSelectionExplanationBlocks = selectionExplanationBlocksByFile.get(fileKey) || [];
    const presentSelectionExplanationBlocks = trackedSelectionExplanationBlocks.filter((block) => source.includes(block));
    if (presentSelectionExplanationBlocks.length !== trackedSelectionExplanationBlocks.length) {
      if (presentSelectionExplanationBlocks.length) {
        selectionExplanationBlocksByFile.set(fileKey, presentSelectionExplanationBlocks);
      } else {
        selectionExplanationBlocksByFile.delete(fileKey);
      }
    }
    const reviewBlock = reviewBlockByFile.get(fileKey);
    const hasReview = Boolean(reviewBlock && source.includes(reviewBlock));
    if (!hasReview && reviewBlock) {
      reviewBlockByFile.delete(fileKey);
    }
    const latestSolution = latestSolutionByFile.get(fileKey);
    const explainedSolution = explainedSolutionByFile.get(fileKey);
    preecodeStore.setState((state) => ({
      ...state,
      editor: {
        fileName: path.basename(editor.document.fileName),
        language: editor.document.languageId,
        selection: selectionText,
        hasSelection: Boolean(selectionText.trim()),
        topIssue: issueInfo.topIssue,
        expectedFix: issueInfo.expectedFix,
        hasQuestionExplanation: hasMarkerBlock(source, 'QUESTION_EXPLANATION') || hasSimpleQuestionExplanationBlock(source, editor.document.languageId || 'plaintext'),
        hasHint: hasMarkerBlock(source, 'HINT') || hasSimpleHintBlock(source, editor.document.languageId || 'plaintext'),
        hasSolutionExplanation: plainSolutionBackupByFile.has(getFileKey(editor)),
        hasCodeEvaluation: hasMarkerBlock(source, 'CODE_EVALUATION') || (evaluationBlockByFile.get(getFileKey(editor)) ? source.includes(evaluationBlockByFile.get(getFileKey(editor)) as string) : false),
        hasSelectionExplanation: presentSelectionExplanationBlocks.length > 0,
        hasVisibleSolution: Boolean(
          (latestSolution && source.includes(latestSolution)) ||
          (explainedSolution && source.includes(explainedSolution))
        ),
        hasReview
      }
    }));

    void updateExactFixPreview(editor);
  };

  const postDebugState = (): void => {
    if (!debugSession) {
      return;
    }
    const session = debugSession;
    const currentStep = session.executionSteps[session.currentIndex];
    if (!currentStep) {
      return;
    }

    const active = vscode.window.activeTextEditor;
    if (active && active.document.uri.toString() === session.fileUri) {
      const targetLine = Math.max(0, Math.min(active.document.lineCount - 1, currentStep.lineNumber - 1));
      const lineRange = active.document.lineAt(targetLine).range;
      active.selection = new vscode.Selection(lineRange.start, lineRange.end);
      active.revealRange(lineRange, vscode.TextEditorRevealType.InCenterIfOutsideViewport);
    }

    controlCenter.postMessage({
      type: 'debugState',
      payload: {
        lines: session.lines,
        lineNumbers: session.lineNumbers,
        currentIndex: session.currentIndex,
        totalSteps: session.executionSteps.length,
        currentLine: currentStep.lineNumber,
        endLine: session.endLine,
        explanation: formatDebugStepSummary(currentStep, session.currentIndex, session.executionSteps.length),
        answer: session.lastAnswer || ''
      }
    });
  };

  // Language-specific topics for practice series
  const languageTopics: Record<string, string[]> = {
    python: ['Lists', 'Strings', 'Recursion', 'Sorting', 'Searching', 'Hashing', 'Dynamic Programming', 'Trees', 'Graphs', 'Sets', 'Custom Topic'],
    java: ['Arrays', 'Strings', 'Collections', 'OOP', 'Recursion', 'Sorting', 'Hashing', 'Trees', 'Graphs', 'Streams', 'Custom Topic'],
    'c++': ['Arrays', 'Pointers', 'Strings', 'Sorting', 'Searching', 'Hashing', 'Trees', 'Graphs', 'STL', 'Algorithms', 'Custom Topic'],
    javascript: ['Arrays', 'Strings', 'Objects', 'Closures', 'Promises', 'Async', 'DOM', 'ES6', 'Recursion', 'Algorithms', 'Custom Topic'],
    c: ['Arrays', 'Pointers', 'Strings', 'Structs', 'File I/O', 'Memory Management', 'Recursion', 'Searching', 'Sorting', 'Custom Topic'],
    html: ['Forms', 'Semantics', 'Accessibility', 'Validation', 'Meta Tags', 'Structure', 'Best Practices', 'Custom Topic'],
    css: ['Selectors', 'Box Model', 'Flexbox', 'Grid', 'Animations', 'Responsive Design', 'Media Queries', 'Transitions', 'Custom Topic']
  };

  // Helper: Extract filename from question text
  const extractFilename = (rawQuestion: string, index: number, language: string): string => {
    const ext = languageExtensions[language.toLowerCase()] || '.txt';
    const indexPrefix = String(index + 1).padStart(2, '0');

    // Extract the QUESTION block content
    const questionMatch = rawQuestion.match(/\[QUESTION\]([\s\S]*?)(?=\[HINT\]|\[SOLUTION\]|$)/i);
    const questionText = (questionMatch?.[1] || rawQuestion).trim();

    // Extract meaningful name from first line of question
    const firstLine = questionText.split('\n')[0].trim();

    // Remove common question starters and get core words
    let cleanedText = firstLine
      .replace(/^(write|create|implement|find|calculate|determine|check|validate|given|given:)\s+/i, '')
      .replace(/[^a-zA-Z0-9\s]/g, '')
      .toLowerCase()
      .trim();

    // Extract significant words (filter out common stop words)
    const stopWords = ['the', 'and', 'or', 'you', 'for', 'are', 'from', 'that', 'this', 'with', 'which', 'to', 'a', 'an', 'of', 'in', 'on', 'at', 'by', 'as', 'is', 'be'];
    const words = cleanedText
      .split(/\s+/)
      .filter(w => w.length > 2 && !stopWords.includes(w))
      .slice(0, 3); // Take up to 3 words

    let name = words.join('_');

    // Final fallback if no meaningful words found
    if (!name || name.length < 2) {
      name = 'question';
    }

    // Ensure name doesn't exceed reasonable length
    if (name.length > 30) {
      name = name.substring(0, 30);
    }

    return `${indexPrefix}_${name}${ext}`;
  };

  // Helper: Get language extension
  const languageExtensions: Record<string, string> = {
    python: '.py',
    java: '.java',
    'c++': '.cpp',
    javascript: '.js',
    c: '.c',
    html: '.html',
    css: '.css'
  };

  // Helper: Normalize difficulty
  const normalizeDifficulty = (diff: string): 'easy' | 'medium' | 'hard' => {
    const d = diff.toLowerCase();
    if (d === 'easy' || d === 'medium' || d === 'hard') return d as 'easy' | 'medium' | 'hard';
    return 'easy';
  };

  // Helper: Check if question matches the selected topic (STRICT validation)
  const questionMatchesTopic = (questionText: string, selectedTopic: string): boolean => {
    if (selectedTopic === 'Mixed Topics') {
      return true; // No filtering for mixed topics
    }

    const questionLower = questionText.toLowerCase();
    const topicLower = selectedTopic.toLowerCase();

    // Topic keyword matching - strict version
    const topicKeywords: Record<string, { primary: string[]; secondary: string[] }> = {
      'arrays': { primary: ['array', 'list', 'index', 'element'], secondary: ['subarray', 'rotate', 'sorted array'] },
      'strings': { primary: ['string', 'character', 'substring'], secondary: ['palindrome', 'anagram', 'reverse', 'concatenate'] },
      'searching': { primary: ['search', 'find', 'binary search'], secondary: ['linear search', 'lookup'] },
      'sorting': { primary: ['sort', 'sorted', 'order'], secondary: ['ascending', 'descending', 'quicksort', 'mergesort'] },
      'recursion': { primary: ['recursive', 'recursion'], secondary: ['base case', 'stack overflow', 'call stack'] },
      'dynamic programming': { primary: ['dynamic', 'memo', 'subproblem'], secondary: ['optimal substructure', 'overlapping'] },
      'hashing': { primary: ['hash', 'hashmap', 'hashtable'], secondary: ['duplicate', 'frequency', 'count'] },
      'trees': { primary: ['tree', 'node', 'binary tree'], secondary: ['leaf', 'root', 'bst', 'traversal', 'level order'] },
      'graphs': { primary: ['graph', 'vertex', 'edge'], secondary: ['path', 'cycle', 'connected', 'adjacency'] },
      'stacks': { primary: ['stack', 'lifo'], secondary: ['push', 'pop', 'tos'] },
      'queues': { primary: ['queue', 'fifo'], secondary: ['enqueue', 'dequeue'] },
      'linked lists': { primary: ['linked list', 'node', 'pointer'], secondary: ['reference', 'next', 'prev'] },
      'heaps': { primary: ['heap', 'priority'], secondary: ['min heap', 'max heap'] },
      'oop': { primary: ['class', 'object', 'inheritance'], secondary: ['encapsulation', 'polymorphism', 'method'] },
      'collections': { primary: ['collection', 'map', 'set'], secondary: ['list', 'array', 'hashmap'] }
    };

    const keywordSet = topicKeywords[topicLower];
    if (!keywordSet) {
      // For custom topics, just check if topic name appears in question
      return questionLower.includes(topicLower);
    }

    // STRICT: Must have at least one primary keyword OR at least 2 secondary keywords
    const hasPrimaryKeyword = keywordSet.primary.some(keyword => questionLower.includes(keyword));
    const secondaryKeywordCount = keywordSet.secondary.filter(keyword => questionLower.includes(keyword)).length;

    return hasPrimaryKeyword || secondaryKeywordCount >= 2;
  };

  // Main practice series handler
  const runPracticeSeries = async (): Promise<void> => {
    try {
      // Step 1: Language selection
      const languageOptions = ['Python', 'Java', 'C++', 'JavaScript', 'C', 'HTML', 'CSS', 'Custom Language'];
      const languagePick = await vscode.window.showQuickPick(languageOptions, {
        placeHolder: 'Select programming language'
      });
      if (!languagePick) return;

      let selectedLanguage = languagePick.toLowerCase().replace(/\s+/g, '_');
      if (languagePick === 'Custom Language') {
        const customLang = await vscode.window.showInputBox({
          prompt: 'Enter language name',
          placeHolder: 'e.g., Go, Rust, PHP'
        });
        if (!customLang?.trim()) return;
        selectedLanguage = customLang.trim().toLowerCase();
      }

      // Step 2: Topic selection
      const topics = languageTopics[selectedLanguage.toLowerCase()] || ['Custom Topic'];
      const topicOptions = [...topics, 'Mixed Topics'];
      const topicPick = await vscode.window.showQuickPick(topicOptions, {
        placeHolder: 'Select topic'
      });
      if (!topicPick) return;

      let selectedTopic = topicPick;
      if (topicPick === 'Custom Topic') {
        const customTopic = await vscode.window.showInputBox({
          prompt: 'Enter custom topic',
          placeHolder: 'e.g., Linked Lists, Dynamic Programming'
        });
        if (!customTopic?.trim()) return;
        selectedTopic = customTopic.trim();
      }

      // Step 4: Question count
      const countOptions = ['5', '10', '15', '20', 'Custom number'];
      const countPick = await vscode.window.showQuickPick(countOptions, {
        placeHolder: 'Select number of questions'
      });
      if (!countPick) return;

      let questionCount = 5;
      if (countPick === 'Custom number') {
        const customCount = await vscode.window.showInputBox({
          prompt: 'Enter number of questions (1-100)',
          validateInput: (v) => {
            const num = parseInt(v, 10);
            if (isNaN(num) || num < 1 || num > 100) return 'Enter a number between 1 and 100';
            return '';
          }
        });
        if (!customCount) return;
        questionCount = parseInt(customCount, 10);
      } else {
        questionCount = parseInt(countPick, 10);
      }

      // Step 5: Difficulty level
      const difficultyOptions = ['Easy', 'Medium', 'Hard', 'Mix'];
      const difficultyPick = await vscode.window.showQuickPick(difficultyOptions, {
        placeHolder: 'Select difficulty level'
      });
      if (!difficultyPick) return;

      // Confirmation dialog before creating series
      const confirmSeries = await vscode.window.showInformationMessage(
        `Create ${questionCount} ${difficultyPick} difficulty question${questionCount !== 1 ? 's' : ''} in ${languagePick} about ${selectedTopic}?\n\nYou will be asked to select a folder location to save this series.`,
        { title: 'Continue', isCloseAffordance: false },
        { title: 'Cancel', isCloseAffordance: true }
      );
      if (!confirmSeries || confirmSeries.title === 'Cancel') {
        return;
      }

      // Step 3: Folder location (after all selections confirmed)
      const folderUri = await vscode.window.showOpenDialog({
        canSelectFolders: true,
        canSelectFiles: false,
        canSelectMany: false,
        title: `Create ${languagePick} series: ${questionCount} ${difficultyPick} question${questionCount !== 1 ? 's' : ''}`,
        openLabel: 'Create Series Here'
      });
      if (!folderUri || folderUri.length === 0) return;
      const selectedFolder = folderUri[0];

      // Determine difficulty distribution
      let difficulties: ('easy' | 'medium' | 'hard')[] = [];
      if (difficultyPick.toLowerCase() === 'mix') {
        const easy = Math.floor(questionCount / 3);
        const medium = Math.floor(questionCount / 3);
        const hard = Math.floor(questionCount / 3);
        const remaining = questionCount - easy - medium - hard;

        difficulties = [
          ...Array(easy).fill('easy'),
          ...Array(medium).fill('medium'),
          ...Array(hard).fill('hard'),
          ...Array(remaining).fill(['easy', 'medium', 'hard'][Math.floor(Math.random() * 3)] as 'easy' | 'medium' | 'hard')
        ];
        // Shuffle to mix them
        for (let i = difficulties.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [difficulties[i], difficulties[j]] = [difficulties[j], difficulties[i]];
        }
      } else {
        const difficulty = normalizeDifficulty(difficultyPick);
        difficulties = Array(questionCount).fill(difficulty as 'easy' | 'medium' | 'hard');
      }

      // Create series folder
      const folderName = `preecode_${selectedLanguage.replace(/\s+/g, '_')}_practice_series`;
      const seriesFolderUri = vscode.Uri.joinPath(selectedFolder, folderName);

      await vscode.workspace.fs.createDirectory(seriesFolderUri);

      // Generate questions and create files
      await vscode.window.withProgress({
        location: vscode.ProgressLocation.Notification,
        title: 'Generating practice series',
        cancellable: false
      }, async (progress) => {
        const generatedQuestions: Array<{ content: string; filename: string }> = [];
        let totalAttempts = 0;
        const maxAttemptsPerQuestion = 8;
        const maxTotalAttempts = questionCount * maxAttemptsPerQuestion;

        for (let i = 0; i < questionCount && totalAttempts < maxTotalAttempts; i++) {
          let questionGenerated = false;
          let attemptsForThisQuestion = 0;

          while (!questionGenerated && attemptsForThisQuestion < maxAttemptsPerQuestion && totalAttempts < maxTotalAttempts) {
            attemptsForThisQuestion++;
            totalAttempts++;

            progress.report({
              message: `Generating question ${i + 1}/${questionCount}...`,
              increment: (100 / questionCount) / 2
            });

            try {
              const questionText = await generateQuestionFromBackend(context, {
                language: selectedLanguage,
                difficulty: difficulties[i],
                topic: selectedTopic !== 'Mixed Topics' ? selectedTopic : undefined
              });

              if (!questionMatchesTopic(questionText, selectedTopic)) {
                continue;
              }

              const filename = extractFilename(questionText, i, selectedLanguage);
              const difficulty_level = difficulties[i].charAt(0).toUpperCase() + difficulties[i].slice(1);

              const questionOnly = extractQuestionBlock(questionText);
              const commentChar = commentPrefixForLanguage(selectedLanguage);

              const wrappedQuestion = wrapCommentBody(questionOnly, 80);
              const commentedLines = wrappedQuestion
                .split('\n')
                .map(line => line ? `${commentChar}${line}` : commentChar)
                .join('\n');

              const fileContent = `${commentChar}[DIFFICULTY: ${difficulty_level}]\n${commentChar}\n${commentedLines}`;

              generatedQuestions.push({
                content: fileContent,
                filename: filename
              });

              questionGenerated = true;

              progress.report({
                increment: (100 / questionCount) / 2
              });
            } catch (error: any) {
              if (attemptsForThisQuestion >= maxAttemptsPerQuestion) {
                vscode.window.showWarningMessage(`Failed to generate question ${i + 1} after ${maxAttemptsPerQuestion} attempts`);
              }
            }
          }

          if (!questionGenerated) {
            vscode.window.showWarningMessage(`Could not generate question ${i + 1}. Stopping series generation.`);
            break;
          }
        }

        if (generatedQuestions.length < questionCount) {
          vscode.window.showWarningMessage(`Only generated ${generatedQuestions.length}/${questionCount} questions.`);
          return;
        }

        progress.report({ message: 'Creating files...' });
        for (const question of generatedQuestions) {
          const fileUri = vscode.Uri.joinPath(seriesFolderUri, question.filename);
          await vscode.workspace.fs.writeFile(fileUri, Buffer.from(question.content, 'utf8'));
        }
      });

      // Open folder in VS Code
      await vscode.commands.executeCommand('vscode.openFolder', seriesFolderUri, false);

      // Focus File Explorer so user sees the created files
      await vscode.commands.executeCommand('workbench.view.explorer');

      vscode.window.showInformationMessage(`Practice series created: ${folderName}`);

    } catch (error: any) {
      vscode.window.showErrorMessage(`Error creating practice series: ${error?.message || 'Unknown error'}`);
      console.error('Practice series error:', error);
    }
  };

  const runQuickAction = async (action: QuickAction, payload?: QuickActionPayload): Promise<void> => {
    const trackHelpUsage = (): void => {
      preecodeStore.setState((state) => ({
        ...state,
        practice: {
          ...state.practice,
          hintsUsed: state.practice.hintsUsed + 1
        }
      }));
    };

    if (action === 'practice') {
      timerService.prepareForPractice();
      preecodeStore.setState((state) => ({
        ...state,
        practice: {
          ...state.practice,
          hintsUsed: 0,
          solutionViewed: false,
          success: false,
          runStatus: 'idle'
        }
      }));
      return;
    }

    if (action === 'practiceSeries') {
      await runPracticeSeries();
      return;
    }

    if (action === 'generate') {
      const active = vscode.window.activeTextEditor;
      if (!active) {
        vscode.window.showErrorMessage('Open a file to generate a practice question.');
        return;
      }

      const language = String(payload?.language || active.document.languageId || 'plaintext').toLowerCase();
      const detectedTopic = inferTopicFromPath(active.document.fileName, language, active.document.getText());

      const topicConfirmation = await vscode.window.showQuickPick(
        ['Yes, use detected topic', 'No, enter my own topic'],
        {
          placeHolder: `Detected topic: ${detectedTopic}. Is this okay?`
        }
      );
      if (!topicConfirmation) {
        return;
      }

      let topic = detectedTopic;
      if (topicConfirmation.startsWith('No')) {
        const customTopic = await vscode.window.showInputBox({
          prompt: 'Enter your topic for practice question',
          value: detectedTopic
        });
        if (!customTopic?.trim()) {
          return;
        }
        topic = normalizeTopicToOneWord(customTopic.trim(), detectedTopic);
      }

      topic = normalizeTopicToOneWord(topic, detectedTopic);

      const difficultyPick = await vscode.window.showQuickPick(['Easy', 'Medium', 'Hard'], {
        placeHolder: 'Select difficulty level'
      });
      if (!difficultyPick) {
        return;
      }
      const difficulty = difficultyPick.toLowerCase() as 'easy' | 'medium' | 'hard';
      if (!difficulty) {
        return;
      }

      let generated = '';
      try {
        generated = await withGenerationNotification('Generating question', async () => {
          return generateQuestionFromBackend(context, {
            language,
            difficulty
          });
        });
      } catch (error) {
        const detail = error instanceof Error ? error.message : 'Could not generate question.';
        const retry = await vscode.window.showErrorMessage(
          `Question generation failed: ${detail}`,
          'Retry'
        );
        if (retry === 'Retry') {
          await runQuickAction('generate', payload);
        }
        return;
      }

      const generatedQuestionText = extractQuestionBlock(generated);
      if (generatedQuestionText) {
        recentGeneratedQuestions.unshift(generatedQuestionText);
        if (recentGeneratedQuestions.length > 8) {
          recentGeneratedQuestions.length = 8;
        }
      }

      await insertGeneratedQuestion(active, generated, difficulty);

      preecodeStore.setState((state) => ({
        ...state,
        practice: {
          ...state.practice,
          question: generatedQuestionText || `Practice started for ${state.editor.fileName}`,
          difficulty,
          topic,
          hintsUsed: 0,
          solutionViewed: false,
          success: false,
          runStatus: 'idle'
        }
      }));
      controlCenter.postMessage({ type: 'setMode', mode: 'solution' });
      await backendSyncService.sync('major-event');
      return;
    }

    if (action === 'detect') {
      const active = vscode.window.activeTextEditor;
      if (!active) {
        vscode.window.showErrorMessage('Open a file to detect question.');
        return;
      }

      const detected = await withGenerationNotification('Detecting question', async () => detectQuestionFromFile(active));
      if (!detected) {
        vscode.window.showWarningMessage('No question detected in current file comments.');
        return;
      }

      preecodeStore.setState((state) => ({
        ...state,
        practice: {
          ...state.practice,
          question: detected.question,
          difficulty: detected.difficulty,
          topic: active.document.languageId || state.practice.topic,
          hintsUsed: 0,
          solutionViewed: false,
          success: false,
          runStatus: 'idle'
        }
      }));
      controlCenter.postMessage({ type: 'setMode', mode: 'solution' });
      await backendSyncService.sync('major-event');
      return;
    }

    if (action === 'explainQuestion') {
      const active = vscode.window.activeTextEditor;
      if (!active) {
        vscode.window.showErrorMessage('Open a file to explain question.');
        return;
      }

      const language = active.document.languageId || 'plaintext';
      const current = active.document.getText();

      if (hasMarkerBlock(current, 'QUESTION_EXPLANATION')) {
        const next = removeMarkerBlock(current, language, 'QUESTION_EXPLANATION');
        await replaceDocument(active, `${next.trimEnd()}\n`);
        await backendSyncService.sync('major-event');
        return;
      }

      if (hasSimpleQuestionExplanationBlock(current, language)) {
        const next = removeSimpleQuestionExplanationBlock(current, language);
        await replaceDocument(active, `${next.trimEnd()}\n`);
        await backendSyncService.sync('major-event');
        return;
      }

      const question = getCurrentQuestion(active);
      if (!question) {
        vscode.window.showWarningMessage('No detected question found. Generate or detect a question first.');
        return;
      }

      const explanation = await withGenerationNotification('Generating question explanation', async () => getSimpleAssistantText(
        context,
        active,
        `Explain this coding question in very simple language for a beginner. Keep it clear and short. Question: ${question}`
      ));

      const prefix = commentPrefixForLanguage(language);
      const explanationLines = stripCodeFences(explanation)
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean)
        .flatMap((line) => wrapLongLine(line))
        .map((line) => `${prefix}${line}`)
        .join('\n');
      const block = `${prefix}Question Explanation\n${explanationLines}`;
      const next = appendSection(current, block);
      await replaceDocument(active, next);
      trackHelpUsage();
      await backendSyncService.sync('major-event');
      return;
    }

    if (action === 'showHint') {
      const active = vscode.window.activeTextEditor;
      if (!active) {
        vscode.window.showErrorMessage('Open a file to show hint.');
        return;
      }

      const language = active.document.languageId || 'plaintext';
      const current = active.document.getText();

      if (hasMarkerBlock(current, 'HINT')) {
        const next = removeMarkerBlock(current, language, 'HINT');
        await replaceDocument(active, `${next.trimEnd()}\n`);
        await backendSyncService.sync('major-event');
        return;
      }

      if (hasSimpleHintBlock(current, language)) {
        const next = removeSimpleHintBlock(current, language);
        await replaceDocument(active, `${next.trimEnd()}\n`);
        await backendSyncService.sync('major-event');
        return;
      }

      const question = getCurrentQuestion(active);
      if (!question) {
        vscode.window.showWarningMessage('No detected question found. Generate or detect a question first.');
        return;
      }

      const hintRaw = await withGenerationNotification('Generating hint', async () => getSimpleAssistantText(
        context,
        active,
        `Give one short direct hint for this coding question without giving full solution. Return one sentence only. Question: ${question}`
      ));
      const hint = wrapCommentBody(singleLineHint(hintRaw));

      const prefix = commentPrefixForLanguage(language);
      const commentedHint = hint.split('\n').map(line => `${prefix}${line}`).join('\n');
      const block = `${prefix}Hint\n${commentedHint}`;
      const next = insertHintAfterQuestion(current, language, block);
      await replaceDocument(active, next);
      trackHelpUsage();
      await backendSyncService.sync('major-event');
      return;
    }

    if (action === 'showSolution') {
      const active = vscode.window.activeTextEditor;
      if (!active) {
        vscode.window.showErrorMessage('Open a file to show solution.');
        return;
      }

      const language = active.document.languageId || 'plaintext';
      const fileKey = getFileKey(active);
      const current = active.document.getText();
      const explainedSolution = explainedSolutionByFile.get(fileKey);
      if (explainedSolution && current.includes(explainedSolution)) {
        const next = removeLastOccurrence(current, explainedSolution);
        await replaceDocument(active, `${next.trimEnd()}\n`);
        plainSolutionBackupByFile.delete(fileKey);
        explainedSolutionByFile.delete(fileKey);
        await backendSyncService.sync('major-event');
        return;
      }

      const existingSolution = latestSolutionByFile.get(fileKey);
      if (existingSolution && current.includes(existingSolution)) {
        const next = removeLastOccurrence(current, existingSolution);
        await replaceDocument(active, `${next.trimEnd()}\n`);
        plainSolutionBackupByFile.delete(fileKey);
        explainedSolutionByFile.delete(fileKey);
        await backendSyncService.sync('major-event');
        return;
      }

      const question = getCurrentQuestion(active);
      if (!question) {
        vscode.window.showWarningMessage('No detected question found. Generate or detect a question first.');
        return;
      }

      let prepared = commentOutSolutionBlocks(current, language);
      const previousSolution = latestSolutionByFile.get(fileKey);
      if (previousSolution && prepared.includes(previousSolution)) {
        const prefix = commentPrefixForLanguage(language);
        const commentedPrevious = previousSolution
          .split('\n')
          .map((line) => (line.trim() ? `${prefix}${line}` : line))
          .join('\n');
        prepared = replaceLastOccurrence(prepared, previousSolution, commentedPrevious);
      }

      const solution = await withGenerationNotification('Generating solution', async () => generateRunnableSolution(context, active, question));
      const cleanSolution = stripCodeFences(solution);
      const next = appendSection(prepared, cleanSolution);

      await replaceDocument(active, next);
      latestSolutionByFile.set(fileKey, cleanSolution);
      plainSolutionBackupByFile.delete(fileKey);
      explainedSolutionByFile.delete(fileKey);
      preecodeStore.setState((state) => ({
        ...state,
        practice: {
          ...state.practice,
          solutionViewed: true
        }
      }));
      trackHelpUsage();
      await backendSyncService.sync('major-event');
      return;
    }

    if (action === 'explainSolution') {
      const active = vscode.window.activeTextEditor;
      if (!active) {
        vscode.window.showErrorMessage('Open a file to explain solution.');
        return;
      }

      const language = active.document.languageId || 'plaintext';
      const fileKey = getFileKey(active);
      const current = active.document.getText();

      const backedUpPlain = plainSolutionBackupByFile.get(fileKey);
      if (backedUpPlain) {
        const explainedVersion = explainedSolutionByFile.get(fileKey) || '';
        const reverted = current.includes(explainedVersion)
          ? replaceLastOccurrence(current, explainedVersion, backedUpPlain)
          : current;
        await replaceDocument(active, `${reverted.trimEnd()}\n`);
        plainSolutionBackupByFile.delete(fileKey);
        explainedSolutionByFile.delete(fileKey);
        await backendSyncService.sync('major-event');
        return;
      }

      const latestSolution = latestSolutionByFile.get(fileKey) || getLatestMarkerContent(current, language, 'SOLUTION');
      if (!latestSolution || !current.includes(latestSolution)) {
        vscode.window.showWarningMessage('Generate solution first, then explain it.');
        return;
      }

      const explained = await withGenerationNotification('Generating solution explanation', async () => buildInlineExplainedSolution(context, active, language, latestSolution));
      const next = replaceLastOccurrence(current, latestSolution, explained);
      await replaceDocument(active, next);
      plainSolutionBackupByFile.set(fileKey, latestSolution);
      explainedSolutionByFile.set(fileKey, explained);
      trackHelpUsage();
      await backendSyncService.sync('major-event');
      return;
    }

    if (action === 'evaluateCode') {
      const active = vscode.window.activeTextEditor;
      if (!active) {
        vscode.window.showErrorMessage('Open a file to evaluate code.');
        return;
      }

      const language = active.document.languageId || 'plaintext';
      const fileKey = getFileKey(active);
      const current = active.document.getText();
      const existingEvaluationBlock = evaluationBlockByFile.get(fileKey);
      const visibleSolution =
        (latestSolutionByFile.get(fileKey) && current.includes(latestSolutionByFile.get(fileKey)!))
          ? latestSolutionByFile.get(fileKey)!
          : (getLatestMarkerContent(current, language, 'SOLUTION') || current.trim());

      if (existingEvaluationBlock && current.includes(existingEvaluationBlock)) {
        const next = removeLastOccurrence(current, existingEvaluationBlock);
        await replaceDocument(active, `${next.trimEnd()}\n`);
        evaluationBlockByFile.delete(fileKey);
        await backendSyncService.sync('major-event');
        return;
      }

      if (!visibleSolution) {
        vscode.window.showWarningMessage('No code found in the file to evaluate.');
        return;
      }

      if (hasMarkerBlock(current, 'CODE_EVALUATION')) {
        const next = removeMarkerBlock(current, language, 'CODE_EVALUATION');
        await replaceDocument(active, `${next.trimEnd()}\n`);
        await backendSyncService.sync('major-event');
        return;
      }

      const latestSolution = visibleSolution;
      const question = getCurrentQuestion(active);
      const evaluation = await withGenerationNotification('Generating code evaluation', async () => getSimpleAssistantText(
        context,
        active,
        `Evaluate this solution in simple language: correctness, readability, edge cases, and one improvement. Question: ${question}\nSolution:\n${latestSolution}`
      ));

      const prefix = commentPrefixForLanguage(language);
      const block = stripCodeFences(evaluation)
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean)
        .flatMap((line) => wrapLongLine(line))
        .map((line) => `${prefix}${line}`)
        .join('\n');
      const next = appendSection(current, block);
      await replaceDocument(active, next);
      evaluationBlockByFile.set(fileKey, block);
      trackHelpUsage();
      await backendSyncService.sync('major-event');
      return;
    }

    if (action === 'saveQuestion') {
      const state = preecodeStore.getState();
      const active = vscode.window.activeTextEditor;
      const language = active?.document.languageId || state.editor.language || 'plaintext';
      const sourceCode = active?.document.getText() || '';
      const question = state.practice.question || (active ? getCurrentQuestion(active) : 'Practice Question');
      const timeTaken = state.compactTimer || formatElapsedToClock(state.practice.timeSpentSeconds || 0);
      const topic = normalizeTopicToOneWord(
        (state.practice.topic || (active ? inferTopicFromPath(active.document.fileName, language, active.document.getText()) : 'General')).trim(),
        'General'
      );
      const hintsUsed = Math.max(0, state.practice.hintsUsed || 0);
      const helpUsagePercent = Math.max(0, Math.min(100, Math.round((hintsUsed / 6) * 100)));

      let aiRating = 7;
      try {
        if (active) {
          const ratingRaw = await askBackendAssistant(context, active, [
            'Rate this coding approach from 0 to 10.',
            'Return only one number between 0 and 10.',
            `Question: ${question}`,
            `Difficulty: ${state.practice.difficulty}`,
            `Hint/help usage percent: ${helpUsagePercent}%`,
            `Code:\n${sourceCode || '(no code provided)'}`
          ].join('\n\n'));
          aiRating = parseAiRating(ratingRaw);
        }
      } catch {
        aiRating = 7;
      }

      const saved = await sendPracticeData(context, {
        question,
        timeTaken,
        topic,
        hintsUsed,
        solutionViewed: state.practice.solutionViewed,
        language,
        date: new Date().toISOString(),
        difficulty: state.practice.difficulty,
        hintUsagePercent: helpUsagePercent,
        aiRating
      });

      const submissionSaved = await sendSubmission(context, {
        problemName: question,
        difficulty: state.practice.difficulty,
        status: state.practice.runStatus === 'success' || state.practice.success ? 'Accepted' : 'Wrong Answer',
        topic,
        timeTaken,
        date: new Date().toISOString()
      });

      if (saved) {
        void vscode.window.showInformationMessage(
          submissionSaved
            ? 'preecode: Question saved to Practice and Submissions.'
            : 'preecode: Question saved to Practice. Submissions save failed.'
        );
        await backendSyncService.sync('major-event');
      }
      return;
    }

    if (action === 'differentApproach') {
      const active = vscode.window.activeTextEditor;
      if (!active) {
        vscode.window.showErrorMessage('Open a file to generate a different approach.');
        return;
      }

      const language = active.document.languageId || 'plaintext';
      const fileKey = getFileKey(active);
      const question = getCurrentQuestion(active);
      if (!question) {
        vscode.window.showWarningMessage('No detected question found. Generate or detect a question first.');
        return;
      }

      const current = active.document.getText();
      let prepared = commentOutSolutionBlocks(current, language);
      const previousSolution = latestSolutionByFile.get(fileKey) || getLatestMarkerContent(prepared, language, 'SOLUTION');
      if (previousSolution && prepared.includes(previousSolution)) {
        const prefix = commentPrefixForLanguage(language);
        const commentedPrevious = previousSolution
          .split('\n')
          .map((line) => (line.trim() ? `${prefix}${line}` : line))
          .join('\n');
        prepared = replaceLastOccurrence(prepared, previousSolution, commentedPrevious);
      }

      const alternative = await withGenerationNotification(
        'Generating different approach',
        async () => generateAlternativeRunnableSolution(context, active, question, previousSolution || '')
      );
      const cleanAlternative = stripCodeFences(alternative);
      const next = appendSection(prepared, cleanAlternative);
      await replaceDocument(active, next);
      latestSolutionByFile.set(fileKey, cleanAlternative);
      plainSolutionBackupByFile.delete(fileKey);
      explainedSolutionByFile.delete(fileKey);
      trackHelpUsage();
      await backendSyncService.sync('major-event');
      return;
    }

    if (action === 'fix') {
      const active = vscode.window.activeTextEditor;
      if (!active) {
        vscode.window.showErrorMessage('Open a file to fix code.');
        return;
      }

      const initialDiagnostics = getSortedDiagnostics(active);
      if (!initialDiagnostics.length) {
        vscode.window.showInformationMessage('No diagnostics found. Your file has no detected issue to fix.');
        return;
      }

      const fileUri = active.document.uri.toString();
      await withGenerationNotification('Fixing all code errors', async () => {
        for (let pass = 0; pass < 3; pass++) {
          const diagnostics = getSortedDiagnostics(active);
          if (!diagnostics.length) {
            break;
          }

          const fixedFile = await generateFixedFileCode(context, active);
          if (!fixedFile || fixedFile.trim() === active.document.getText().trim()) {
            break;
          }

          await replaceDocument(active, `${fixedFile.trimEnd()}\n`);
          await sleep(220);
        }
      });

      for (const key of Array.from(issueFixPreviewCache.keys())) {
        if (key.startsWith(`${fileUri}|`)) {
          issueFixPreviewCache.delete(key);
        }
      }

      updateEditorState(active);
      await backendSyncService.sync('major-event');
      return;
    }

    if (action === 'debug') {
      controlCenter.postMessage({ type: 'debugState', payload: { lines: [], currentIndex: 0, currentLine: 0, endLine: 0, explanation: '-', answer: '' } });
      return;
    }

    if (action === 'explain') {
      const active = vscode.window.activeTextEditor;
      if (!active) {
        vscode.window.showWarningMessage('Select code first, then click Explain Selection.');
        return;
      }

      const fileKey = getFileKey(active);
      const current = active.document.getText();
      if (active.selection.isEmpty) {
        const trackedBlocks = selectionExplanationBlocksByFile.get(fileKey) || [];
        const presentBlocks = trackedBlocks.filter((block) => current.includes(block));
        if (!presentBlocks.length) {
          vscode.window.showWarningMessage('Select code first, then click Explain Selection.');
          return;
        }

        let next = current;
        for (const block of presentBlocks) {
          next = removeAllOccurrences(next, block);
        }
        next = next.replace(/\n{3,}/g, '\n\n').trimEnd();
        await replaceDocument(active, next ? `${next}\n` : '');
        selectionExplanationBlocksByFile.delete(fileKey);
        await backendSyncService.sync('major-event');
        return;
      }

      const selectedCode = active.document.getText(active.selection);
      const explanationRaw = await withGenerationNotification('Generating selection explanation', async () => getSimpleAssistantText(
        context,
        active,
        [
          'Explain this selected code for a beginner.',
          'Use very easy and simple language.',
          'Return only 1-2 short lines.',
          'No bullet points. No long paragraph.',
          `Code:\n${selectedCode}`
        ].join('\n')
      ));

      const explanation = toShortSimpleExplanation(explanationRaw, 2);

      const language = active.document.languageId || 'plaintext';
      const prefix = commentPrefixForLanguage(language);
      const explanationBlock = [
        `${prefix}Explanation:`,
        ...stripCodeFences(explanation)
          .split('\n')
          .map((line) => line.trim())
          .filter(Boolean)
          .flatMap((line) => wrapLongLine(line))
          .map((line) => `${prefix}${line}`)
      ].join('\n');

      await insertSelectionExplanationAsComments(active, explanation);
      const existingBlocks = selectionExplanationBlocksByFile.get(fileKey) || [];
      selectionExplanationBlocksByFile.set(fileKey, [...existingBlocks, explanationBlock]);
      await backendSyncService.sync('major-event');
      return;
    }

    if (action === 'review') {
      const active = vscode.window.activeTextEditor;
      if (!active) {
        vscode.window.showErrorMessage('Open a file to review code.');
        return;
      }

      const fileKey = getFileKey(active);
      const current = active.document.getText();
      const existingReviewBlock = reviewBlockByFile.get(fileKey);
      if (existingReviewBlock && current.includes(existingReviewBlock)) {
        const next = removeLastOccurrence(current, existingReviewBlock);
        await replaceDocument(active, next ? `${next}\n` : '');
        reviewBlockByFile.delete(fileKey);
        await backendSyncService.sync('major-event');
        return;
      }

      const reviewText = await withGenerationNotification('Reviewing code', async () => askBackendAssistant(
        context,
        active,
        [
          'Review this code and provide concise feedback.',
          'Use this format:',
          '1. Logic clarity',
          '2. Possible bug risks',
          '3. Performance suggestions',
          '4. Readability improvements'
        ].join('\n')
      ));

      const block = blockCommentForLanguage(active.document.languageId, 'Code Review Summary', stripCodeFences(reviewText).replace(/^Code Review Summary\n\n/, ''));
      const next = appendSection(active.document.getText(), block);
      await replaceDocument(active, next);
      reviewBlockByFile.set(fileKey, block);
      await backendSyncService.sync('major-event');
      return;
    }

    if (action === 'reviewProject') {
      // Handle project review - this is dispatched from control center
      // The actual command handling is in preecode.reviewProject command
      await vscode.commands.executeCommand('preecode.reviewProject');
      return;
    }
  };

  const askChat = async (text: string): Promise<void> => {
    preecodeStore.setState((state) => ({
      ...state,
      chat: {
        ...state.chat,
        isLoading: true,
        messages: [
          ...state.chat.messages,
          {
            role: 'user',
            text,
            timestamp: Date.now()
          }
        ]
      }
    }));

    const editor = vscode.window.activeTextEditor;
    const source = editor?.document.getText() || '';
    const language = editor?.document.languageId || 'plaintext';
    const selectedText = editor?.document.getText(editor.selection) || '';
    const fileName = editor?.document.fileName || 'unknown';
    const state = preecodeStore.getState();
    const userName = getChatDisplayName();
    const practiceQuestion = state.practice.question || 'none';
    const diagnosticsHint = state.editor.topIssue || 'none';
    const editorFixHint = state.editor.expectedFix || 'none';
    const recentHistory = state.chat.messages
      .filter((msg) => msg.role === 'user' || msg.role === 'assistant')
      .slice(-12)
      .map((msg) => ({ role: msg.role, text: msg.text }));

    const editorContext = [
      `You are Preecode AI, a friendly expert coding mentor.`,
      `Address the user naturally by name (${userName}) where it fits.`,
      `Give practical, accurate help for code, debugging, concepts, or general questions.`,
      `Prefer concise, clear guidance and actionable next steps.`,
      `Current file: ${fileName}`,
      `Language: ${language}`,
      `Current detected issue: ${diagnosticsHint}`,
      `Current expected fix hint: ${editorFixHint}`,
      `Current practice question: ${practiceQuestion}`,
      selectedText.trim() ? `Current selection:\n${selectedText}` : 'Current selection: none'
    ].join('\n');

    let assistantText = '';
    try {
      assistantText = await sendAIChatMessage(context, text, `${editorContext}\n\nCode:\n${source}`, recentHistory);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'AI chat failed.';
      assistantText = `I couldn't reach Preecode AI right now. ${message}`;
    }

    preecodeStore.setState((state) => ({
      ...state,
      chat: {
        ...state.chat,
        isLoading: false,
        messages: [
          ...state.chat.messages,
          {
            role: 'assistant',
            text: assistantText || 'I could not generate a response right now. Please try again.',
            timestamp: Date.now()
          }
        ]
      }
    }));

    const persistedHistory = preecodeStore
      .getState()
      .chat.messages
      .filter((msg) => msg.role === 'user' || msg.role === 'assistant')
      .slice(-50)
      .map((msg) => ({ role: msg.role, text: msg.text, timestamp: msg.timestamp }));
    await context.workspaceState.update(CHAT_HISTORY_KEY, persistedHistory);
  };

  const controlCenter = new ControlCenterViewProvider(context.extensionUri, {
    onQuickAction: async (action) => {
      try {
        await runQuickAction(action.action, action.payload);
      } catch (error) {
        const message = error instanceof Error ? error.message : 'AI action failed.';
        void vscode.window.showErrorMessage(`Preecode AI: ${message}`);
      }
    },
    onTimerMenu: async () => {
      const choice = await vscode.window.showQuickPick(
        ['Start', 'Pause', 'Resume', 'Stop'],
        { placeHolder: 'Practice Timer Controls' }
      );
      if (!choice) {
        return;
      }

      if (choice === 'Start') {
        timerService.startNow();
      } else if (choice === 'Pause') {
        timerService.pause();
      } else if (choice === 'Resume') {
        timerService.resume();
      } else if (choice === 'Stop') {
        timerService.stop();
      }
    },
    onPanelNarrowHint: async () => {
      const key = 'preecode.narrowPanelHintShown';
      const alreadyShown = context.globalState.get<boolean>(key);
      if (alreadyShown) {
        return;
      }
      await context.globalState.update(key, true);
      void vscode.window.showInformationMessage('Preecode tip: Drag the VS Code sidebar border to make this panel wider. VS Code will remember your preferred width.');
    },
    onLogout: async () => {
      await authManager.logout();
    },
    onAskChat: askChat,
    onNewChat: async () => {
      await resetChat();
    },
    onTourStep: async (step: string) => {
      // Handle tour step progression
      if (step === 'click-sidebar-icon') {
        await onboardingService.nextStep('click-sidebar-icon');
      } else if (step === 'sidebar-open') {
        await onboardingService.nextStep('sidebar-open');
      } else if (step === 'login') {
        await onboardingService.nextStep('login');
      } else if (step === 'start-practicing') {
        await onboardingService.nextStep('start-practicing');
      } else if (step === 'debug-code') {
        await onboardingService.nextStep('debug-code');
      } else if (step === 'fix-code') {
        await onboardingService.nextStep('fix-code');
      } else if (step === 'explain-selection') {
        await onboardingService.nextStep('explain-selection');
      } else if (step === 'review-code') {
        await onboardingService.nextStep('review-code');
      } else if (step === 'ai-chat') {
        await onboardingService.nextStep('ai-chat');
      } else if (step === 'dashboard') {
        await onboardingService.nextStep('dashboard');
      } else if (step === 'profile') {
        await onboardingService.nextStep('profile');
      } else if (step === 'completed') {
        await onboardingService.completeTour();
      }

      // Update store with new onboarding state
      const updatedState = onboardingService.getState();
      preecodeStore.setState((state) => ({
        ...state,
        onboarding: {
          isActive: updatedState.isActive,
          currentStep: updatedState.currentStep,
          isCompleted: updatedState.isCompleted
        }
      }));
    },
    onSidebarOpened: async () => {
      // Sidebar opened - this is called whenever the sidebar is opened
      // No need to do anything special since we auto-open on tour start
      console.log('Preecode sidebar opened');
    },
    onDebugStart: async (startLine, endLine) => {
      const active = vscode.window.activeTextEditor;
      if (!active) {
        return;
      }

      const totalLines = active.document.lineCount;
      const normalizedStart = Math.max(1, Math.min(totalLines, startLine));
      const normalizedEnd = Math.max(normalizedStart, Math.min(totalLines, endLine));
      const lines: string[] = [];
      const lineNumbers: number[] = [];
      const sourceLines: DebugSourceLine[] = [];

      let minIndent = Number.MAX_SAFE_INTEGER;
      for (let index = normalizedStart - 1; index <= normalizedEnd - 1; index++) {
        const raw = active.document.lineAt(index).text;
        lines.push(raw);
        lineNumbers.push(index + 1);
        const trimmed = raw.trim();
        if (trimmed.length) {
          const leadingSpaces = raw.match(/^\s*/)?.[0].replace(/\t/g, '    ').length ?? 0;
          minIndent = Math.min(minIndent, leadingSpaces);
        }
      }

      if (!lines.length) {
        return;
      }

      const baseIndent = minIndent === Number.MAX_SAFE_INTEGER ? 0 : minIndent;
      for (let index = 0; index < lines.length; index++) {
        const code = lines[index];
        const trimmed = code.trim();
        const leadingSpaces = code.match(/^\s*/)?.[0].replace(/\t/g, '    ').length ?? 0;
        const normalizedSpaces = Math.max(0, leadingSpaces - baseIndent);
        const indentLevel = Math.floor(normalizedSpaces / 4);
        sourceLines.push({
          lineNumber: lineNumbers[index],
          code,
          trimmed,
          indent: indentLevel
        });
      }

      const executionSteps = buildExecutionSteps(sourceLines);
      if (!executionSteps.length) {
        return;
      }

      debugSession = {
        fileUri: active.document.uri.toString(),
        lines,
        lineNumbers,
        startLine: normalizedStart,
        endLine: normalizedEnd,
        currentIndex: 0,
        executionSteps,
        lastAnswer: ''
      };
      postDebugState();
    },
    onDebugNavigate: async (direction) => {
      if (!debugSession) {
        return;
      }

      if (direction === 'prev') {
        debugSession.currentIndex = Math.max(0, debugSession.currentIndex - 1);
      } else {
        debugSession.currentIndex = Math.min(debugSession.executionSteps.length - 1, debugSession.currentIndex + 1);
      }

      postDebugState();
    },
    onDebugAsk: async (text) => {
      if (!debugSession) {
        return;
      }
      const session = debugSession;

      const active = vscode.window.activeTextEditor;
      const currentStep = session.executionSteps[session.currentIndex];
      if (!currentStep) {
        return;
      }
      const currentLine = currentStep.lineNumber;
      const lineText = currentStep.codeLine || '';

      if (!active || active.document.uri.toString() !== session.fileUri) {
        session.lastAnswer = 'Open the same file to continue this debug session.';
        postDebugState();
        return;
      }

      const answer = await withGenerationNotification('Getting debug answer', async () => getSimpleAssistantText(
        context,
        active,
        [
          `Debug question: ${text}`,
          `Current line number: ${currentLine}`,
          `Current line code: ${lineText}`,
          `Debug range: ${session.startLine}-${session.endLine}`,
          'Answer briefly in simple language.'
        ].join('\n'),
        'This line updates state based on the current condition in your loop.'
      ));

      session.lastAnswer = answer;
      postDebugState();
    },
    onLogin: async () => {
      await authManager.login();
    }
  });

  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(ControlCenterViewProvider.viewId, controlCenter)
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('preecode.login', async () => {
      await authManager.login();
    }),
    vscode.commands.registerCommand('preecode.logout', async () => {
      await authManager.logout();
    }),
    vscode.commands.registerCommand('preecode.quickPractice', async () => {
      await runQuickAction('practice');
    }),
    vscode.commands.registerCommand('preecode.debugSelection', async () => {
      await runQuickAction('debug');
    }),
    vscode.commands.registerCommand('preecode.explainSelection', async () => {
      await runQuickAction('explain');
    }),
    vscode.commands.registerCommand('preecode.reviewCode', async () => {
      await runQuickAction('review');
    }),
    vscode.commands.registerCommand('preecode.reviewProject', async () => {
      try {
        const source = await projectReviewService.askReviewSource();
        if (!source) return;

        let files: projectReviewService.ProjectFile[] = [];
        let projectInfo: projectReviewService.ProjectInfo | undefined;
        let folderPath: string | undefined;

        if (source === 'workspace') {
          const workspaceFolders = vscode.workspace.workspaceFolders;
          if (!workspaceFolders || workspaceFolders.length === 0) {
            vscode.window.showErrorMessage('No workspace open. Open a folder first.');
            return;
          }
          folderPath = workspaceFolders[0].uri.fsPath;
        } else if (source === 'folder') {
          const folders = await projectReviewService.selectProjectFolder();
          if (!folders || folders.length === 0) return;
          folderPath = folders[0].fsPath;
        } else if (source === 'files') {
          const fileUris = await projectReviewService.selectMultipleFiles();
          if (!fileUris || fileUris.length === 0) return;
          files = await projectReviewService.getFilesFromSelection(fileUris);
        }

        if (folderPath) {
          files = await projectReviewService.getFilesFromFolder(vscode.Uri.file(folderPath));
          projectInfo = await projectReviewService.detectProjectInfo(folderPath);
        }

        if (files.length === 0) {
          vscode.window.showErrorMessage('No files found to review.');
          return;
        }

        const analysisLevel = await projectReviewService.askAnalysisLevel();
        if (!analysisLevel) return;

        const filteredFiles = await projectReviewService.filterFilesForReview(files, analysisLevel);

        if (filteredFiles.length === 0) {
          vscode.window.showErrorMessage('No files to analyze after filtering.');
          return;
        }

        // Show analysis progress
        const analysisMessage = `Analyzing ${filteredFiles.length} file(s)...`;

        await vscode.window.withProgress(
          {
            location: vscode.ProgressLocation.Notification,
            title: analysisMessage,
            cancellable: false
          },
          async () => {
            try {
              const reviewResult = await sendProjectReviewRequest(context, {
                files: filteredFiles,
                projectInfo,
                analysisLevel
              });

              ProjectReviewPanel.render(context, context.extensionUri, reviewResult);
              vscode.window.showInformationMessage('Project review completed!');
            } catch (err: any) {
              const msg = String(err?.message || 'Unknown error');
              vscode.window.showErrorMessage(`Project review failed: ${msg}`);
            }
          }
        );
      } catch (err: any) {
        vscode.window.showErrorMessage(`Project review error: ${err?.message || 'Unknown error'}`);
      }
    }),
    vscode.commands.registerCommand('preecode.openControlCenter', async () => {
      await vscode.commands.executeCommand('workbench.view.extension.preecode');
    }),
    vscode.commands.registerCommand('preecode.restartTour', async () => {
      await onboardingService.resetTour();
      await onboardingService.startTour();
      preecodeStore.setState((state) => ({
        ...state,
        onboarding: {
          isActive: true,
          currentStep: 'sidebar-open',
          isCompleted: false
        }
      }));
      // Show info message
      void vscode.window.showInformationMessage('Tour restarted! Open the Preecode sidebar to begin.');
    }),
    vscode.commands.registerCommand('preecode.enableLearningMemory', async () => {
      const config = vscode.workspace.getConfiguration('preecode.learning');
      await config.update('enabled', true, vscode.ConfigurationTarget.Global);
      await memoryService.updateSettings({ enabled: true });
      vscode.window.showInformationMessage('Learning Memory enabled. Your coding journey is now being tracked.');
    }),
    vscode.commands.registerCommand('preecode.disableLearningMemory', async () => {
      const config = vscode.workspace.getConfiguration('preecode.learning');
      await config.update('enabled', false, vscode.ConfigurationTarget.Global);
      await memoryService.updateSettings({ enabled: false });
      vscode.window.showInformationMessage('Learning Memory disabled.');
    }),
    vscode.commands.registerCommand('preecode.memorySettings', async () => {
      const settings = memoryService.getSettings();
      MemorySettingsPanel.render(context, context.extensionUri, settings, async (newSettings) => {
        await memoryService.updateSettings(newSettings);
      });
    }),
    vscode.commands.registerCommand('preecode.exportMemory', async () => {
      const data = await memoryService.exportMemory(context);
      if (data) {
        // In production, would save to file
        vscode.window.showInformationMessage(`Memory exported: ${JSON.stringify(data.summary)}`);
      }
    }),
    vscode.commands.registerCommand('preecode.deleteMemory', async () => {
      await memoryService.deleteMemory(context);
    }),
    vscode.commands.registerCommand('preecode.viewMemoryHistory', async () => {
      const history = await memoryService.getHistory(context, 1);
      if (history.length === 0) {
        vscode.window.showInformationMessage('No learning memory recorded yet.');
        return;
      }
      vscode.window.showInformationMessage(`Viewing ${history.length} memory entries.`);
    })
  );

  let lastRunStatus = preecodeStore.getState().practice.runStatus;
  const unsubscribe = preecodeStore.subscribe((state) => {
    if (state.practice.runStatus !== lastRunStatus) {
      lastRunStatus = state.practice.runStatus;
      void backendSyncService.sync('major-event');
    }
  });

  context.subscriptions.push({
    dispose: () => unsubscribe()
  });

  updateEditorState(vscode.window.activeTextEditor);

  context.subscriptions.push(
    vscode.window.onDidChangeActiveTextEditor((editor) => {
      updateEditorState(editor);
    }),
    vscode.window.onDidChangeTextEditorSelection((event) => {
      updateEditorState(event.textEditor);
    }),
    vscode.workspace.onDidChangeTextDocument((event) => {
      const activeEditor = vscode.window.activeTextEditor;
      if (!activeEditor) return;
      if (event.document.uri.toString() !== activeEditor.document.uri.toString()) return;
      updateEditorState(activeEditor);
    }),
    vscode.languages.onDidChangeDiagnostics(() => {
      updateEditorState(vscode.window.activeTextEditor);
    })
  );
}

export function deactivate(): void {}
