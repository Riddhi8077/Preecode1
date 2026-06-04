import { SimilarErrorMatch, LearningMemoryEntry, Solution } from '../models/memoryModels';

export class SimilarityEngine {
  // Calculate similarity between two strings using Levenshtein distance
  private calculateStringSimilarity(str1: string, str2: string): number {
    const len1 = str1.length;
    const len2 = str2.length;

    if (len1 === 0 || len2 === 0) {
      return len1 === len2 ? 100 : 0;
    }

    const matrix: number[][] = [];

    for (let i = 0; i <= len2; i++) {
      matrix[i] = [i];
    }

    for (let j = 0; j <= len1; j++) {
      matrix[0][j] = j;
    }

    for (let i = 1; i <= len2; i++) {
      for (let j = 1; j <= len1; j++) {
        if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1,
            matrix[i][j - 1] + 1,
            matrix[i - 1][j] + 1
          );
        }
      }
    }

    const distance = matrix[len2][len1];
    const maxLen = Math.max(len1, len2);
    return Math.max(0, Math.min(100, 100 - (distance / maxLen) * 100));
  }

  // Find similar errors from memory
  findSimilarErrors(
    currentError: string,
    errorCategory: string,
    memories: LearningMemoryEntry[],
    threshold: number = 60
  ): SimilarErrorMatch[] {
    const matches: SimilarErrorMatch[] = [];

    for (const memory of memories) {
      // Prioritize same category
      let similarity = 0;

      if (memory.errorCategory === errorCategory) {
        similarity = this.calculateStringSimilarity(currentError, memory.errorMessage);
      } else {
        // Lower similarity if different category
        similarity = this.calculateStringSimilarity(currentError, memory.errorMessage) * 0.6;
      }

      if (similarity >= threshold) {
        // Calculate success rate
        const successfulSolutions = memory.solutions.filter(s => s.outcome === 'success').length;
        const successRate = memory.solutions.length > 0 ? (successfulSolutions / memory.solutions.length) * 100 : 0;

        matches.push({
          errorId: memory._id || '',
          message: memory.errorMessage,
          similarity,
          solutions: memory.solutions,
          successRate
        });
      }
    }

    // Sort by similarity and success rate
    return matches.sort((a, b) => {
      const similarityDiff = b.similarity - a.similarity;
      if (Math.abs(similarityDiff) > 5) return similarityDiff;
      return b.successRate - a.successRate;
    });
  }

  // Calculate effectiveness of a solution
  calculateSolutionEffectiveness(solution: Solution): number {
    let score = 0;

    // Success outcome is most important
    if (solution.outcome === 'success') {
      score += 100;
    } else if (solution.outcome === 'partial') {
      score += 50;
    }

    // Lower score if many attempts needed
    if (solution.attemptNumber <= 1) {
      score += 20;
    } else if (solution.attemptNumber <= 3) {
      score += 10;
    }

    // Time factor - faster fixes are better
    if (solution.timeToFix < 60000) {
      // Less than 1 minute
      score += 15;
    } else if (solution.timeToFix < 300000) {
      // Less than 5 minutes
      score += 10;
    }

    // AI suggestions score higher
    if (solution.sourceType === 'ai') {
      score += 5;
    }

    return Math.min(100, score);
  }

  // Detect patterns in errors
  detectPatterns(memories: LearningMemoryEntry[]): any[] {
    const categoryGroups: Record<string, LearningMemoryEntry[]> = {};

    for (const memory of memories) {
      if (!categoryGroups[memory.errorCategory]) {
        categoryGroups[memory.errorCategory] = [];
      }
      categoryGroups[memory.errorCategory].push(memory);
    }

    const patterns = [];

    for (const [category, errors] of Object.entries(categoryGroups)) {
      if (errors.length >= 2) {
        // Pattern detected
        const avgOccurrences = errors.reduce((sum, e) => sum + e.occurrences, 0) / errors.length;

        patterns.push({
          type: 'recurring_error',
          category,
          frequency: errors.length,
          avgOccurrences,
          examples: errors.slice(0, 3).map(e => e.errorMessage),
          recommendation: `You frequently encounter ${category} errors. Consider reviewing the fundamentals or looking for patterns in your approach.`,
          confidence: Math.min(100, errors.length * 15)
        });
      }
    }

    return patterns.sort((a, b) => b.confidence - a.confidence);
  }

  // Calculate overall learning score
  calculateLearningScore(memories: LearningMemoryEntry[]): {
    score: number;
    successRate: number;
    improvementTrend: 'improving' | 'stable' | 'declining';
  } {
    if (memories.length === 0) {
      return { score: 0, successRate: 0, improvementTrend: 'stable' };
    }

    const recentErrors = memories.slice(0, 10); // Last 10 errors
    const olderErrors = memories.slice(10, 20); // 10 errors before

    let successCount = 0;
    for (const memory of recentErrors) {
      const successfulSolutions = memory.solutions.filter(s => s.outcome === 'success').length;
      if (successfulSolutions > 0) {
        successCount++;
      }
    }

    const successRate = recentErrors.length > 0 ? (successCount / recentErrors.length) * 100 : 0;

    // Calculate improvement trend
    let improvementTrend: 'improving' | 'stable' | 'declining' = 'stable';
    if (olderErrors.length > 0) {
      const olderSuccessCount = olderErrors.filter(
        m => m.solutions.some(s => s.outcome === 'success')
      ).length;
      const olderSuccessRate = (olderSuccessCount / olderErrors.length) * 100;

      if (successRate > olderSuccessRate + 10) {
        improvementTrend = 'improving';
      } else if (successRate < olderSuccessRate - 10) {
        improvementTrend = 'declining';
      }
    }

    // Score based on success rate and frequency of errors
    const frequencyFactor = Math.max(0, 100 - memories.length * 5); // Fewer errors = higher score
    const score = (successRate * 0.7 + frequencyFactor * 0.3);

    return {
      score: Math.round(score),
      successRate: Math.round(successRate),
      improvementTrend
    };
  }
}
