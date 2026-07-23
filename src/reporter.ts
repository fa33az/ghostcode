import chalk from 'chalk';
import { ScanSummary, FileReport } from './types.js';

export class Reporter {
  /**
   * Render report output either as formatted chalk terminal text or JSON.
   */
  public render(summary: ScanSummary, isJson: boolean, threshold: number): void {
    if (isJson) {
      console.log(JSON.stringify(summary, null, 2));
      return;
    }

    console.log(chalk.bold.magenta('\n--------------------------------------------------'));
    console.log(chalk.bold.magenta('Ghost Code Report\n'));

    const filteredReports = summary.reports.filter((r) => r.score.score >= threshold);

    if (filteredReports.length === 0) {
      console.log(chalk.green('Clean repository! No ghost code candidates found above threshold.\n'));
    } else {
      for (const report of filteredReports) {
        this.renderFileReport(report);
      }
    }

    this.renderSummary(summary);
  }

  private renderFileReport(report: FileReport): void {
    const { file, score } = report;
    const days = file.git.daysSinceLastCommit;
    const lastModifiedText = days === 0 ? 'Today' : `${days} days ago`;

    let riskBadge = chalk.green(score.riskLevel);
    if (score.riskLevel === 'HIGH RISK') {
      riskBadge = chalk.bgRed.white.bold(` ${score.riskLevel} `);
    } else if (score.riskLevel === 'MEDIUM RISK') {
      riskBadge = chalk.bgYellow.black.bold(` ${score.riskLevel} `);
    }

    console.log(`${chalk.cyan('File:')} ${file.relativePath}`);
    console.log(`${chalk.gray('Last Modified:')} ${lastModifiedText}`);
    console.log(`${chalk.gray('Import Count:')} ${file.importCount}`);
    console.log(
      `${chalk.gray('Referenced In Tests:')} ${
        file.isReferencedInTests ? chalk.green('Yes') : chalk.red('No')
      }`
    );
    console.log(`${chalk.gray('Commit Count:')} ${file.git.commitCount}`);
    console.log(
      `\n${chalk.bold('Ghost Score:')} ${chalk.bold.red(`${score.score}/100`)} (${riskBadge})`
    );
    console.log(`${chalk.bold('Status:')} ${chalk.italic(score.status)}`);

    // Show ghost functions if present
    const ghostFunctions = file.functions.filter((f) => f.isGhost);
    if (ghostFunctions.length > 0) {
      console.log(chalk.yellow('\n  Ghost Functions Detected:'));
      for (const fn of ghostFunctions) {
        console.log(
          `   - ${chalk.yellow(fn.name)} (L${fn.startLine}-L${fn.endLine}) [Exported: ${
            fn.isExported ? 'Yes' : 'No'
          }]`
        );
      }
    }

    console.log(chalk.gray('--------------------------------------------------\n'));
  }

  private renderSummary(summary: ScanSummary): void {
    console.log(chalk.bold.underline('Summary Metrics:\n'));
    console.log(`${chalk.blue('Total Files Scanned:')} ${summary.totalFilesScanned}`);
    console.log(`${chalk.yellow('Ghost Candidates:')}    ${summary.ghostCandidates}`);
    console.log(` ${chalk.red('High Risk:')}         ${summary.highRisk}`);
    console.log(` ${chalk.yellow('Medium Risk:')}       ${summary.mediumRisk}`);
    console.log(` ${chalk.green('Low Risk:')}          ${summary.lowRisk}`);
    console.log(chalk.bold.magenta('--------------------------------------------------\n'));
  }
}
