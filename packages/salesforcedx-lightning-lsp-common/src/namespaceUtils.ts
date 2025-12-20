/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as path from 'node:path';
import { IFileSystemProvider } from './providers/fileSystemDataProvider';
import { normalizePath } from './utils';

/**
 * Check if a directory contains module roots
 */
const isModuleRoot = (subdirs: string[], fileSystemProvider: IFileSystemProvider): boolean => {
  for (const subdir of subdirs) {
    // Is a root if any subdir matches a name/name.js with name.js being a module
    const basename = path.basename(subdir);
    const modulePath = normalizePath(path.join(subdir, `${basename}.js`));
    const stat = fileSystemProvider.getFileStat(modulePath);
    if (stat?.type === 'file') {
      return true;
    }
  }
  return false;
};

/**
 * Recursively traverse directories to find namespace roots
 */
const traverse = async (
  candidate: string,
  depth: number,
  roots: { lwc: string[] },
  fileSystemProvider: IFileSystemProvider
): Promise<void> => {
  if (depth - 1 < 0) {
    return;
  }

  // skip traversing node_modules and similar
  const filename = path.basename(candidate);
  if (['node_modules', 'bin', 'target', 'jest-modules', 'repository', 'git'].includes(filename)) {
    return;
  }

  // module_root/name/name.js
  // Normalize candidate before calling getDirectoryListing to ensure path format consistency
  const normalizedCandidate = normalizePath(candidate);
  const entries = fileSystemProvider.getDirectoryListing(normalizedCandidate);
  const dirs = entries
    .filter(entry => entry.type === 'directory')
    .map(entry => normalizePath(path.join(normalizedCandidate, entry.name)));

  // Is a root if we have a folder called lwc
  const isDirLWC =
    isModuleRoot(dirs, fileSystemProvider) ||
    (!path.parse(normalizedCandidate).ext && path.parse(normalizedCandidate).name === 'lwc');
  if (isDirLWC) {
    // normalizedCandidate is already normalized and absolute, so we can use it directly
    roots.lwc.push(normalizedCandidate);
  } else {
    for (const subdir of dirs) {
      await traverse(subdir, depth - 1, roots, fileSystemProvider);
    }
  }
};

/**
 * Finds namespace roots (LWC) within a directory by traversing the file system.
 *
 * A directory is considered an LWC namespace root if:
 * 1. It contains subdirectories matching the pattern `name/name.js` (e.g., `myComponent/myComponent.js`)
 * 2. It is named `lwc` (e.g., `modules/lwc` becomes a root)
 *
 *
 * The function recursively traverses directories up to `maxDepth` levels, skipping ignored folders.
 *
 * @param root - The root directory to search within
 * @param fileSystemProvider - The file system provider to use for file operations
 * @param maxDepth - Maximum depth to traverse (default: 5)
 * @returns Object with `lwc` array containing normalized absolute paths to namespace roots.
 *
 * @example
 * // Structure: /workspace/myComponent/myComponent.js
 * // Returns: { lwc: ['/workspace'] }
 *
 * @example
 * // Structure: /workspace/modules/lwc/myComponent/myComponent.js
 * // Returns: { lwc: ['/workspace/modules/lwc'] }
 *
 * @example
 * // Structure: /workspace/component1/component1.js, component2/component2.js
 * // Returns: { lwc: ['/workspace'] }
 *
 * @example
 * // Structure: /workspace/node_modules/someComponent/someComponent.js
 * // Returns: { lwc: [] } (node_modules is ignored)
 *
 * @example
 * // Structure: /workspace/myComponent/other.js (name mismatch)
 * // Returns: { lwc: [] } (not a valid module root)
 */
export const findNamespaceRoots = async (
  root: string,
  fileSystemProvider: IFileSystemProvider,
  maxDepth = 5
): Promise<{ lwc: string[] }> => {
  const roots: { lwc: string[] } = {
    lwc: []
  };

  // Normalize root path before calling getFileStat to ensure path format consistency
  const normalizedRoot = normalizePath(root);
  const stat = fileSystemProvider.getFileStat(normalizedRoot);
  if (stat?.type === 'directory') {
    await traverse(normalizedRoot, maxDepth, roots, fileSystemProvider);
  }
  return roots;
};
