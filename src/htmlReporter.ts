import fs from 'node:fs';
import path from 'node:path';
import { ScanSummary } from './types.js';

export class HtmlReporter {
  /**
   * Generates a sleek, single-file HTML report dashboard.
   */
  public generate(summary: ScanSummary, outputPath: string): void {
    const absolutePath = path.resolve(outputPath);
    const dirPath = path.dirname(absolutePath);

    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
    }

    const htmlContent = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Ghostcode - Static Analysis Report</title>
  <style>
    :root {
      --bg-primary: #0f172a;
      --bg-card: #1e293b;
      --bg-hover: #334155;
      --text-main: #f8fafc;
      --text-muted: #94a3b8;
      --accent-red: #ef4444;
      --accent-yellow: #f59e0b;
      --accent-green: #10b981;
      --accent-purple: #8b5cf6;
      --border-color: #334155;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      background-color: var(--bg-primary);
      color: var(--text-main);
      padding: 2rem;
      line-height: 1.5;
    }
    .header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 2rem;
      border-bottom: 1px solid var(--border-color);
      padding-bottom: 1rem;
    }
    .header h1 { font-size: 1.8rem; font-weight: 700; color: var(--text-main); }
    .header p { color: var(--text-muted); font-size: 0.9rem; }
    .stats-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 1rem;
      margin-bottom: 2rem;
    }
    .stat-card {
      background-color: var(--bg-card);
      border: 1px solid var(--border-color);
      border-radius: 8px;
      padding: 1.25rem;
      text-align: center;
    }
    .stat-card .value { font-size: 2rem; font-weight: 700; margin-top: 0.25rem; }
    .stat-card.high .value { color: var(--accent-red); }
    .stat-card.medium .value { color: var(--accent-yellow); }
    .stat-card.low .value { color: var(--accent-green); }
    .search-bar {
      width: 100%;
      padding: 0.75rem 1rem;
      background-color: var(--bg-card);
      border: 1px solid var(--border-color);
      border-radius: 6px;
      color: var(--text-main);
      margin-bottom: 1.5rem;
      font-size: 1rem;
    }
    .search-bar:focus { outline: 2px solid var(--accent-purple); }
    .file-card {
      background-color: var(--bg-card);
      border: 1px solid var(--border-color);
      border-radius: 8px;
      padding: 1.25rem;
      margin-bottom: 1rem;
    }
    .file-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 0.75rem;
    }
    .file-path { font-family: monospace; font-size: 1.05rem; font-weight: 600; color: #38bdf8; }
    .risk-badge {
      padding: 0.25rem 0.6rem;
      border-radius: 4px;
      font-size: 0.75rem;
      font-weight: 700;
      text-transform: uppercase;
    }
    .risk-high { background-color: rgba(239, 68, 68, 0.2); color: var(--accent-red); border: 1px solid var(--accent-red); }
    .risk-medium { background-color: rgba(245, 158, 11, 0.2); color: var(--accent-yellow); border: 1px solid var(--accent-yellow); }
    .risk-low { background-color: rgba(16, 185, 129, 0.2); color: var(--accent-green); border: 1px solid var(--accent-green); }
    .metrics-list {
      display: flex;
      flex-wrap: wrap;
      gap: 1.5rem;
      font-size: 0.85rem;
      color: var(--text-muted);

    }
    .metrics-list span strong { color: var(--text-main); }
    .functions-list {
      margin-top: 1rem;
      padding-top: 0.75rem;
      border-top: 1px solid var(--border-color);
    }
    .functions-list h4 { font-size: 0.85rem; color: var(--accent-yellow); margin-bottom: 0.5rem; }
    .fn-item {
      font-family: monospace;
      font-size: 0.85rem;
      background-color: var(--bg-primary);
      padding: 0.4rem 0.6rem;
      border-radius: 4px;
      margin-bottom: 0.25rem;
    }
  </style>
</head>
<body>
  <div class="header">
    <div>
      <h1>Ghostcode Analysis Report</h1>
      <p>Generated on ${new Date().toLocaleString()}</p>
    </div>
  </div>

  <div class="stats-grid">
    <div class="stat-card">
      <div>Total Files Scanned</div>
      <div class="value">${summary.totalFilesScanned}</div>
    </div>
    <div class="stat-card high">
      <div>High Risk</div>
      <div class="value">${summary.highRisk}</div>
    </div>
    <div class="stat-card medium">
      <div>Medium Risk</div>
      <div class="value">${summary.mediumRisk}</div>
    </div>
    <div class="stat-card low">
      <div>Low Risk</div>
      <div class="value">${summary.lowRisk}</div>
    </div>
  </div>

  <input type="text" id="searchInput" class="search-bar" placeholder="Search file path or function name..." onkeyup="filterFiles()">

  <div id="fileContainer">
    ${summary.reports
      .map((r) => {
        const riskClass =
          r.score.riskLevel === 'HIGH RISK'
            ? 'risk-high'
            : r.score.riskLevel === 'MEDIUM RISK'
            ? 'risk-medium'
            : 'risk-low';

        const ghostFns = r.file.functions.filter((f) => f.isGhost);
        const fnsHtml =
          ghostFns.length > 0
            ? `<div class="functions-list">
                <h4>Ghost Functions (${ghostFns.length})</h4>
                ${ghostFns
                  .map(
                    (f) =>
                      `<div class="fn-item">${f.name} (L${f.startLine}-L${f.endLine}) [Kind: ${f.kind}]</div>`
                  )
                  .join('')}
               </div>`
            : '';

        return `
      <div class="file-card" data-search="${r.file.relativePath.toLowerCase()} ${ghostFns
          .map((f) => f.name)
          .join(' ')
          .toLowerCase()}">
        <div class="file-header">
          <span class="file-path">${r.file.relativePath}</span>
          <span class="risk-badge ${riskClass}">${r.score.score}/100 - ${r.score.riskLevel}</span>
        </div>
        <div class="metrics-list">
          <span>Last Modified: <strong>${
            r.file.git.daysSinceLastCommit === 0
              ? 'Today'
              : `${r.file.git.daysSinceLastCommit} days ago`
          }</strong></span>
          <span>Imports: <strong>${r.file.importCount}</strong></span>
          <span>Commits: <strong>${r.file.git.commitCount}</strong></span>
          <span>Test Reference: <strong>${r.file.isReferencedInTests ? 'Yes' : 'No'}</strong></span>
          ${
            r.file.git.author
              ? `<span>Author: <strong>${r.file.git.author.lastAuthor}${
                  r.file.git.author.isOrphan ? ' (Orphan)' : ''
                }</strong></span>`
              : ''
          }
          ${
            r.file.coverage
              ? `<span>Coverage: <strong>${r.file.coverage.coveragePercentage}%</strong></span>`
              : ''
          }
        </div>
        ${fnsHtml}
      </div>
        `;
      })
      .join('')}
  </div>

  <script>
    function filterFiles() {
      const query = document.getElementById('searchInput').value.toLowerCase();
      const cards = document.querySelectorAll('.file-card');
      cards.forEach(card => {
        const text = card.getAttribute('data-search');
        card.style.display = text.includes(query) ? 'block' : 'none';
      });
    }
  </script>
</body>
</html>`;

    fs.writeFileSync(absolutePath, htmlContent, 'utf-8');
    console.log(`[HTML] Generated interactive report at: ${absolutePath}`);
  }
}
