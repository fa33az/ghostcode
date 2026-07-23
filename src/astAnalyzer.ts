import { Project, SourceFile } from 'ts-morph';
import path from 'node:path';
import { FileMetrics, FunctionMetrics } from './types.js';

export class ASTAnalyzer {
  private project: Project;
  private testFiles: SourceFile[] = [];
  private sourceFiles: SourceFile[] = [];
  private fileImportCounts: Map<string, number> = new Map();

  constructor(private projectRoot: string) {
    this.project = new Project({
      skipAddingFilesFromTsConfig: true,
    });
  }

  /**
   * Initializes ts-morph project loading all TypeScript files in path.
   */
  public initialize(targetDir: string) {
    const globPattern = path.join(targetDir, '**/*.{ts,tsx,js,jsx}').replace(/\\/g, '/');
    this.project.addSourceFilesAtPaths([
      globPattern,
      '!**/node_modules/**',
      '!**/dist/**',
      '!**/build/**',
      '!**/.git/**',
    ]);

    const allFiles = this.project.getSourceFiles();

    for (const file of allFiles) {
      const filePath = file.getFilePath();
      if (this.isTestFile(filePath)) {
        this.testFiles.push(file);
      } else {
        this.sourceFiles.push(file);
      }
    }

    this.calculateImportGraph();
  }

  /**
   * Checks if a given filepath is a test file based on conventions.
   */
  public isTestFile(filePath: string): boolean {
    const normalized = filePath.replace(/\\/g, '/');
    return (
      /\.(test|spec)\.[jt]sx?$/i.test(normalized) ||
      /\/__tests__\//i.test(normalized)
    );
  }

  /**
   * Pre-calculates incoming import counts for all source files.
   */
  private calculateImportGraph() {
    for (const sourceFile of this.project.getSourceFiles()) {
      const importDeclarations = sourceFile.getImportDeclarations();
      for (const importDecl of importDeclarations) {
        const moduleSpecifier = importDecl.getModuleSpecifierSourceFile();
        if (moduleSpecifier) {
          const targetPath = moduleSpecifier.getFilePath();
          const currentCount = this.fileImportCounts.get(targetPath) || 0;
          this.fileImportCounts.set(targetPath, currentCount + 1);
        }
      }
    }
  }

  public getSourceFiles(): SourceFile[] {
    return this.sourceFiles;
  }

  /**
   * Performs deep analysis of a source file's AST and references.
   */
  public analyzeFile(sourceFile: SourceFile): Omit<FileMetrics, 'git'> {
    const filePath = sourceFile.getFilePath();
    const relativePath = path.relative(this.projectRoot, filePath);
    const importCount = this.fileImportCounts.get(filePath) || 0;

    const hasCorrespondingTestFile = this.hasTestFilePair(sourceFile);
    const functionMetrics: FunctionMetrics[] = [];

    // Analyze regular function declarations
    const functions = sourceFile.getFunctions();
    for (const fn of functions) {
      const fnName = fn.getName();
      if (!fnName) continue;

      const isExported = fn.isExported();
      const startLine = fn.getStartLineNumber();
      const endLine = fn.getEndLineNumber();

      const refs = fn.findReferences();
      let referenceCount = 0;
      let testReferenceCount = 0;

      for (const refGroup of refs) {
        for (const ref of refGroup.getReferences()) {
          const refSourceFile = ref.getSourceFile();
          if (refSourceFile === sourceFile && ref.getNode().getStart() === fn.getNameNode()?.getStart()) {
            continue; // Skip self declaration
          }

          if (this.isTestFile(refSourceFile.getFilePath())) {
            testReferenceCount++;
          } else {
            referenceCount++;
          }
        }
      }

      // Check for textual mention in test files if symbol reference wasn't caught
      if (testReferenceCount === 0 && this.isFunctionNameInTests(fnName)) {
        testReferenceCount = 1;
      }

      const isGhost = (isExported && referenceCount === 0 && importCount === 0) ||
                      (!isExported && referenceCount === 0);

      functionMetrics.push({
        name: fnName,
        isExported,
        startLine,
        endLine,
        referenceCount,
        importCount,
        testReferenceCount,
        isGhost,
      });
    }

    const isReferencedInTests = hasCorrespondingTestFile ||
      functionMetrics.some((f) => f.testReferenceCount > 0) ||
      this.isFileNameInTests(sourceFile);

    return {
      filePath,
      relativePath,
      importCount,
      isReferencedInTests,
      functions: functionMetrics,
    };
  }

  private hasTestFilePair(sourceFile: SourceFile): boolean {
    const filePath = sourceFile.getFilePath();
    const parsed = path.parse(filePath);
    const possibleTestNames = [
      path.join(parsed.dir, `${parsed.name}.test${parsed.ext}`),
      path.join(parsed.dir, `${parsed.name}.spec${parsed.ext}`),
      path.join(parsed.dir, '__tests__', `${parsed.name}${parsed.ext}`),
      path.join(parsed.dir, '__tests__', `${parsed.name}.test${parsed.ext}`),
    ].map((p) => p.replace(/\\/g, '/'));

    return this.testFiles.some((tf) => possibleTestNames.includes(tf.getFilePath().replace(/\\/g, '/')));
  }

  private isFunctionNameInTests(functionName: string): boolean {
    for (const testFile of this.testFiles) {
      if (testFile.getFullText().includes(functionName)) {
        return true;
      }
    }
    return false;
  }

  private isFileNameInTests(sourceFile: SourceFile): boolean {
    const baseName = path.parse(sourceFile.getFilePath()).name;
    for (const testFile of this.testFiles) {
      if (testFile.getFullText().includes(baseName)) {
        return true;
      }
    }
    return false;
  }
}
