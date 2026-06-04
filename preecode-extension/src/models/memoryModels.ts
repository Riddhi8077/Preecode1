// Learning Memory TypeScript Models

export interface ProjectMetadata {
  projectName?: string;
  projectType?: string; // web, mobile, cli, lib
  frameworks?: string[];
  language?: string;
}

export interface Solution {
  approach: string;
  code: string;
  userApplied: boolean;
  outcome: 'success' | 'partial' | 'failed';
  timeToFix: number; // milliseconds
  attemptNumber: number;
  sourceType: 'ai' | 'user' | 'docs';
  notes: string;
  createdAt: Date;
}

export interface LearningMemoryEntry {
  _id?: string;
  errorId: string;
  errorMessage: string;
  stackTrace?: string;
  errorCategory: 'syntax' | 'runtime' | 'logic' | 'type' | 'async' | 'performance' | 'other';
  fileName?: string;
  fileLanguage?: string;
  lineNumber?: number;
  context?: string;
  projectInfo?: ProjectMetadata;
  solutions: Solution[];
  occurrences: number;
  lastOccurrence: Date;
  firstOccurrence: Date;
  tags: string[];
  severity: 'critical' | 'high' | 'medium' | 'low';
  createdAt: Date;
  updatedAt: Date;
}

export interface Pattern {
  patternType: 'recurring_error' | 'common_mistake' | 'skill_gap';
  description: string;
  category: string;
  affectedAreas: string[];
  frequency: number;
  confidence: number; // 0-100
  recommendations: string[];
  resources: Array<{ title: string; url: string; type: string }>;
  lastAnalyzedAt: Date;
}

export interface MemorySettings {
  enabled: boolean;
  autoNotify: boolean;
  retentionDays: number;
}

export interface SimilarErrorMatch {
  errorId: string;
  message: string;
  similarity: number; // 0-100
  solutions: Solution[];
  successRate: number; // percentage of successful solutions
}

export interface TrackingContext {
  projectName?: string;
  projectType?: string;
  fileName?: string;
  fileLanguage?: string;
  lineNumber?: number;
  frameworks?: string[];
}
