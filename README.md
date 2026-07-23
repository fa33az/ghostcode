<p align="center">
  <img src="assets/logo.png" alt="Ghostcode Logo" width="180" />
</p>

<h1 align="center">Ghostcode</h1>

<p align="center">
  <a href="https://www.npmjs.com/package/@fa33az/ghostcode"><img src="https://img.shields.io/npm/v/%40fa33az/ghostcode.svg?style=flat-square" alt="NPM Version" /></a>
  <a href="https://www.npmjs.com/package/@fa33az/ghostcode"><img src="https://img.shields.io/badge/npm-%40fa33az%2Fghostcode-red.svg?style=flat-square" alt="NPM Package" /></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square" alt="License: MIT" /></a>
  <a href="https://nodejs.org"><img src="https://img.shields.io/badge/Node.js-%3E%3D18.0.0-brightgreen.svg?style=flat-square" alt="Node.js Version" /></a>
  <a href="https://www.typescriptlang.org/"><img src="https://img.shields.io/badge/TypeScript-5.5-blue.svg?style=flat-square" alt="TypeScript" /></a>
  <a href="https://ts-morph.com/"><img src="https://img.shields.io/badge/AST_Engine-ts--morph-purple.svg?style=flat-square" alt="AST Engine" /></a>
  <a href="https://github.com/tj/commander.js"><img src="https://img.shields.io/badge/CLI-Commander.js-black.svg?style=flat-square" alt="CLI Framework" /></a>
</p>

<p align="center">
  Deep structural and behavioral static analysis CLI tool to detect <b>Ghost Code</b> in TypeScript repositories.
</p>

---

## Table of Contents

