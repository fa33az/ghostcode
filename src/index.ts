#!/usr/bin/env node
import { Command } from 'commander';
import path from 'node:path';
import { Scanner } from './scanner.js';
import { Reporter } from './reporter.js';
import { ScanOptions } from './types.js';

const program = new Command();

program
  .name('ghostcode')
  .alias('silent-failure-detector')
  .description('Static analysis CLI tool to detect Ghost Code in TypeScript projects')
  .version('2.1.0')
  .option('-p, --path <dir>', 'Target directory to scan', '.')
  .option('-t, --threshold <number>', 'Ghost Score threshold (0-100)', '70')
  .option('-c, --config <file>', 'Path to custom ghostcode config file')
  .option('-i, --ignore <patterns...>', 'Glob patterns to ignore (e.g. --ignore "**/vendor/**" "**/dist/**")')
  .option('--coverage <file>', 'Path to LCOV coverage file (e.g. coverage/lcov.info)')
  .option('--html <file>', 'Path to generate interactive HTML report (e.g. ghostcode-report.html)')
  .option('--orphans', 'Analyze Git author history for orphan contributors', false)
  .option('--fix', 'Automatically append @deprecated JSDoc tag to ghost functions', false)
  .option('--prune', 'Safely remove unreferenced internal ghost functions', false)
  .option('--fail-on-high [max]', 'Fail CI process (exit 1) if High Risk candidates exceed max allowed count', false)
  .option('--json', 'Output results as JSON', false)
  .option('--debug', 'Enable debug logging', false)
  .action(async (options) => {
    try {
      const scanOptions: ScanOptions = {
        path: path.resolve(options.path),
        threshold: parseInt(options.threshold, 10) || 70,
        configPath: options.config ? path.resolve(options.config) : undefined,
        coveragePath: options.coverage ? path.resolve(options.coverage) : undefined,
        htmlPath: options.html ? path.resolve(options.html) : undefined,
        ignore: Array.isArray(options.ignore) ? options.ignore : undefined,
        orphans: Boolean(options.orphans),
        fix: Boolean(options.fix),
        prune: Boolean(options.prune),
        json: Boolean(options.json),
        debug: Boolean(options.debug),
      };

      const scanner = new Scanner(scanOptions);
      const summary = await scanner.run();

      const reporter = new Reporter();
      reporter.render(summary, scanOptions.json, scanOptions.threshold);

      // Handle --fail-on-high flag logic for CI/CD pipelines
      if (options.failOnHigh !== false) {
        const maxAllowed = typeof options.failOnHigh === 'string' ? parseInt(options.failOnHigh, 10) : 0;
        if (summary.highRisk > maxAllowed) {
          console.error(`\n[CI FAIL] High Risk ghost candidates (${summary.highRisk}) exceed allowed threshold (${maxAllowed}).`);
          process.exit(1);
        }
      }
    } catch (error) {
      console.error('Error executing ghostcode scan:', error);
      process.exit(1);
    }
  });

program.parse(process.argv);
