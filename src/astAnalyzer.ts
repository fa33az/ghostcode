import { Project, SourceFile, SyntaxKind } from 'ts-morph';
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
   * Initializes ts-morph project loading all TypeScript files in path, respecting ignores.
   */
  public initialize(targetDir: string, customIgnores: string[] = []) {
    const globPattern = path.join(targetDir, '**/*.{ts,tsx,js,jsx}').replace(/\\/g, '/');
    const ignorePatterns = [
      '!**/node_modules/**',
      '!**/dist/**',
      '!**/build/**',
      '!**/.git/**',
      ...customIgnores.map((g) => (g.startsWith('!') ? g : `!${g}`)),
    ];

    this.project.addSourceFilesAtPaths([globPattern, ...ignorePatterns]);

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

    // 1. Analyze standard function declarations
    const functions = sourceFile.getFunctions();
    for (const fn of functions) {
      const fnName = fn.getName();
      if (!fnName) continue;

      const isExported = fn.isExported();
      const startLine = fn.getStartLineNumber();
      const endLine = fn.getEndLineNumber();

      const { referenceCount, testReferenceCount } = this.countReferences(fn, sourceFile, fnName);
      const isGhost = (isExported && referenceCount === 0 && importCount === 0) ||
                      (!isExported && referenceCount === 0);

      functionMetrics.push({
        name: fnName,
        kind: 'function',
        isExported,
        startLine,
        endLine,
        referenceCount,
        importCount,
        testReferenceCount,
        isGhost,
      });
    }

    // 2. Analyze arrow functions assigned to variables (export const foo = () => {})
    const variableDeclarations = sourceFile.getVariableDeclarations();
    for (const varDecl of variableDeclarations) {
      const initializer = varDecl.getInitializer();
      if (!initializer || (initializer.getKind() !== SyntaxKind.ArrowFunction && initializer.getKind() !== SyntaxKind.FunctionExpression)) {
        continue;
      }

      const varName = varDecl.getName();
      const varStatement = varDecl.getVariableStatement();
      const isExported = varStatement ? varStatement.isExported() : false;
      const startLine = varDecl.getStartLineNumber();
      const endLine = varDecl.getEndLineNumber();

      const { referenceCount, testReferenceCount } = this.countReferences(varDecl, sourceFile, varName);
      const isGhost = (isExported && referenceCount === 0 && importCount === 0) ||
                      (!isExported && referenceCount === 0);

      functionMetrics.push({
        name: varName,
        kind: 'arrow',
        isExported,
        startLine,
        endLine,
        referenceCount,
        importCount,
        testReferenceCount,
        isGhost,
      });
    }

    // 3. Analyze class methods
    const classes = sourceFile.getClasses();
    for (const cls of classes) {
      for (const method of cls.getMethods()) {
        const methodName = method.getName();
        const isExported = cls.isExported();
        const startLine = method.getStartLineNumber();
        const endLine = method.getEndLineNumber();

        const { referenceCount, testReferenceCount } = this.countReferences(method, sourceFile, methodName);
        const isGhost = referenceCount === 0 && (importCount === 0 || !isExported);

        functionMetrics.push({
          name: `${cls.getName() || 'Anonymous'}.${methodName}`,
          kind: 'method',
          isExported,
          startLine,
          endLine,
          referenceCount,
          importCount,
          testReferenceCount,
          isGhost,
        });
      }
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

  private countReferences(node: any, sourceFile: SourceFile, symbolSearchName: string) {
    let referenceCount = 0;
    let testReferenceCount = 0;

    try {
      const refs = node.findReferences ? node.findReferences() : [];
      for (const refGroup of refs) {
        for (const ref of refGroup.getReferences()) {
          const refSourceFile = ref.getSourceFile();
          if (refSourceFile === sourceFile && ref.getNode().getStart() === node.getNameNode?.()?.getStart?.()) {
            continue; // Skip declaration site
          }

          if (this.isTestFile(refSourceFile.getFilePath())) {
            testReferenceCount++;
          } else {
            referenceCount++;
          }
        }
      }
    } catch {
      // Fallback
    }

    if (testReferenceCount === 0 && this.isFunctionNameInTests(symbolSearchName)) {
      testReferenceCount = 1;
    }

    return { referenceCount, testReferenceCount };
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
