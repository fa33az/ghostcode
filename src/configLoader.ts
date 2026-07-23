import fs from 'node:fs';
import path from 'node:path';
import { GhostConfig } from './types.js';

export class ConfigLoader {
  /**
   * Attempts to load ghostcode configuration from path or default locations.
   */
  public static load(projectRoot: string, customConfigPath?: string): GhostConfig {
    const candidatePaths = customConfigPath
      ? [path.resolve(customConfigPath)]
      : [
          path.join(projectRoot, '.ghostcoderc'),
          path.join(projectRoot, 'ghostcode.config.json'),
          path.join(projectRoot, '.ghostcoderc.json'),
        ];

    for (const configPath of candidatePaths) {
      if (fs.existsSync(configPath)) {
        try {
          const raw = fs.readFileSync(configPath, 'utf-8');
          const parsed = JSON.parse(raw);
          return parsed as GhostConfig;
        } catch (error) {
          console.warn(`[WARN] Failed to parse ghostcode config at ${configPath}:`, error);
        }
      }
    }

    return {};
  }
}
