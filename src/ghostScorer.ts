import { FileMetrics, GhostScore, RiskLevel, ScoreWeights } from './types.js';

export const DEFAULT_WEIGHTS: ScoreWeights = {
  ageWeight: 0.25,
  referenceWeight: 0.25,
  testWeight: 0.2,
  commitWeight: 0.15,
  coverageWeight: 0.15,
  orphanWeight: 0.1,
};

/**
 * GhostScorer calculates a transparent, weighted score (0–100) evaluating
 * whether code is likely "ghost code" (inactive, untested, unreferenced).
 */
export class GhostScorer {
  private weights: ScoreWeights;

  constructor(customWeights?: Partial<ScoreWeights>) {
    this.weights = { ...DEFAULT_WEIGHTS, ...customWeights };
  }

  /**
   * Computes age factor (0–100).
   * Files untouched for >= 180 days (6 months) receive maximum ghost age score (100).
   */
  private calculateAgeScore(daysOld: number): number {
    const maxAgeDays = 180;
    if (daysOld >= maxAgeDays) return 100;
    return Math.round((daysOld / maxAgeDays) * 100);
  }

  /**
   * Computes reference & import dependency factor (0–100).
   * 0 imports & 0 internal references -> 100 (completely isolated).
   * 1 reference -> 35.
   * >= 2 references -> 0.
   */
  private calculateReferenceScore(importCount: number, functions: FileMetrics['functions']): number {
    const totalInternalRefs = functions.reduce((acc, f) => acc + f.referenceCount, 0);
    const totalRefs = importCount + totalInternalRefs;

    if (totalRefs === 0) return 100;
    if (totalRefs === 1) return 35;
    return 0;
  }

  /**
   * Computes test coverage absence factor (0–100).
   * Unreferenced in test files & no matching spec/test file -> 100.
   * Otherwise -> 0.
   */
  private calculateTestScore(isReferencedInTests: boolean): number {
    return isReferencedInTests ? 0 : 100;
  }

  /**
   * Computes commit frequency factor (0–100).
   * Code written in 1 commit and never modified is a candidate for dead boilerplate (100).
   * 2-3 commits -> 50.
   * > 5 commits -> 0 (frequently iterated file).
   */
  private calculateCommitScore(commitCount: number): number {
    if (commitCount <= 1) return 100;
    if (commitCount <= 3) return 50;
    if (commitCount <= 5) return 20;
    return 0;
  }

  /**
   * Computes runtime test coverage score factor (0-100).
   * 0% coverage -> 100 (unexecuted ghost code).
   * 100% coverage -> 0.
   */
  private calculateCoverageScore(coverage?: FileMetrics['coverage']): number {
    if (!coverage) return 0;
    return 100 - coverage.coveragePercentage;
  }

  /**
   * Computes author orphan score factor (0-100).
   * Written by an orphan contributor who left > 365 days ago -> 100.
   */
  private calculateOrphanScore(author?: FileMetrics['git']['author']): number {
    if (!author) return 0;
    return author.isOrphan ? 100 : 0;
  }

  /**
   * Computes the overall Ghost Score (0–100) and risk classification.
   */
  public calculateScore(fileMetrics: FileMetrics): GhostScore {
    const ageScore = this.calculateAgeScore(fileMetrics.git.daysSinceLastCommit);
    const referenceScore = this.calculateReferenceScore(fileMetrics.importCount, fileMetrics.functions);
    const testScore = this.calculateTestScore(fileMetrics.isReferencedInTests);
    const commitScore = this.calculateCommitScore(fileMetrics.git.commitCount);
    const coverageScore = this.calculateCoverageScore(fileMetrics.coverage);
    const orphanScore = this.calculateOrphanScore(fileMetrics.git.author);

    // Calculate dynamic weighted score based on active features
    let totalWeight = this.weights.ageWeight + this.weights.referenceWeight + this.weights.testWeight + this.weights.commitWeight;
    let weightedSum = (ageScore * this.weights.ageWeight) +
                      (referenceScore * this.weights.referenceWeight) +
                      (testScore * this.weights.testWeight) +
                      (commitScore * this.weights.commitWeight);

    if (fileMetrics.coverage && this.weights.coverageWeight) {
      totalWeight += this.weights.coverageWeight;
      weightedSum += coverageScore * this.weights.coverageWeight;
    }

    if (fileMetrics.git.author && this.weights.orphanWeight) {
      totalWeight += this.weights.orphanWeight;
      weightedSum += orphanScore * this.weights.orphanWeight;
    }

    const finalScore = totalWeight > 0 ? Math.round(weightedSum / totalWeight) : 0;
    const score = Math.min(100, Math.max(0, finalScore));

    let riskLevel: RiskLevel = 'LOW RISK';
    let status: GhostScore['status'] = 'Active Code';

    if (score >= 70) {
      riskLevel = 'HIGH RISK';
      status = 'Likely Dead Code';
    } else if (score >= 40) {
      riskLevel = 'MEDIUM RISK';
      status = 'Potentially Unused';
    }

    return {
      score,
      riskLevel,
      status,
      breakdown: {
        ageScore,
        referenceScore,
        testScore,
        commitScore,
        ...(fileMetrics.coverage ? { coverageScore } : {}),
        ...(fileMetrics.git.author ? { orphanScore } : {}),
      },
    };
  }
}
