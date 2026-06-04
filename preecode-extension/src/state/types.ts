export type SyncStatus = 'idle' | 'syncing' | 'success' | 'error';
export type RunStatus = 'idle' | 'running' | 'success' | 'failure';

export interface UserSession {
  isAuthenticated: boolean;
  userId: string | null;
  username: string | null;
  email: string | null;
  avatarUrl: string | null;
  token: string | null;
}

export interface PracticeState {
  topic: string;
  difficulty: 'easy' | 'medium' | 'hard';
  question: string;
  timeSpentSeconds: number;
  attempts: number;
  hintsUsed: number;
  solutionViewed: boolean;
  success: boolean;
  runStatus: RunStatus;
}

export interface EditorState {
  fileName: string;
  language: string;
  selection: string;
  hasSelection: boolean;
  topIssue: string;
  expectedFix: string;
  hasQuestionExplanation: boolean;
  hasHint: boolean;
  hasSolutionExplanation: boolean;
  hasCodeEvaluation: boolean;
  hasSelectionExplanation: boolean;
  hasVisibleSolution: boolean;
  hasReview: boolean;
}

export interface ChatMessage {
  role: 'user' | 'assistant';
  text: string;
  timestamp: number;
}

export interface OnboardingState {
  isActive: boolean;
  currentStep: 'none' | 'initial-popup' | 'click-sidebar-icon' | 'sidebar-open' | 'login' | 'start-practicing' | 'debug-code' | 'fix-code' | 'explain-selection' | 'review-code' | 'ai-chat' | 'dashboard' | 'profile' | 'completed';
  isCompleted: boolean;
}

export interface PreecodeState {
  user: UserSession;
  syncStatus: SyncStatus;
  compactTimer: string;
  lastSyncAt: number | null;
  editor: EditorState;
  practice: PracticeState;
  onboarding: OnboardingState;
  chat: {
    dockHeight: number;
    messages: ChatMessage[];
    isLoading: boolean;
  };
}

export const initialPreecodeState: PreecodeState = {
  user: {
    isAuthenticated: false,
    userId: null,
    username: null,
    email: null,
    avatarUrl: null,
    token: null
  },
  syncStatus: 'idle',
  compactTimer: '00:00',
  lastSyncAt: null,
  editor: {
    fileName: 'No file',
    language: '-',
    selection: '',
    hasSelection: false,
    topIssue: 'Problem in code',
    expectedFix: 'Expected Fix',
    hasQuestionExplanation: false,
    hasHint: false,
    hasSolutionExplanation: false,
    hasCodeEvaluation: false,
    hasSelectionExplanation: false,
    hasVisibleSolution: false,
    hasReview: false
  },
  practice: {
    topic: 'General',
    difficulty: 'easy',
    question: '',
    timeSpentSeconds: 0,
    attempts: 0,
    hintsUsed: 0,
    solutionViewed: false,
    success: false,
    runStatus: 'idle'
  },
  onboarding: {
    isActive: false,
    currentStep: 'none',
    isCompleted: false
  },
  chat: {
    dockHeight: 168,
    messages: [],
    isLoading: false
  }
};
