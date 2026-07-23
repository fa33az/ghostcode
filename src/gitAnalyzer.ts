import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import fs from 'node:fs';
import path from 'node:path';
import { GitMetrics } from './types.js';

const execFileAsync = promisify(execFile);

/**
 * GitAnalyzer extracts revision history metrics using native git commands.
 * Handles non-git repositories or untracked files with filesystem fallbacks.
 */
export class GitAnalyzer {
  private isGitRepoCache: boolean | null = null;

  constructor(private projectRoot: string) {}

  /**
   * Checks if target project root is inside a valid git working tree.
   */
  async isGitRepository(): Promise<boolean> {
    if (this.isGitRepoCache !== null) {
      return this.isGitRepoCache;
    }
    try {
      await execFileAsync('git', ['rev-parse', '--is-inside-work-tree'], {
        cwd: this.projectRoot,
      });
      this.isGitRepoCache = true;
    } catch {
      this.isGitRepoCache = false;
    }
    return this.isGitRepoCache;
  }

  /**
   * Analyzes git history for a specific file path.
   */
  async getMetrics(absoluteFilePath: string): Promise<GitMetrics> {
    const relativePath = path.relative(this.projectRoot, absoluteFilePath);
    const isGit = await this.isGitRepository();

    if (!isGit) {
      return this.getFallbackMetrics(absoluteFilePath);
    }

    try {
      // Fetch last commit date ISO-8601
      const { stdout: dateOutput } = await execFileAsync(
        'git',
        ['log', '-1', '--format=%cI', '--', relativePath],
        { cwd: this.projectRoot }
      );

      // Fetch commit count
      const { stdout: countOutput } = await execFileAsync(
        'git',
        ['rev-list', '--count', 'HEAD', '--', relativePath],
        { cwd: this.projectRoot }
      );

      const trimmedDate = dateOutput.trim();
      const commitCount = parseInt(countOutput.trim(), 10) || 0;

      if (!trimmedDate) {
        return this.getFallbackMetrics(absoluteFilePath);
      }

      const lastModifiedDate = new Date(trimmedDate);
      const now = new Date();
      const diffTime = Math.abs(now.getTime() - lastModifiedDate.getTime());
      const daysSinceLastCommit = Math.floor(diffTime / (1000 * 60 * 60 * 24));

      return {
        lastModifiedDate,
        daysSinceLastCommit,
        commitCount,
      };
    } catch {
      return this.getFallbackMetrics(absoluteFilePath);
    }
  }

  /**
   * Fallback metric extraction when git command fails or file is untracked.
   */
  private getFallbackMetrics(absoluteFilePath: string): GitMetrics {
    try {
      const stats = fs.statSync(absoluteFilePath);
      const now = new Date();
      const diffTime = Math.abs(now.getTime() - stats.mtime.getTime());
      const daysSinceLastCommit = Math.floor(diffTime / (1000 * 60 * 60 * 24));

      return {
        lastModifiedDate: stats.mtime,
        daysSinceLastCommit,
        commitCount: 1, // Fallback assumption
      };
    } catch {
      return {
        lastModifiedDate: null,
        daysSinceLastCommit: 0,
        commitCount: 0,
      };
    }
  }
}
