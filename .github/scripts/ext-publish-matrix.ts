#!/usr/bin/env tsx
/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the
 * repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { log } from './utils';
import { readdirSync, existsSync } from 'fs';
import { join } from 'path';

interface PublishMatrixEntry {
  registry: string;
  vsix_pattern: string;
  marketplace: string;
}

interface PublishMatrixOptions {
  registries: string;
  selectedExtensions: string;
}

/**
 * Get all available VS Code extensions (packages with publisher field)
 */
function getAvailableExtensions(): string[] {
  const extensions: string[] = [];
  const packagesDir = join(process.cwd(), 'packages');

  if (!existsSync(packagesDir)) {
    log.warning('packages directory not found');
    return extensions;
  }

  const packageDirs = readdirSync(packagesDir, { withFileTypes: true })
    .filter((dirent) => dirent.isDirectory())
    .map((dirent) => dirent.name);

  for (const packageName of packageDirs) {
    const packagePath = join(packagesDir, packageName);
    const packageJsonPath = join(packagePath, 'package.json');

    if (existsSync(packageJsonPath)) {
      try {
        const packageJson = JSON.parse(
          require('fs').readFileSync(packageJsonPath, 'utf-8'),
        );

        // Only include packages that have a publisher (VS Code extensions)
        if (packageJson.publisher) {
          extensions.push(packageName);
          log.debug(
            `Found VS Code extension: ${packageName} (publisher: ${packageJson.publisher})`,
          );
        } else {
          log.debug(`Skipping NPM package: ${packageName} (no publisher)`);
        }
      } catch (error) {
        log.warning(`Failed to read package.json for ${packageName}: ${error}`);
      }
    }
  }

  return extensions;
}

function getVsixPattern(extension: string): string {
  switch (extension) {
    case 'apex-lsp-vscode-extension':
      // Universal VSIX (main + browser); nightly-extensions publish uses explicit find excluding *-web-*
      return '*apex-language-server-extension*-[0-9]*.vsix';
    default:
      return `*${extension}*.vsix`;
  }
}

function getMarketplaceName(registry: string): string {
  switch (registry) {
    case 'vsce':
      return 'VS Code Marketplace';
    case 'ovsx':
      return 'Open VSX Registry';
    default:
      return registry;
  }
}

function determinePublishMatrix(
  options: PublishMatrixOptions,
): PublishMatrixEntry[] {
  const { registries, selectedExtensions } = options;

  // Handle special values and empty/undefined selectedExtensions
  if (!selectedExtensions || selectedExtensions.trim() === '') {
    log.info('No extensions selected for publishing, returning empty matrix');
    return [];
  }

  // Handle special values
  const normalizedSelection = selectedExtensions.trim().toLowerCase();
  if (normalizedSelection === 'none') {
    log.info('Extensions set to "none" - returning empty matrix');
    return [];
  }

  // Determine which extensions to include
  let extensions: string[];
  if (normalizedSelection === 'all') {
    log.info('Extensions set to "all" - including all available extensions');
    extensions = getAvailableExtensions();
  } else {
    // Parse comma-separated list of specific extensions
    extensions = selectedExtensions.split(',').filter(Boolean);
  }

  if (extensions.length === 0) {
    log.info('No extensions to publish, returning empty matrix');
    return [];
  }

  // Determine which registries to include
  const registryList =
    registries === 'all'
      ? ['vsce', 'ovsx']
      : registries.split(',').filter(Boolean);

  // Create matrix entries for each extension-registry combination
  const matrix: PublishMatrixEntry[] = [];

  for (const ext of extensions) {
    if (!ext) continue;

    const vsixPattern = getVsixPattern(ext);

    for (const registry of registryList) {
      const marketplace = getMarketplaceName(registry);

      matrix.push({
        registry,
        vsix_pattern: vsixPattern,
        marketplace,
      });
    }
  }
  log.info(`Publish matrix: ${JSON.stringify(matrix, null, 2)}`);
  return matrix;
}

// Export for use in other modules
export { determinePublishMatrix };
