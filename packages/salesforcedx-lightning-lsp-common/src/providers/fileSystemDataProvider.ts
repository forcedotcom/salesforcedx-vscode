/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { FileStat, DirectoryEntry, WorkspaceConfig } from '../types/fileSystemTypes';
import { normalizePath } from '../utils';

/**
 * Interface for file system operations
 */
export interface IFileSystemProvider {
  getFileContent(uri: string): string | undefined;
  getDirectoryListing(uri: string): DirectoryEntry[];
  getFileStat(uri: string): FileStat | undefined;
  fileExists(uri: string): boolean;
  directoryExists(uri: string): boolean;
  updateFileContent(uri: string, content: string): void;
  updateDirectoryListing(uri: string, entries: DirectoryEntry[]): void;
  updateFileStat(uri: string, stat: FileStat): void;
  updateWorkspaceConfig(config: WorkspaceConfig): void;
  getAllFileUris(): string[];
}

/**
 * Manages file system data received from the LSP client
 * This replaces direct file system access in the language server
 */
export class FileSystemDataProvider implements IFileSystemProvider {
  private fileContents: Map<string, string> = new Map();
  private directoryListings: Map<string, DirectoryEntry[]> = new Map();
  private fileStats: Map<string, FileStat> = new Map();
  private workspaceConfig: WorkspaceConfig | null = null;

  /**
   * Update file content from client
   */
  public updateFileContent(uri: string, content: string): void {
    this.fileContents.set(normalizePath(uri), content);
  }

  /**
   * Get file content
   */
  public getFileContent(uri: string): string | undefined {
    return this.fileContents.get(normalizePath(uri));
  }

  /**
   * Update directory listing from client
   */
  public updateDirectoryListing(uri: string, entries: DirectoryEntry[]): void {
    // Normalize URIs in directory entries as well
    const normalizedEntries = entries.map(entry => ({
      ...entry,
      uri: normalizePath(entry.uri)
    }));
    this.directoryListings.set(normalizePath(uri), normalizedEntries);
  }

  /**
   * Get directory listing
   * If no explicit listing exists but the directory exists (inferred from files),
   * build a listing from files that are direct children of this directory.
   */
  public getDirectoryListing(uri: string): DirectoryEntry[] {
    const normalizedUri = normalizePath(uri);
    const explicitListing = this.directoryListings.get(normalizedUri);
    if (explicitListing) {
      return explicitListing;
    }

    // If no explicit listing, but directory exists (inferred from files), build listing
    if (this.directoryExists(normalizedUri)) {
      const dirPathWithSlash = normalizedUri.endsWith('/') ? normalizedUri : `${normalizedUri}/`;
      const entries: DirectoryEntry[] = [];
      const seenNames = new Set<string>();

      // Find all files that are direct children of this directory
      for (const fileUri of this.fileStats.keys()) {
        if (fileUri.startsWith(dirPathWithSlash)) {
          // Get the relative path from the directory
          const relativePath = fileUri.substring(dirPathWithSlash.length);
          // Only include immediate children (not nested files)
          if (relativePath && !relativePath.includes('/')) {
            const fileName = relativePath;
            if (!seenNames.has(fileName)) {
              seenNames.add(fileName);
              const stat = this.fileStats.get(fileUri);
              entries.push({
                name: fileName,
                type: stat?.type ?? 'file',
                uri: fileUri
              });
            }
          }
        }
      }

      if (entries.length > 0) {
        process.stdout.write(
          `[getDirectoryListing] Built listing from ${entries.length} file(s) for: ${normalizedUri}\n`
        );
        return entries;
      }
    }

    return [];
  }

  /**
   * Update file stat from client
   */
  public updateFileStat(uri: string, stat: FileStat): void {
    this.fileStats.set(normalizePath(uri), stat);
  }

  /**
   * Get file stat
   */
  public getFileStat(uri: string): FileStat | undefined {
    return this.fileStats.get(normalizePath(uri));
  }

