import fs from 'node:fs';
import path from 'node:path';
import { CoverageMetrics } from './types.js';

export class CoverageAnalyzer {
  private fileCoverageMap: Map<string, CoverageMetrics> = new Map();

  /**
   * Parses an LCOV format coverage file.
   */
  public parseLcov(lcovFilePath: string): boolean {
    if (!fs.existsSync(lcovFilePath)) {
      console.warn(`[WARN] Coverage file not found at: ${lcovFilePath}`);
      return false;
    }

    try {
      const content = fs.readFileSync(lcovFilePath, 'utf-8');
      const lines = content.split(/\r?\n/);

      let currentFile: string | null = null;
      let totalLines = 0;
      let coveredLines = 0;

      for (const line of lines) {
        if (line.startsWith('SF:')) {
          currentFile = line.substring(3).trim().replace(/\\/g, '/');
          totalLines = 0;
          coveredLines = 0;
        } else if (line.startsWith('DA:')) {
          const parts = line.substring(3).split(',');
          if (parts.length >= 2) {
            const hits = parseInt(parts[1], 10) || 0;
            totalLines++;
            if (hits > 0) coveredLines++;
          }
        } else if (line.startsWith('LF:')) {
          totalLines = parseInt(line.substring(3), 10) || totalLines;
        } else if (line.startsWith('LH:')) {
          coveredLines = parseInt(line.substring(3), 10) || coveredLines;
        } else if (line === 'end_of_record') {
          if (currentFile) {
            const percentage = totalLines > 0 ? Math.round((coveredLines / totalLines) * 100) : 0;
            const normalizedPath = path.resolve(currentFile);
            this.fileCoverageMap.set(normalizedPath, {
              coveredLines,
              totalLines,
              coveragePercentage: percentage,
              isCovered: coveredLines > 0,
            });
          }
          currentFile = null;
        }
      }

      return true;
    } catch (error) {
      console.warn(`[WARN] Error parsing LCOV file ${lcovFilePath}:`, error);
      return false;
    }
  }

  public getCoverage(absoluteFilePath: string): CoverageMetrics | undefined {
    const normalized = path.resolve(absoluteFilePath);
    return this.fileCoverageMap.get(normalized);
  }
}
