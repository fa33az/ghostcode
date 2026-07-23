import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import fs from 'node:fs';
import path from 'node:path';
import { GitMetrics, AuthorMetrics } from './types.js';

const execFileAsync = promisify(execFile);

/**
 * GitAnalyzer extracts revision history metrics and author ownership using native git commands.
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
   * Analyzes git history and author metrics for a specific file path.
   */
  async getMetrics(absoluteFilePath: string, analyzeOrphans: boolean = false): Promise<GitMetrics> {
    const relativePath = path.relative(this.projectRoot, absoluteFilePath);
    const isGit = await this.isGitRepository();

    if (!isGit) {
      return this.getFallbackMetrics(absoluteFilePath);
    }

    try {
      // Fetch last commit date ISO-8601 and author
      const { stdout: logOutput } = await execFileAsync(
        'git',
        ['log', '-1', '--format=%cI|%an|%ae', '--', relativePath],
        { cwd: this.projectRoot }
      );

      // Fetch commit count
      const { stdout: countOutput } = await execFileAsync(
        'git',
        ['rev-list', '--count', 'HEAD', '--', relativePath],
        { cwd: this.projectRoot }
      );

      const parts = logOutput.trim().split('|');
      const trimmedDate = parts[0] || '';
      const authorName = parts[1] || null;
      const authorEmail = parts[2] || null;

      const commitCount = parseInt(countOutput.trim(), 10) || 0;

      if (!trimmedDate) {
        return this.getFallbackMetrics(absoluteFilePath);
      }

      const lastModifiedDate = new Date(trimmedDate);
      const now = new Date();
      const diffTime = Math.abs(now.getTime() - lastModifiedDate.getTime());
      const daysSinceLastCommit = Math.floor(diffTime / (1000 * 60 * 60 * 24));

      let authorMetrics: AuthorMetrics | undefined;
      if (analyzeOrphans && authorEmail) {
        authorMetrics = await this.getAuthorOrphanMetrics(authorEmail, authorName);
      }

      return {
        lastModifiedDate,
        daysSinceLastCommit,
        commitCount,
        author: authorMetrics,
      };
    } catch {
      return this.getFallbackMetrics(absoluteFilePath);
    }
  }

  /**
   * Evaluates if author is an orphan contributor (no commits across project in > 365 days).
   */
  private async getAuthorOrphanMetrics(authorEmail: string, authorName: string | null): Promise<AuthorMetrics> {
    try {
      const { stdout: authorLog } = await execFileAsync(
        'git',
        ['log', '-1', '--author=' + authorEmail, '--format=%cI'],
        { cwd: this.projectRoot }
      );

      const { stdout: authorCommitCount } = await execFileAsync(
        'git',
        ['rev-list', '--count', '--author=' + authorEmail, 'HEAD'],
        { cwd: this.projectRoot }
      );

      const lastCommitDateStr = authorLog.trim();
      const commitCount = parseInt(authorCommitCount.trim(), 10) || 0;

      let isOrphan = false;
      if (lastCommitDateStr) {
        const lastCommitDate = new Date(lastCommitDateStr);
        const daysAgo = Math.floor((Date.now() - lastCommitDate.getTime()) / (1000 * 60 * 60 * 24));
        isOrphan = daysAgo > 365;
      }

      return {
        lastAuthor: authorName || authorEmail,
        isOrphan,
        authorCommitCount: commitCount,
      };
    } catch {
      return {
        lastAuthor: authorName || authorEmail,
        isOrphan: false,
        authorCommitCount: 0,
      };
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
        commitCount: 1,
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
