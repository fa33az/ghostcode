import { FileMetrics, GhostScore, RiskLevel, ScoreWeights } from './types.js';

export const DEFAULT_WEIGHTS: ScoreWeights = {
  ageWeight: 0.3,
  referenceWeight: 0.3,
  testWeight: 0.2,
  commitWeight: 0.2,
};

/**
 * GhostScorer calculates a transparent, weighted score (0–100) evaluating
 * whether code is likely "ghost code" (inactive, untested, unreferenced).
 */
export class GhostScorer {
  private weights: ScoreWeights;

  constructor(customWeights?: Partial<ScoreWeights>) {
    this.weights = { ...DEFAULT_WEIGHTS, ...customWeights };
    this.normalizeWeights();
  }

  /**
   * Ensures weights sum to 1.0 to prevent scaling distortion.
   */
  private normalizeWeights() {
    const total =
      this.weights.ageWeight +
      this.weights.referenceWeight +
      this.weights.testWeight +
      this.weights.commitWeight;

    if (total > 0 && Math.abs(total - 1.0) > 0.001) {
      this.weights.ageWeight /= total;
      this.weights.referenceWeight /= total;
      this.weights.testWeight /= total;
      this.weights.commitWeight /= total;
    }
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
   * Computes the overall Ghost Score (0–100) and risk classification.
   */
  public calculateScore(fileMetrics: FileMetrics): GhostScore {
    const ageScore = this.calculateAgeScore(fileMetrics.git.daysSinceLastCommit);
    const referenceScore = this.calculateReferenceScore(fileMetrics.importCount, fileMetrics.functions);
    const testScore = this.calculateTestScore(fileMetrics.isReferencedInTests);
    const commitScore = this.calculateCommitScore(fileMetrics.git.commitCount);

    const weightedScore = Math.round(
      ageScore * this.weights.ageWeight +
      referenceScore * this.weights.referenceWeight +
      testScore * this.weights.testWeight +
      commitScore * this.weights.commitWeight
    );

    const score = Math.min(100, Math.max(0, weightedScore));

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
      },
    };
  }
}
