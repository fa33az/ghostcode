export interface ScanOptions {
  path: string;
  threshold: number;
  json: boolean;
  debug: boolean;
  configPath?: string;
}

export interface GitMetrics {
  lastModifiedDate: Date | null;
  daysSinceLastCommit: number;
  commitCount: number;
}

export interface FunctionMetrics {
  name: string;
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
}

export interface ScoreWeights {
  ageWeight: number;
  referenceWeight: number;
  testWeight: number;
  commitWeight: number;
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
  };
}

export interface FileReport {
  file: FileMetrics;
  score: GhostScore;
}

export interface ScanSummary {
  totalFilesScanned: number;
  ghostCandidates: number;
  highRisk: number;
  mediumRisk: number;
  lowRisk: number;
  reports: FileReport[];
}