  /**
   * Check if file exists
   */
  public fileExists(uri: string): boolean {
    const stat = this.fileStats.get(normalizePath(uri));
    return stat?.exists ?? false;
  }

  /**
   * Check if directory exists
   * A directory exists if:
   * 1. It has a file stat with type 'directory', OR
   * 2. It has a directory listing (even if no explicit stat was created), OR
   * 3. Any files exist with paths that start with this directory path (inferred existence)
   */
  public directoryExists(uri: string): boolean {
    const normalizedUri = normalizePath(uri);
    process.stdout.write(`[directoryExists] Checking: ${uri} -> normalized: ${normalizedUri}\n`);

    const stat = this.fileStats.get(normalizedUri);
    if (stat?.exists && stat.type === 'directory') {
      process.stdout.write(`[directoryExists] Found directory stat: ${normalizedUri}\n`);
      return true;
    }
    process.stdout.write(`[directoryExists] No directory stat found for: ${normalizedUri}\n`);

    // Check if there's a directory listing (directory might exist without explicit stat)
    if (this.directoryListings.has(normalizedUri)) {
      process.stdout.write(`[directoryExists] Found directory listing: ${normalizedUri}\n`);
      return true;
    }
    process.stdout.write(`[directoryExists] No directory listing found for: ${normalizedUri}\n`);

    // Infer directory existence from files: if any file path starts with this directory path,
    // the directory must exist. Ensure we check with a trailing slash to avoid partial matches.
    const dirPathWithSlash = normalizedUri.endsWith('/') ? normalizedUri : `${normalizedUri}/`;
    process.stdout.write(`[directoryExists] Checking for files with prefix: ${dirPathWithSlash}\n`);
    let matchingFileCount = 0;
    for (const fileUri of this.fileStats.keys()) {
      if (fileUri.startsWith(dirPathWithSlash)) {
        matchingFileCount++;
        if (matchingFileCount === 1) {
          process.stdout.write(`[directoryExists] Found matching file (first): ${fileUri}\n`);
        }
      }
    }
    if (matchingFileCount > 0) {
      process.stdout.write(`[directoryExists] Inferred directory existence from ${matchingFileCount} file(s)\n`);
      return true;
    }
    process.stdout.write(`[directoryExists] Directory does not exist: ${normalizedUri}\n`);
    return false;
  }

  /**
   * Update workspace configuration
   */
  public updateWorkspaceConfig(config: WorkspaceConfig): void {
    this.workspaceConfig = config;
  }

  /**
   * Clear all data (useful for workspace changes)
   * visible for testing
   */
  public clear(): void {
    this.fileContents.clear();
    this.directoryListings.clear();
    this.fileStats.clear();
    this.workspaceConfig = null;
  }

  /**
   * Get all directory URIs that have listings
   */
  public getAllDirectoryUris(): string[] {
    // Keys are already normalized since we normalize on set
    return Array.from(this.directoryListings.keys());
  }

  /**
   * Get all file URIs
   */
  public getAllFileUris(): string[] {
    const allKeys = Array.from(this.fileStats.keys());

    const existingFiles = allKeys.filter(uri => {
      const stat = this.getFileStat(uri);
      return stat?.exists ?? false;
    });

    return existingFiles;
  }

  /**
   * Serialize the provider data for transmission to the language server
   */
  public serialize(): {
    fileContents: Record<string, string>;
    directoryListings: Record<string, DirectoryEntry[]>;
    fileStats: Record<string, FileStat>;
    workspaceConfig: WorkspaceConfig | null;
  } {
    return {
      fileContents: Object.fromEntries(this.fileContents),
      directoryListings: Object.fromEntries(this.directoryListings),
      fileStats: Object.fromEntries(this.fileStats),
      workspaceConfig: this.workspaceConfig
    };
  }
}
