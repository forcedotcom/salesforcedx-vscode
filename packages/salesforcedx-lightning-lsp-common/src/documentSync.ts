/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { basename, dirname } from 'node:path';
import { FileSystemDataProvider } from './providers/fileSystemDataProvider';
import { DirectoryEntry } from './types/fileSystemTypes';

/**
 * Ensures parent directories are tracked in FileSystemDataProvider.
 * Creates directory entries and stats for all parent directories up to the workspace root.
 * Expects dirPath to be in fsPath format (already normalized).
 */
const ensureDirectoryTracked = async (
  dirPath: string,
  provider: FileSystemDataProvider,
  workspaceRoots: string[]
): Promise<void> => {
  // Check if directory is already tracked
  if (provider.directoryExists(dirPath)) {
    return;
  }

  // Create directory stat
  provider.updateFileStat(dirPath, {
    type: 'directory',
    exists: true,
    ctime: Date.now(),
    mtime: Date.now(),
    size: 0
  });

  // Get or create directory listing
  const entries = provider.getDirectoryListing(dirPath) ?? [];

  // Update directory listing (will be populated as files are added)
  provider.updateDirectoryListing(dirPath, entries);

  // Recursively ensure parent directory is tracked
  const parentDir = dirname(dirPath);
  if (parentDir && parentDir !== dirPath && parentDir !== '.') {
    // Check if parent is within workspace roots
    // workspaceRoots are already normalized, so we can compare directly
    const isInWorkspace = workspaceRoots.some(root => dirPath.startsWith(root));
    if (isInWorkspace) {
      await ensureDirectoryTracked(parentDir, provider, workspaceRoots);
    }
  }
};

/**
 * Adds a file entry to its parent directory's listing.
 * Expects filePath to be in fsPath format (already normalized).
 */
const addFileToDirectoryListing = async (
  filePath: string,
  provider: FileSystemDataProvider,
  workspaceRoots: string[]
): Promise<void> => {
  // filePath is already normalized to fsPath format
  const parentDir = dirname(filePath);
  const fileName = basename(filePath);

  // Ensure parent directory is tracked
  await ensureDirectoryTracked(parentDir, provider, workspaceRoots);

  // Get current directory listing
  const entries = provider.getDirectoryListing(parentDir) ?? [];

  // Check if file already exists in listing
  const existingEntry = entries.find(entry => entry.name === fileName);
  if (!existingEntry) {
    // Add file entry to directory listing
    // Store in fsPath format for consistency
    const updatedEntries: DirectoryEntry[] = [
      ...entries,
      {
        name: fileName,
        type: 'file',
        uri: filePath
      }
    ];
    provider.updateDirectoryListing(parentDir, updatedEntries);
  }
};

/**
 * Syncs a document to the TextDocuments FileSystemDataProvider.
 * Expects filePath to be a normalized fsPath (not a file:// URI).
 * Callers should normalize URIs before calling this function.
 */
export const syncDocumentToTextDocumentsProvider = async (
  filePath: string,
  content: string,
  provider: FileSystemDataProvider,
  workspaceRoots: string[]
): Promise<void> => {
  // Update TextDocuments FileSystemDataProvider with document content
  provider.updateFileContent(filePath, content);
  provider.updateFileStat(filePath, {
    type: 'file',
    exists: true,
    ctime: Date.now(),
    mtime: Date.now(),
    size: content.length
  });

  // Ensure parent directory is tracked and file is in directory listing
  await addFileToDirectoryListing(filePath, provider, workspaceRoots);
};
