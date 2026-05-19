/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the
 * repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { readdirSync, existsSync } from 'fs';
import { join } from 'path';
import { log, setOutput, getExtensionInfo } from './utils';

/**
 * Get all available VS Code extensions
 */
export function getAvailableExtensions(): string {
  log.info('Getting all available VS Code extensions...');

  // Get all packages from the packages directory
  const packagesDir = join(process.cwd(), 'packages');
  const extensions: string[] = [];

  if (!existsSync(packagesDir)) {
    log.warning('packages directory not found');
    return '[]';
  }

  const packageDirs = readdirSync(packagesDir, { withFileTypes: true })
    .filter((dirent) => dirent.isDirectory())
    .map((dirent) => dirent.name);

  for (const packageName of packageDirs) {
    const packagePath = join(packagesDir, packageName);
    const packageJsonPath = join(packagePath, 'package.json');

    if (existsSync(packageJsonPath)) {
      try {
        const info = getExtensionInfo(packagePath);

        // Only include packages that have a publisher (VS Code extensions)
        if (info.publisher) {
          extensions.push(packageName);
          log.debug(
            `Found VS Code extension: ${packageName} (publisher: ${info.publisher})`,
          );
        } else {
          log.debug(`Skipping NPM package: ${packageName} (no publisher)`);
        }
      } catch (error) {
        log.warning(`Failed to read package.json for ${packageName}: ${error}`);
      }
    }
  }

  const jsonArray = JSON.stringify(extensions);
  log.info(
    `Found ${extensions.length} VS Code extensions: ${extensions.join(', ')}`,
  );
  log.debug(`JSON array: ${jsonArray}`);

  return jsonArray;
}

/**
 * Set GitHub Actions outputs for extension discovery
 */
export function setExtensionDiscoveryOutputs(extensions: string): void {
  setOutput('extensions', extensions);

  log.success('Extension discovery outputs set');
}

/**
 * Main function for CLI usage
 */
export async function main(): Promise<void> {
  try {
    const extensions = getAvailableExtensions();
    setExtensionDiscoveryOutputs(extensions);
  } catch (error) {
    log.error(`Failed to discover extensions: ${error}`);
    process.exit(1);
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
