import path from 'node:path';
import { ASTAnalyzer } from './astAnalyzer.js';
import { GitAnalyzer } from './gitAnalyzer.js';
import { GhostScorer } from './ghostScorer.js';
import { ConfigLoader } from './configLoader.js';
import { CoverageAnalyzer } from './coverageAnalyzer.js';
import { Fixer } from './fixer.js';
import { HtmlReporter } from './htmlReporter.js';
import { ScanOptions, ScanSummary, FileReport } from './types.js';

export class Scanner {
  private astAnalyzer: ASTAnalyzer;
  private gitAnalyzer: GitAnalyzer;
  private scorer: GhostScorer;
  private coverageAnalyzer?: CoverageAnalyzer;
  private fixer?: Fixer;
  private customIgnores: string[] = [];

  constructor(private options: ScanOptions) {
    const absolutePath = path.resolve(options.path);

    // Load config if available
    const config = ConfigLoader.load(absolutePath, options.configPath);
    if (config.threshold && !options.threshold) {
      options.threshold = config.threshold;
    }

    this.customIgnores = [...(config.ignore || []), ...(options.ignore || [])];
    this.astAnalyzer = new ASTAnalyzer(absolutePath);
    this.gitAnalyzer = new GitAnalyzer(absolutePath);
    this.scorer = new GhostScorer(config.weights);

    if (options.coveragePath) {
      this.coverageAnalyzer = new CoverageAnalyzer();
      this.coverageAnalyzer.parseLcov(path.resolve(options.coveragePath));
    }

    if (options.fix || options.prune) {
      this.fixer = new Fixer();
    }
  }

  /**
   * Executes the full scan pipeline across the target workspace directory.
   */
  public async run(): Promise<ScanSummary> {
    const targetDir = path.resolve(this.options.path);
    if (this.options.debug) {
      console.log(`[DEBUG] Starting scan on target directory: ${targetDir}`);
    }

    this.astAnalyzer.initialize(targetDir, this.customIgnores);
    const sourceFiles = this.astAnalyzer.getSourceFiles();

    if (this.options.debug) {
      console.log(`[DEBUG] Discovered ${sourceFiles.length} candidate TypeScript source files.`);
    }

    const reports: FileReport[] = [];
    let highRisk = 0;
    let mediumRisk = 0;
    let lowRisk = 0;
    let fixedFilesCount = 0;
    let prunedFunctionsCount = 0;

    for (const file of sourceFiles) {
      const astMetrics = this.astAnalyzer.analyzeFile(file);
      const gitMetrics = await this.gitAnalyzer.getMetrics(astMetrics.filePath, Boolean(this.options.orphans));
      const coverageMetrics = this.coverageAnalyzer?.getCoverage(astMetrics.filePath);

      const fileMetrics = {
        ...astMetrics,
        git: gitMetrics,
        coverage: coverageMetrics,
      };

      const ghostScore = this.scorer.calculateScore(fileMetrics);

      let fixed = false;
      let pruned = false;

      // Apply fix / prune if flagged and score exceeds threshold
      if (this.fixer && ghostScore.score >= this.options.threshold) {
        const result = this.fixer.fixFile(fileMetrics, Boolean(this.options.fix), Boolean(this.options.prune));
        fixed = result.fixed;
        if (result.fixed) fixedFilesCount++;
        if (result.prunedCount > 0) {
          pruned = true;
          prunedFunctionsCount += result.prunedCount;
        }
      }

      if (ghostScore.riskLevel === 'HIGH RISK') highRisk++;
      else if (ghostScore.riskLevel === 'MEDIUM RISK') mediumRisk++;
      else lowRisk++;

      reports.push({
        file: fileMetrics,
        score: ghostScore,
        fixed,
        pruned,
      });
    }

    // Sort reports descending by ghost score
    reports.sort((a, b) => b.score.score - a.score.score);

    const ghostCandidates = reports.filter((r) => r.score.score >= this.options.threshold).length;

    const summary: ScanSummary = {
      totalFilesScanned: sourceFiles.length,
      ghostCandidates,
      highRisk,
      mediumRisk,
      lowRisk,
      fixedFilesCount,
      prunedFunctionsCount,
      reports,
    };

    // Generate HTML report if requested
    if (this.options.htmlPath) {
      const htmlReporter = new HtmlReporter();
      htmlReporter.generate(summary, this.options.htmlPath);
    }

    return summary;
  }
}