- [Overview](#overview)
- [Key Features](#key-features)
- [Architecture](#architecture)
- [Installation](#installation)
- [CLI Usage & Options](#cli-usage--options)
- [Interactive HTML Dashboard](#interactive-html-dashboard)
- [Automated Fix & Prune Modes](#automated-fix--prune-modes)
- [LCOV Coverage & Orphan Author Analysis](#lcov-coverage--orphan-author-analysis)
- [CI/CD Strict Enforcement & Templates](#cicd-strict-enforcement--templates)
- [Ghost Score Calculation Engine](#ghost-score-calculation-engine)
- [Author](#author)
- [License](#license)

---

## Overview

**Ghost Code** refers to code that is syntactically valid and non-throwing, yet structurally isolated, rarely modified, untested, and virtually unreferenced within a codebase.

Unlike superficial unused import linters, **Ghostcode** combines AST static analysis (functions, arrow functions, class methods), Git revision metrics, LCOV test execution coverage, and author ownership tracking to evaluate code viability through a multi-factor behavioral scoring engine.

---

## Key Features

- **Deep AST Reference Analysis**: Uses `ts-morph` to traverse inter-file import graphs, exported function declarations, arrow functions (`export const fn = () => {}`), and class methods.
- **Interactive HTML Dashboard**: Generate a standalone, single-file HTML report dashboard with live search filtering, risk meters, and code location breakdowns.
- **Git History & Author Metrics**: Analyzes commit frequency, modification age, and flags **Orphan Code** written by contributors who left or haven't committed in > 365 days.
- **LCOV Test Coverage Integration**: Cross-references AST symbols with `lcov.info` execution coverage data.
- **Automated Fix & Prune Engine**: `--fix` appends `@deprecated` JSDoc tags to ghost functions; `--prune` safely strips unreferenced internal ghost code.
- **CI Strict Mode**: `--fail-on-high` returns exit code 1 if High Risk candidates exceed configured thresholds.
- **Multi-CI Templates**: Built-in GitHub Actions, GitLab CI, and Bitbucket Pipelines integration templates.

---

## Architecture

```
ghostcode/
├── .github/workflows/
│   └── ghostcode.yml        # GitHub Action workflow
├── templates/
│   ├── .gitlab-ci.yml       # GitLab CI pipeline template
│   └── bitbucket-pipelines.yml # Bitbucket Pipelines template
├── src/
│   ├── index.ts             # CLI entry point powered by Commander
│   ├── scanner.ts           # Core scan pipeline orchestrator
│   ├── gitAnalyzer.ts       # Git history, revision timestamp & author orphan parser
│   ├── astAnalyzer.ts       # Deep AST dependency & symbol analyzer (ts-morph)
│   ├── ghostScorer.ts       # Dynamic 6-factor Ghost Score calculation engine
│   ├── htmlReporter.ts      # Interactive HTML dashboard generator
│   ├── configLoader.ts      # Configuration file loader (.ghostcoderc)
│   ├── coverageAnalyzer.ts  # LCOV test execution coverage parser
│   ├── fixer.ts             # Automated AST fixer (@deprecated tagging & function pruning)
│   ├── reporter.ts          # Chalk terminal and JSON reporting module
│   └── types.ts             # Domain models and interface definitions
├── assets/
│   └── logo.png             # Project logo
├── dist/                    # Compiled ESM production output
├── package.json
└── tsconfig.json
```

---

## Installation

### Global Installation

```bash
npm install -g @fa33az/ghostcode
```

### Run via NPX

```bash
npx @fa33az/ghostcode --threshold 70
```

---

## CLI Usage & Options

```bash
ghostcode [options]
```

### Options Reference

| Flag | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `-p, --path <dir>` | `string` | `.` | Target project directory to analyze |
| `-t, --threshold <number>` | `number` | `70` | Minimum Ghost Score threshold (0–100) for candidate flagging |
| `-c, --config <file>` | `string` | - | Path to custom ghostcode config file |
| `-i, --ignore <globs...>` | `string[]` | - | Glob patterns to ignore (e.g. `--ignore "**/vendor/**" "**/dist/**"`) |
| `--coverage <file>` | `string` | - | Path to LCOV coverage file (e.g. `coverage/lcov.info`) |
| `--html <file>` | `string` | - | Generate an interactive standalone HTML report (e.g. `report.html`) |
| `--orphans` | `boolean` | `false` | Analyze Git author history for orphan contributors (> 365 days inactive) |
| `--fix` | `boolean` | `false` | Automatically append `@deprecated` JSDoc tags to ghost functions |
| `--prune` | `boolean` | `false` | Safely remove unreferenced internal ghost functions |
| `--fail-on-high [max]` | `number` | `0` | Fail CI process (exit code 1) if High Risk candidates exceed max allowed count |
| `--json` | `boolean` | `false` | Output results in raw JSON format |
| `--debug` | `boolean` | `false` | Enable verbose log output |
| `-v, --version` | `boolean` | - | Display version information |
| `-h, --help` | `boolean` | - | Display help documentation |

---

## Interactive HTML Dashboard

Generate a self-contained interactive HTML report dashboard:

```bash
ghostcode --html ghostcode-report.html
```

---

## CI/CD Strict Enforcement & Templates

- **Fail Pipeline on High Risk Code**:
  ```bash
  ghostcode --threshold 70 --fail-on-high 0
  ```

- **Built-in Pipeline Templates**:
  - GitHub Actions: `.github/workflows/ghostcode.yml`
  - GitLab CI: `templates/.gitlab-ci.yml`
  - Bitbucket Pipelines: `templates/bitbucket-pipelines.yml`

---

## Automated Fix & Prune Modes

- **Tagging Deprecated Ghost Code**:
  ```bash
  ghostcode --fix --threshold 70
  ```

- **Safe Pruning Internal Ghost Code**:
  ```bash
  ghostcode --prune --threshold 80
  ```

---

## Author

**Fawwaz Fadhil Rasyad**
- GitHub: [@fa33az](https://github.com/fa33az)

---

## License

This project is licensed under the **MIT License** - see the [LICENSE](LICENSE) file for details.
