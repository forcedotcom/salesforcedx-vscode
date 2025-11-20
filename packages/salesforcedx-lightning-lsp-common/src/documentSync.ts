/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { basename, dirname } from 'node:path';
import { URI } from 'vscode-uri';
import { FileSystemDataProvider } from './providers/fileSystemDataProvider';
import { DirectoryEntry } from './types/fileSystemTypes';
import { unixify } from './utils';

/**
 * Ensures parent directories are tracked in FileSystemDataProvider.
 * Creates directory entries and stats for all parent directories up to the workspace root.
 */
const ensureDirectoryTracked = async (
  dirUri: string,
  provider: FileSystemDataProvider,
  workspaceRoots: string[]
): Promise<void> => {
  // Check if directory is already tracked
  if (provider.directoryExists(dirUri)) {
    return;
  }

  // Create directory stat
  provider.updateFileStat(dirUri, {
    type: 'directory',
    exists: true,
    ctime: Date.now(),
    mtime: Date.now(),
    size: 0
  });

  // Get or create directory listing
  const entries = provider.getDirectoryListing(dirUri) ?? [];

  // Update directory listing (will be populated as files are added)
  provider.updateDirectoryListing(dirUri, entries);

  // Recursively ensure parent directory is tracked
  const parentDir = unixify(dirname(dirUri));
  if (parentDir && parentDir !== dirUri && parentDir !== '.') {
    // Check if parent is within workspace roots
    // Normalize paths for cross-platform compatibility
    const normalizedDirUri = unixify(dirUri);
    const normalizedWorkspaceRoots = workspaceRoots.map(root => unixify(root));
    const isInWorkspace = normalizedWorkspaceRoots.some(root => normalizedDirUri.startsWith(root));
    if (isInWorkspace) {
      await ensureDirectoryTracked(parentDir, provider, workspaceRoots);
    }
  }
};

/**
 * Adds a file entry to its parent directory's listing.
 * Expects fileUri to be in fsPath format (already normalized).
 */
const addFileToDirectoryListing = async (
  fileUri: string,
  provider: FileSystemDataProvider,
  workspaceRoots: string[]
): Promise<void> => {
  // fileUri is already normalized to fsPath format, but handle both formats for safety
  const filePath = fileUri.startsWith('file://') ? unixify(URI.parse(fileUri).fsPath) : unixify(fileUri);
  const parentDir = unixify(dirname(filePath));
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
 * Normalizes URI to fsPath to match init provider format.
 */
export const syncDocumentToTextDocumentsProvider = async (
  uri: string,
  content: string,
  provider: FileSystemDataProvider,
  workspaceRoots: string[]
): Promise<void> => {
  // Normalize URI to fsPath to match init provider format (plain path, not file:// URI)
  // Also normalize path separators for cross-platform compatibility
  const normalizedUri = unixify(URI.parse(uri).fsPath);

  // Update TextDocuments FileSystemDataProvider with document content
  provider.updateFileContent(normalizedUri, content);
  provider.updateFileStat(normalizedUri, {
    type: 'file',
    exists: true,
    ctime: Date.now(),
    mtime: Date.now(),
    size: content.length
  });

  // Ensure parent directory is tracked and file is in directory listing
  await addFileToDirectoryListing(normalizedUri, provider, workspaceRoots);
};
