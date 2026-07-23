import path from 'node:path';
import { ASTAnalyzer } from './astAnalyzer.js';
import { GitAnalyzer } from './gitAnalyzer.js';
import { GhostScorer } from './ghostScorer.js';
import { ScanOptions, ScanSummary, FileReport } from './types.js';

export class Scanner {
  private astAnalyzer: ASTAnalyzer;
  private gitAnalyzer: GitAnalyzer;
  private scorer: GhostScorer;

  constructor(private options: ScanOptions) {
    const absolutePath = path.resolve(options.path);
    this.astAnalyzer = new ASTAnalyzer(absolutePath);
    this.gitAnalyzer = new GitAnalyzer(absolutePath);
    this.scorer = new GhostScorer();
  }

  /**
   * Executes the full scan pipeline across the target workspace directory.
   */
  public async run(): Promise<ScanSummary> {
    const targetDir = path.resolve(this.options.path);
    if (this.options.debug) {
      console.log(`[DEBUG] Starting scan on target directory: ${targetDir}`);
    }

    this.astAnalyzer.initialize(targetDir);
    const sourceFiles = this.astAnalyzer.getSourceFiles();

    if (this.options.debug) {
      console.log(`[DEBUG] Discovered ${sourceFiles.length} candidate TypeScript source files.`);
    }

    const reports: FileReport[] = [];
    let highRisk = 0;
    let mediumRisk = 0;
    let lowRisk = 0;

    for (const file of sourceFiles) {
      const astMetrics = this.astAnalyzer.analyzeFile(file);
      const gitMetrics = await this.gitAnalyzer.getMetrics(astMetrics.filePath);

      const fileMetrics = {
        ...astMetrics,
        git: gitMetrics,
      };

      const ghostScore = this.scorer.calculateScore(fileMetrics);

      if (ghostScore.riskLevel === 'HIGH RISK') highRisk++;
      else if (ghostScore.riskLevel === 'MEDIUM RISK') mediumRisk++;
      else lowRisk++;

      reports.push({
        file: fileMetrics,
        score: ghostScore,
      });
    }

    // Sort reports descending by ghost score
    reports.sort((a, b) => b.score.score - a.score.score);

    const ghostCandidates = reports.filter((r) => r.score.score >= this.options.threshold).length;

    return {
      totalFilesScanned: sourceFiles.length,
      ghostCandidates,
      highRisk,
      mediumRisk,
      lowRisk,
      reports,
    };
  }
}
