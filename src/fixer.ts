import { Project, SourceFile } from 'ts-morph';
import { FileMetrics } from './types.js';

export class Fixer {
  private project: Project;

  constructor() {
    this.project = new Project({
      skipAddingFilesFromTsConfig: true,
    });
  }

  /**
   * Applies automated fixes: Adds @deprecated docstrings or prunes unreferenced internal ghost functions.
   */
  public fixFile(fileMetrics: FileMetrics, fixMode: boolean, pruneMode: boolean): { fixed: boolean; prunedCount: number } {
    if (!fixMode && !pruneMode) {
      return { fixed: false, prunedCount: 0 };
    }

    const ghostFunctions = fileMetrics.functions.filter((f) => f.isGhost);
    if (ghostFunctions.length === 0) {
      return { fixed: false, prunedCount: 0 };
    }

    const sourceFile = this.project.addSourceFileAtPathIfExists(fileMetrics.filePath);
    if (!sourceFile) {
      return { fixed: false, prunedCount: 0 };
    }

    let modified = false;
    let prunedCount = 0;

    for (const ghostFn of ghostFunctions) {
      const fnDecl = sourceFile.getFunction(ghostFn.name);
      if (!fnDecl) continue;

      if (pruneMode && !ghostFn.isExported && ghostFn.referenceCount === 0) {
        // Safe prune unreferenced internal function
        fnDecl.remove();
        prunedCount++;
        modified = true;
      } else if (fixMode) {
        // Append @deprecated JSDoc tag
        const docs = fnDecl.getJsDocs();
        const hasDeprecatedTag = docs.some((d) => d.getTags().some((t) => t.getTagName() === 'deprecated'));

        if (!hasDeprecatedTag) {
          fnDecl.addJsDoc({
            description: 'Ghost code detected by ghostcode analysis.',
            tags: [{ tagName: 'deprecated', text: 'This function is unreferenced and marked as ghost code.' }],
          });
          modified = true;
        }
      }
    }

    if (modified) {
      sourceFile.saveSync();
    }

    return { fixed: modified, prunedCount };
  }
}
