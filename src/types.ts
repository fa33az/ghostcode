export interface ScanOptions {
  path: string;
  threshold: number;
  json: boolean;
  debug: boolean;
  configPath?: string;
  coveragePath?: string;
  htmlPath?: string;
  ignore?: string[];
  orphans?: boolean;
  fix?: boolean;
  prune?: boolean;
  failOnHigh?: boolean | number;
}

export interface GhostConfig {
  threshold?: number;
  weights?: Partial<ScoreWeights>;
  ignore?: string[];
  orphanThresholdDays?: number;
}

export interface AuthorMetrics {
  lastAuthor: string | null;
  isOrphan: boolean;
  authorCommitCount: number;
}

export interface GitMetrics {
  lastModifiedDate: Date | null;
  daysSinceLastCommit: number;
  commitCount: number;
  author?: AuthorMetrics;
}

export interface CoverageMetrics {
  coveredLines: number;
  totalLines: number;
  coveragePercentage: number;
  isCovered: boolean;
}

export interface FunctionMetrics {
  name: string;
  kind: 'function' | 'arrow' | 'method';
  isExported: boolean;
  startLine: number;
  endLine: number;
  referenceCount: number;
  importCount: number;
  testReferenceCount: number;
  isGhost: boolean;
}

export interface FileMetrics {
  filePath: string;
  relativePath: string;
  git: GitMetrics;
  importCount: number;
  isReferencedInTests: boolean;
  functions: FunctionMetrics[];
  coverage?: CoverageMetrics;
}

export interface ScoreWeights {
  ageWeight: number;
  referenceWeight: number;
  testWeight: number;
  commitWeight: number;
  coverageWeight?: number;
  orphanWeight?: number;
}

export type RiskLevel = 'HIGH RISK' | 'MEDIUM RISK' | 'LOW RISK';

export interface GhostScore {
  score: number;
  riskLevel: RiskLevel;
  status: 'Likely Dead Code' | 'Potentially Unused' | 'Active Code';
  breakdown: {
    ageScore: number;
    referenceScore: number;
    testScore: number;
    commitScore: number;
    coverageScore?: number;
    orphanScore?: number;
  };
}

export interface FileReport {
  file: FileMetrics;
  score: GhostScore;
  fixed?: boolean;
  pruned?: boolean;
}

export interface ScanSummary {
  totalFilesScanned: number;
  ghostCandidates: number;
  highRisk: number;
  mediumRisk: number;
  lowRisk: number;
  fixedFilesCount?: number;
  prunedFunctionsCount?: number;
  reports: FileReport[];
}
