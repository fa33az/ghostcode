# Ghostcode

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Node.js Version](https://img.shields.io/badge/Node.js-%3E%3D18.0.0-brightgreen.svg?style=flat-square)](https://nodejs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.5-blue.svg?style=flat-square)](https://www.typescriptlang.org/)
[![AST Engine](https://img.shields.io/badge/AST Engine-ts--morph-purple.svg?style=flat-square)](https://ts-morph.com/)
[![CLI Framework](https://img.shields.io/badge/CLI-Commander.js-black.svg?style=flat-square)](https://github.com/tj/commander.js)

Deep structural and behavioral static analysis CLI tool to detect **Ghost Code** in TypeScript repositories.

---

## Table of Contents

- [Overview](#overview)
- [Key Features](#key-features)
- [Architecture](#architecture)
- [Installation](#installation)
- [CLI Usage](#cli-usage)
- [Example Output](#example-output)
- [Ghost Score Calculation Engine](#ghost-score-calculation-engine)
- [Programmatic API & CI/CD Integration](#programmatic-api--cicd-integration)
- [Development](#development)
- [Author](#author)
- [License](#license)

---

## Overview

**Ghost Code** refers to code that is syntactically valid and non-throwing, yet structurally isolated, rarely modified, untested, and virtually unreferenced within a codebase.

Unlike superficial unused import linters, **Ghostcode** combines AST static analysis with Git revision metrics to evaluate code viability through a multi-factor behavioral scoring engine.

---

## Key Features

- **Deep AST Reference Analysis**: Uses `ts-morph` to traverse inter-file import graphs, exported function references, and internal call sites.
- **Git History Metrics**: Analyzes commit frequency and elapsed time since last modification per file using native Git log parsing.
- **Test Absence Tracking**: Identifies missing `*.test.ts` or `*.spec.ts` pairs and detects function name absence across test suites.
- **Transparent Scoring Engine**: Computes a deterministic Ghost Score (0–100) with configurable weighting across Age, References, Tests, and Commits.
- **Flexible Output Formats**: Supports human-readable terminal rendering with `chalk` and raw JSON output for CI/CD integration.

---

## Architecture

```
ghostcode/
├── src/
│   ├── index.ts          # CLI entry point powered by Commander
│   ├── scanner.ts        # Core scan pipeline orchestrator
│   ├── gitAnalyzer.ts    # Git history & revision timestamp parser
│   ├── astAnalyzer.ts    # Static AST dependency & test analyzer (ts-morph)
│   ├── ghostScorer.ts    # 4-factor Ghost Score calculation engine
│   ├── reporter.ts       # Chalk terminal and JSON reporting module
│   └── types.ts          # Core domain models and interface definitions
├── dist/                 # Compiled ESM production output
├── package.json
└── tsconfig.json
```

---

## Installation

### Requirements

- Node.js >= 18.0.0
- Git

### Global Installation

```bash
npm install -g ghostcode
```

### Local Repository Installation

```bash
# Clone the repository
git clone https://github.com/fa33az/ghostcode.git
cd ghostcode

# Install dependencies
npm install

# Build production bundle
npm run build

# Link binary globally for development
npm link
```

---

## CLI Usage

Run `ghostcode` inside any TypeScript repository:

```bash
ghostcode [options]
```

### Command Options

| Flag | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `-p, --path <dir>` | `string` | `.` | Target project directory to analyze |
| `-t, --threshold <number>` | `number` | `70` | Minimum Ghost Score threshold (0–100) for candidate flagging |
| `--json` | `boolean` | `false` | Output results in raw JSON format |
| `--debug` | `boolean` | `false` | Enable verbose log output |
| `-v, --version` | `boolean` | - | Display version information |
| `-h, --help` | `boolean` | - | Display help documentation |

---

## Example Output

### Standard Terminal Scan

```bash
ghostcode --path ./src --threshold 70
```

#### Output Sample

```text
--------------------------------------------------
Ghost Code Report

File: src/utils/legacyFormatter.ts
Last Modified: 482 days ago
Import Count: 0
Referenced In Tests: No
Commit Count: 1

Ghost Score: 87/100 ( HIGH RISK )
Status: Likely Dead Code

  Ghost Functions Detected:
   - formatLegacyDate (L12-L34) [Exported: Yes]

--------------------------------------------------
Summary Metrics:

Total Files Scanned: 142
Ghost Candidates:    11
 High Risk:          4
 Medium Risk:        5
 Low Risk:           2
--------------------------------------------------
```

---

## Ghost Score Calculation Engine

The **Ghost Score** ranges from **0 (Active Code)** to **100 (Likely Dead Code)**.

### Formula

```
Ghost Score = (Age Score * 0.3) + (Reference Score * 0.3) + (Test Score * 0.2) + (Commit Score * 0.2)
```

### Factor Breakdown

1. **Age Score (Weight: 0.3)**: Evaluates days elapsed since the file was last committed. Files untouched for >= 180 days receive a score of 100.
2. **Reference Score (Weight: 0.3)**: Measures incoming file imports and internal symbol references across the project. 0 incoming imports or references receive 100.
3. **Test Score (Weight: 0.2)**: Evaluates test presence. Absence of matching test files (`*.test.ts` / `*.spec.ts`) and zero references in test suites receive 100.
4. **Commit Score (Weight: 0.2)**: Measures historical commit frequency. Single-commit files (written once and forgotten) receive 100.

### Risk Classifications

- **HIGH RISK (Score >= 70)**: High probability of obsolete or dead code.
- **MEDIUM RISK (Score 40–69)**: Low reference density or outdated code requiring inspection.
- **LOW RISK (Score < 40)**: Actively maintained or well-referenced code.

---

## Programmatic API & CI/CD Integration

Export results as JSON for automated CI/CD pipeline enforcement:

```bash
ghostcode --path . --threshold 80 --json > ghostcode-report.json
```

---

## Development

```bash
# Typecheck TypeScript codebase
npm run typecheck

# Run development watcher
npm run dev

# Production build
npm run build
```

---

## Author

**Fawwaz Fadhil Rasyad**
- GitHub: [@fa33az](https://github.com/fa33az)

---

## License

This project is licensed under the **MIT License** - see the [LICENSE](LICENSE) file for details.

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files, to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software.
