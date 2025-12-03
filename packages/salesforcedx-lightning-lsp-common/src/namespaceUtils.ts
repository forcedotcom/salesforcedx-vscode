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
const isModuleRoot = async (subdirs: string[], fileSystemProvider: IFileSystemProvider): Promise<boolean> => {
  for (const subdir of subdirs) {
    // Is a root if any subdir matches a name/name.js with name.js being a module
    const basename = path.basename(subdir);
    const modulePath = normalizePath(path.join(subdir, `${basename}.js`));
    try {
      const stat = fileSystemProvider.getFileStat(modulePath);
      if (stat?.type === 'file') {
        return true;
      }
    } catch {
      // File doesn't exist
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
  roots: { lwc: string[]; aura: string[] },
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
  const dirs = [];
  if (entries) {
    for (const entry of entries) {
      if (entry.type === 'directory') {
        // Normalize the joined path to ensure consistent format (especially Windows drive letter casing)
        dirs.push(normalizePath(path.join(normalizedCandidate, entry.name)));
      }
    }
  }

  // Is a root if we have a folder called lwc
  const isDirLWC =
    (await isModuleRoot(dirs, fileSystemProvider)) ||
    (!path.parse(normalizedCandidate).ext && path.parse(normalizedCandidate).name === 'lwc');
  if (isDirLWC) {
    // Normalize the resolved path to ensure consistent format (especially Windows drive letter casing)
    roots.lwc.push(normalizePath(path.resolve(normalizedCandidate)));
  } else {
    for (const subdir of dirs) {
      await traverse(subdir, depth - 1, roots, fileSystemProvider);
    }
  }
};

/**
 * Helper function to find namespace roots within a directory
 */
export const findNamespaceRoots = async (
  root: string,
  fileSystemProvider: IFileSystemProvider,
  maxDepth = 5
): Promise<{ lwc: string[]; aura: string[] }> => {
  const roots: { lwc: string[]; aura: string[] } = {
    lwc: [],
    aura: []
  };

  try {
    // Normalize root path before calling getFileStat to ensure path format consistency
    const normalizedRoot = normalizePath(root);
    const stat = fileSystemProvider.getFileStat(normalizedRoot);
    if (stat?.type === 'directory') {
      await traverse(normalizedRoot, maxDepth, roots, fileSystemProvider);
    }
  } catch {
    // Directory doesn't exist
  }
  return roots;
};
